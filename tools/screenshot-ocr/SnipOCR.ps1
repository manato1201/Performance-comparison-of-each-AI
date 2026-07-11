#Requires -Version 5.1
<#
.SYNOPSIS
    SnipOCR - スクリーンショットを撮ったら即テキスト化する常駐ツール（完全ローカル）

.DESCRIPTION
    クリップボードを監視し、新しい画像（Win+Shift+S のスクショ等）を検出したら
    Windows 標準の Windows.Media.Ocr (WinRT) で OCR します。外部 API・追加インストール不要。

    結果は以下の3か所に出ます:
      (a) クリップボードへテキストとして書き戻し（すぐ Ctrl+V で貼れる）
      (b) captures.md へタイムスタンプ付きで追記
      (c) コンソールに表示（＋ビープ音）

.PARAMETER OutFile
    追記先の Markdown ファイル。既定: スクリプトと同じフォルダの captures.md

.PARAMETER Language
    優先する OCR 言語タグ。既定: 'ja'（失敗時はユーザープロファイル言語へフォールバック）

.PARAMETER PollMs
    クリップボードのポーリング間隔（ミリ秒）。既定: 500

.PARAMETER NoClipboardWriteback
    指定すると、OCR 結果をクリップボードへ書き戻さない（画像をクリップボードに残したい場合）

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\SnipOCR.ps1
    起動後、Win+Shift+S で画面の好きな場所をスクショ → 自動で OCR。Ctrl+C で終了。
#>
[CmdletBinding()]
param(
    [string]$OutFile = (Join-Path $PSScriptRoot 'captures.md'),
    [string]$Language = 'ja',
    [ValidateRange(100, 10000)]
    [int]$PollMs = 500,
    [switch]$NoClipboardWriteback
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- アセンブリ / WinRT 型ロード
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]

# ---------------------------------------------------------------- WinRT 非同期 → 同期ヘルパー
# PowerShell 5.1 定番: WindowsRuntimeSystemExtensions.AsTask 経由で待機する
$script:AsTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1

function Await {
    param($WinRtTask, [Type]$ResultType)
    $task = $script:AsTaskGeneric.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask))
    $task.GetAwaiter().GetResult()
}

# ---------------------------------------------------------------- OCR エンジン
function New-OcrEngine {
    param([string]$LanguageTag)
    $engine = $null
    try {
        $lang = New-Object Windows.Globalization.Language($LanguageTag)
        if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($lang)) {
            $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
        }
    } catch { $engine = $null }
    if ($null -eq $engine) {
        Write-Warning "言語 '$LanguageTag' の OCR エンジンを作成できませんでした。ユーザープロファイル言語へフォールバックします。"
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    }
    if ($null -eq $engine) {
        throw 'OCR エンジンを作成できません。[設定 > 時刻と言語 > 言語と地域] で言語パック（基本の入力/OCR）を追加してください。'
    }
    return $engine
}

# ---------------------------------------------------------------- 画像 → SoftwareBitmap（ストリーム経由）
function ConvertTo-SoftwareBitmap {
    param([System.Drawing.Image]$Image, [int]$MaxDimension)

    $src = $Image
    $resized = $null
    try {
        # OcrEngine.MaxImageDimension を超える巨大画像は縮小してから渡す
        if ($MaxDimension -gt 0 -and ($src.Width -gt $MaxDimension -or $src.Height -gt $MaxDimension)) {
            $scale = [Math]::Min($MaxDimension / $src.Width, $MaxDimension / $src.Height)
            $w = [Math]::Max(1, [int]($src.Width * $scale))
            $h = [Math]::Max(1, [int]($src.Height * $scale))
            $resized = New-Object System.Drawing.Bitmap($src, $w, $h)
            $src = $resized
        }
        $ms = New-Object System.IO.MemoryStream
        try {
            $src.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
            $ms.Position = 0
            $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
            $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
            return (Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap]))
        } finally {
            $ms.Dispose()
        }
    } finally {
        if ($null -ne $resized) { $resized.Dispose() }
    }
}

# ---------------------------------------------------------------- OCR 結果 → テキスト整形
function Format-OcrText {
    param($OcrResult, [bool]$IsJapanese)
    $cjk = '\p{IsHiragana}\p{IsKatakana}\p{IsCJKUnifiedIdeographs}\p{IsCJKSymbolsandPunctuation}\p{IsHalfwidthandFullwidthForms}'
    $lines = foreach ($line in $OcrResult.Lines) {
        $t = $line.Text
        if ($IsJapanese) {
            # 日本語 OCR は文字間に余計な半角スペースが入るため、CJK 文字間のスペースを除去
            $t = $t -replace "(?<=[$cjk])\s+(?=[$cjk])", ''
        }
        $t
    }
    return ($lines -join [Environment]::NewLine)
}

function Invoke-OcrOnImage {
    param($Engine, [System.Drawing.Image]$Image)
    $bitmap = ConvertTo-SoftwareBitmap -Image $Image -MaxDimension ([Windows.Media.Ocr.OcrEngine]::MaxImageDimension)
    try {
        $result = Await ($Engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        $isJa = $Engine.RecognizerLanguage.LanguageTag -like 'ja*'
        return (Format-OcrText -OcrResult $result -IsJapanese $isJa)
    } finally {
        $bitmap.Dispose()
    }
}

# ---------------------------------------------------------------- クリップボード
$script:Md5 = [System.Security.Cryptography.MD5]::Create()

function Get-ClipboardImageInfo {
    # 戻り値: @{ Image = [Drawing.Image]; Hash = [string] } / 画像なしなら $null
    if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) { return $null }
    $img = $null
    try { $img = [System.Windows.Forms.Clipboard]::GetImage() } catch { return $null }
    if ($null -eq $img) { return $null }
    $ms = New-Object System.IO.MemoryStream
    try {
        $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $hash = [BitConverter]::ToString($script:Md5.ComputeHash($ms.ToArray()))
    } finally {
        $ms.Dispose()
    }
    return @{ Image = $img; Hash = $hash }
}

# ---------------------------------------------------------------- メイン
try {
    $engine = New-OcrEngine -LanguageTag $Language
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

$langTag = $engine.RecognizerLanguage.LanguageTag
$langName = $engine.RecognizerLanguage.DisplayName
$available = ([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag }) -join ', '

Write-Host ''
Write-Host '=============================================================' -ForegroundColor Cyan
Write-Host '  SnipOCR - スクショ即テキスト化 (完全ローカル / WinRT OCR)' -ForegroundColor Cyan
Write-Host '=============================================================' -ForegroundColor Cyan
Write-Host "  OCR 言語     : $langName ($langTag)"
Write-Host "  利用可能言語 : $available"
Write-Host "  追記先       : $OutFile"
Write-Host "  監視間隔     : ${PollMs}ms"
if ($NoClipboardWriteback) { Write-Host '  書き戻し     : 無効 (-NoClipboardWriteback)' }
Write-Host ''
Write-Host '  使い方:' -ForegroundColor Yellow
Write-Host '    1. Win+Shift+S で画面の好きな範囲をスクショ'
Write-Host '    2. 自動で OCR → クリップボードにテキストが入る (Ctrl+V で貼り付け)'
Write-Host "    3. 履歴は captures.md に残る"
Write-Host '    Ctrl+C で終了'
Write-Host ''

# 起動時点でクリップボードに残っている画像は対象外にする（新規のみ反応）
$lastHash = ''
$initial = Get-ClipboardImageInfo
if ($null -ne $initial) {
    $lastHash = $initial.Hash
    $initial.Image.Dispose()
}

Write-Host 'クリップボード監視中... (Win+Shift+S でスクショしてください)' -ForegroundColor Green

$count = 0
while ($true) {
    Start-Sleep -Milliseconds $PollMs

    $info = $null
    try { $info = Get-ClipboardImageInfo } catch { continue }
    if ($null -eq $info) { continue }

    if ($info.Hash -eq $lastHash) {
        $info.Image.Dispose()
        continue
    }
    $lastHash = $info.Hash

    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $text = ''
    try {
        $text = Invoke-OcrOnImage -Engine $engine -Image $info.Image
    } catch {
        Write-Warning "OCR 失敗: $($_.Exception.Message)"
        $info.Image.Dispose()
        continue
    }
    $sw.Stop()
    $size = '{0}x{1}' -f $info.Image.Width, $info.Image.Height
    $info.Image.Dispose()
    $count++

    if ([string]::IsNullOrWhiteSpace($text)) {
        Write-Host "[$stamp] #$count テキストは検出されませんでした ($size, $($sw.ElapsedMilliseconds)ms)" -ForegroundColor DarkGray
        continue
    }

    # (a) クリップボードへ書き戻し
    if (-not $NoClipboardWriteback) {
        try { [System.Windows.Forms.Clipboard]::SetText($text) } catch {
            Write-Warning "クリップボードへの書き戻しに失敗: $($_.Exception.Message)"
        }
    }

    # (b) captures.md へ追記
    $entry = "## $stamp ($size, $($sw.ElapsedMilliseconds)ms)$([Environment]::NewLine)$([Environment]::NewLine)$text$([Environment]::NewLine)$([Environment]::NewLine)"
    try {
        [System.IO.File]::AppendAllText($OutFile, $entry, (New-Object System.Text.UTF8Encoding($true)))
    } catch {
        Write-Warning "captures.md への追記に失敗: $($_.Exception.Message)"
    }

    # (c) コンソール表示 + ビープ
    Write-Host "[$stamp] #$count OCR 完了 ($size, $($sw.ElapsedMilliseconds)ms) -> クリップボード / captures.md" -ForegroundColor Cyan
    Write-Host '-------------------------------------------------------------'
    Write-Host $text
    Write-Host '-------------------------------------------------------------'
    try { [Console]::Beep(880, 120) } catch { }
}
