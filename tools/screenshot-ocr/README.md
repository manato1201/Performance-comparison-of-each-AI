# screenshot-ocr — スクショ即テキスト化ツール（完全ローカル）

画面に映るものを何でも、**Win+Shift+S でスクショした瞬間にテキスト化**する PowerShell ツールです。

- 外部 API・クラウド・追加インストール **一切不要**（Windows 10/11 標準の Windows.Media.Ocr / WinRT を使用）
- 日本語 + 英語対応（`ja` 優先 → 未導入ならユーザープロファイル言語へ自動フォールバック）
- PowerShell 5.1（Windows 標準の powershell.exe）で動作

## ファイル構成

| ファイル | 役割 |
|---|---|
| `SnipOCR.ps1` | 常駐モード。クリップボードを監視し、新しいスクショを即 OCR |
| `ocr-file.ps1` | 単発モード。画像ファイル 1 枚を OCR して標準出力 |
| `captures.md` | OCR 履歴（SnipOCR が自動生成・追記） |

## 使い方

### 常駐モード（メイン）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\SnipOCR.ps1
```

1. 起動したまま **Win+Shift+S** で画面の好きな範囲をスクショ
2. 自動で OCR され、結果が
   - **クリップボード**に入る（すぐ Ctrl+V で貼り付け可能）
   - **captures.md** にタイムスタンプ付きで追記される
   - **コンソール**に表示される（ビープ音つき）
3. **Ctrl+C** で終了

オプション:

```powershell
# 画像をクリップボードに残したい（テキスト書き戻しを無効化）
.\SnipOCR.ps1 -NoClipboardWriteback

# 出力先・言語・ポーリング間隔の変更
.\SnipOCR.ps1 -OutFile D:\notes\ocr.md -Language en-US -PollMs 300
```

スクショ以外でも、**画像をクリップボードにコピーする操作すべて**が対象です
（ブラウザで画像を右クリック→コピー、Snipping Tool、PrintScreen など）。

### 単発モード

```powershell
# 画像ファイルを OCR して標準出力へ
.\ocr-file.ps1 image.png

# 言語指定
.\ocr-file.ps1 image.png -Language en-US

# ファイルへ保存
.\ocr-file.ps1 image.png > result.txt

# 利用可能な OCR 言語一覧
.\ocr-file.ps1 -ListLanguages
```

対応形式: PNG / JPG / BMP / GIF / TIFF（System.Drawing が読める形式）

## 日本語言語パックが未導入の場合

`ja` の OCR エンジンが作れない場合は自動的にユーザープロファイル言語（多くは en-US）へ
フォールバックしますが、日本語 OCR を使うには言語パックの追加が必要です:

1. **設定 > 時刻と言語 > 言語と地域 > 言語の追加** で「日本語」を追加
   （「基本の入力」/「手書き」等のオプション機能に OCR が含まれます）
2. またはコマンドで（管理者 PowerShell）:
   ```powershell
   # 状態確認
   Get-WindowsCapability -Online | Where-Object Name -like 'Language.OCR*ja*'
   # 追加
   Add-WindowsCapability -Online -Name 'Language.OCR~~~ja-JP~0.0.1.0'
   ```
3. 導入済み言語は `.\ocr-file.ps1 -ListLanguages` で確認できます

## 精度の傾向（Windows.Media.Ocr の特性）

- **得意**: 画面レンダリングされたテキスト（UI・Web ページ・コードエディタ・字幕など）。
  スクショ用途では十分実用的で、1 枚あたり数十〜数百 ms と高速
- **日本語**: 文字間に余計な半角スペースが入る癖があるため、本ツールは CJK 文字間の
  スペースを自動除去しています。日本語エンジンは同一画像内の英数字もそのまま認識できます
- **苦手**: 手書き文字、低解像度・小さい文字（目安 20px 未満）、強いノイズ・傾き、
  装飾フォント。小さすぎる文字は、スクショ前に表示を拡大（Ctrl+`+` など）すると改善します
- **サイズ上限**: エンジンの `MaxImageDimension` を超える巨大画像は自動で縮小してから
  OCR します（縮小により小さい文字の精度は下がることがあります）
- 段組み・表のレイアウト復元はしません（行単位のテキスト抽出です）

## 常駐化のヒント

### ショートカット（手動起動をワンクリックに）

デスクトップ等にショートカットを作り、リンク先を:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\...\tools\screenshot-ocr\SnipOCR.ps1"
```

「実行時の大きさ: 最小化」にしておくと邪魔になりません。

### スタートアップ登録（サインイン時に自動起動）

`shell:startup`（Win+R で入力）で開くフォルダに上記ショートカットを置くだけです。

### タスクスケジューラ

```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument '-NoProfile -WindowStyle Minimized -ExecutionPolicy Bypass -File "C:\Users\<you>\...\tools\screenshot-ocr\SnipOCR.ps1"'
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName 'SnipOCR' -Action $action -Trigger $trigger
```

> 注意: クリップボード監視のため「ユーザーがログオンしているときのみ実行」
> （既定・対話セッション）で登録してください。バックグラウンドセッションでは
> クリップボードにアクセスできません。

## 仕組み（技術メモ)

- OCR: `Windows.Media.Ocr.OcrEngine`（WinRT）。`TryCreateFromLanguage('ja')` →
  失敗時 `TryCreateFromUserProfileLanguages()` フォールバック
- WinRT 非同期は PowerShell 5.1 定番の `WindowsRuntimeSystemExtensions.AsTask` 経由で
  `GetAwaiter().GetResult()` により同期待機
- 画像は「画像 → PNG メモリストリーム → `BitmapDecoder` → `GetSoftwareBitmapAsync`」で
  `SoftwareBitmap` に変換
- クリップボード監視は 500ms ポーリング。`Clipboard.ContainsImage()` + PNG バイト列の
  MD5 ハッシュ比較で「新しい画像」だけを OCR（同じ画像の再処理を防止）
