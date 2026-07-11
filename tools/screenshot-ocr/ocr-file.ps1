#Requires -Version 5.1
<#
.SYNOPSIS
    ocr-file.ps1 - 画像ファイルを1枚 OCR して標準出力へ（完全ローカル / Windows.Media.Ocr）

.DESCRIPTION
    Windows 標準の WinRT OCR エンジンで画像 (png/jpg/bmp/gif/tiff) をテキスト化します。
    外部 API・追加インストール不要。日本語優先、未導入ならユーザープロファイル言語へフォールバック。

.PARAMETER Path
    OCR する画像ファイルのパス

.PARAMETER Language
    優先する OCR 言語タグ。既定: 'ja'

.PARAMETER ListLanguages
    利用可能な OCR 言語一覧を表示して終了

.EXAMPLE
    .\ocr-file.ps1 screenshot.png

.EXAMPLE
    .\ocr-file.ps1 -Path photo.jpg -Language en-US

.EXAMPLE
    .\ocr-file.ps1 -ListLanguages
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Path,
    [string]$Language = 'ja',
    [switch]$ListLanguages
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# 標準出力を UTF-8 に（リダイレクト時の文字化け対策）
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]

# ---- WinRT 非同期 → 同期 (AsTask + GetAwaiter().GetResult() パターン) ----
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

if ($ListLanguages) {
    [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages |
        ForEach-Object { "{0}`t{1}" -f $_.LanguageTag, $_.DisplayName }
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Path)) {
    Write-Error '使い方: .\ocr-file.ps1 <画像ファイル> [-Language ja] / 言語一覧: .\ocr-file.ps1 -ListLanguages'
    exit 1
}
$resolved = Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue
if ($null -eq $resolved) {
    Write-Error "ファイルが見つかりません: $Path"
    exit 1
}

# ---- OCR エンジン (ja → ユーザープロファイル言語フォールバック) ----
$engine = $null
try {
    $lang = New-Object Windows.Globalization.Language($Language)
    if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($lang)) {
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    }
} catch { $engine = $null }
if ($null -eq $engine) {
    Write-Warning "言語 '$Language' の OCR エンジンを作成できませんでした。ユーザープロファイル言語へフォールバックします。"
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
if ($null -eq $engine) {
    Write-Error 'OCR エンジンを作成できません。[設定 > 時刻と言語 > 言語と地域] で言語パックを追加してください。'
    exit 1
}

# ---- 画像 → SoftwareBitmap (PNG メモリストリーム → BitmapDecoder 経由) ----
$img = [System.Drawing.Image]::FromFile($resolved.ProviderPath)
$resizedImg = $null
$ms = New-Object System.IO.MemoryStream
try {
    $src = $img
    $maxDim = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
    if ($maxDim -gt 0 -and ($src.Width -gt $maxDim -or $src.Height -gt $maxDim)) {
        $scale = [Math]::Min($maxDim / $src.Width, $maxDim / $src.Height)
        $resizedImg = New-Object System.Drawing.Bitmap($src, [Math]::Max(1, [int]($src.Width * $scale)), [Math]::Max(1, [int]($src.Height * $scale)))
        $src = $resizedImg
    }
    $src.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $ms.Position = 0

    $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    try {
        $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    } finally {
        $bitmap.Dispose()
    }
} finally {
    $ms.Dispose()
    if ($null -ne $resizedImg) { $resizedImg.Dispose() }
    $img.Dispose()
}

# ---- 整形して標準出力 (日本語は CJK 文字間の余計なスペースを除去) ----
$isJa = $engine.RecognizerLanguage.LanguageTag -like 'ja*'
$cjk = '\p{IsHiragana}\p{IsKatakana}\p{IsCJKUnifiedIdeographs}\p{IsCJKSymbolsandPunctuation}\p{IsHalfwidthandFullwidthForms}'
foreach ($line in $result.Lines) {
    $t = $line.Text
    if ($isJa) { $t = $t -replace "(?<=[$cjk])\s+(?=[$cjk])", '' }
    Write-Output $t
}
