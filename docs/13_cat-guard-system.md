<style>
:root { --main:#2a8bc0; --accent:#75c8cf; --sub:#50c0c1; }
h1 { color:#155a80; border-bottom:4px solid var(--main); padding-bottom:.3em; }
h2 { color:#155a80; border-left:8px solid var(--accent); padding-left:.5em; }
h3 { color:#155a80; }
th { background:var(--main); color:#fff; }
blockquote { border-left:5px solid var(--sub); background:#eef7f9; }
.badge { display:inline-block; padding:1px 10px; border-radius:12px; background:var(--main); color:#fff; font-size:.85em; }
</style>

# 🐈 猫監視・撃退システム — 設計書

<span class="badge">IoT／組み込み</span> <span class="badge">非ゲーム</span> <span class="badge">電子工作</span>

> 🧪 PoC: [poc/13_cat-guard-system/index.html](../poc/13_cat-guard-system/index.html)（Canvas＋WebAudio — 検知→サイズ判定→通知/威嚇のロジックシミュレータ）

## 1. コンセプト

**動体検知で対象を識別し、大きさで「人か猫か」を判断して対応を変える監視・撃退システム（人間も監視対象）。**

| 対象 | 対応 |
|---|---|
| 猫 | 写真を撮ってスマホにメッセージと一緒に送信 ＋ **掃除機の音を再生して威嚇** |
| 人 | 写真を撮ってスマホにメッセージと一緒に送信 |
| 共通 | 30秒〜1分ごとの定期報告、音声の送信にも対応したい |

使用パーツ（txt指定）: **CdSセル（光センサー）、温度センサー、LED**

姉妹コンセプト（txt L84-87）: **猫育成シミュレーション** — アレルギー・金欠・時間がない人向けの仮想飼育。撃退システムで収集した猫の行動データを育成ゲームのAIに転用する構想も可能（txt L1181「ペット情報をデータ化して復元」に接続）。

## 2. 類似製品との差別化

| 比較対象 | 共通点 | 差別化 |
|---|---|---|
| 市販ペットカメラ (Furbo等) | 検知・通知 | **撃退（威嚇音）まで自動実行**し、人/猫を大きさで判別して対応を分岐 |
| 防犯カメラアプリ | 動体検知通知 | 猫対応に特化したエスカレーション（威嚇→報告）と、自作ゆえの拡張自由度（センサー追加） |
| 超音波猫よけ | 撃退 | 証拠写真＋通知が残る。掃除機音という**学習忌避音**を使用 |

## 3. システム構成

```mermaid
flowchart TD
    S1["PIR/カメラ<br/>動体検知"] --> J{"サイズ判定"}
    S2["CdSセル<br/>昼夜判定"] --> J
    S3["温度センサー<br/>誤検知補正/環境ログ"] --> J
    J -->|"小さい=猫"| CAT["撮影 → スマホ通知<br/>掃除機音を再生"]
    J -->|"大きい=人"| HUM["撮影 → スマホ通知"]
    CAT & HUM --> LOG["定期報告<br/>(30秒/1分間隔)"]
    LOG --> APP["スマホ<br/>(LINE Notify等)"]
    LED["LED"] -.->|"状態表示/夜間照明"| S1
    MIC["マイク"] -.->|"音声送信(拡張)"| APP
```

## 4. 判定ロジック

```mermaid
stateDiagram-v2
    [*] --> 待機
    待機 --> 検知 : 動体あり
    検知 --> 判定 : 輪郭サイズ計測
    判定 --> 猫対応 : 高さ閾値未満
    判定 --> 人対応 : 高さ閾値以上
    猫対応 --> 威嚇 : 掃除機音再生
    威嚇 --> 報告
    人対応 --> 報告
    報告 --> 待機 : クールダウン
```

- サイズのみの判別は誤検知（しゃがんだ人・大型犬）があるため、**将来的には軽量画像分類（MobileNet等）を併用**して精度を上げる拡張枠を確保
- 夜間はCdSセルで照度低下を検知→赤外線 or LED照明モードへ

## 5. UI配色（kotonoha_sai）

監視ダッシュボード: **一片氷心（感情）** — 清潔で機能的なモニタリングトーン

| 用途 | 色 | HEX |
|---|---|---|
| 背景 | <span style="background:#d2ebee">&nbsp;&nbsp;&nbsp;</span> | `#d2ebee` |
| パネル | <span style="background:#a9dbe5">&nbsp;&nbsp;&nbsp;</span> | `#a9dbe5` |
| 正常ステータス | <span style="background:#d4e8c6">&nbsp;&nbsp;&nbsp;</span> | `#d4e8c6` |
| 猫検知 | <span style="background:#75c8cf">&nbsp;&nbsp;&nbsp;</span> | `#75c8cf` |
| 人検知 | <span style="background:#50c0c1;color:#fff">&nbsp;&nbsp;&nbsp;</span> | `#50c0c1` |
| アラート・強調 | <span style="background:#2a8bc0;color:#fff">&nbsp;&nbsp;&nbsp;</span> | `#2a8bc0` |

## 6. 技術的要素の羅列

- 動体検知（PIRセンサー or OpenCVフレーム差分）
- 物体サイズ推定（輪郭抽出・バウンディングボックス高さ）
- CdSセルによる照度取得（ADC経由）、温度センサー（DHT11/DS18B20等）
- カメラ撮影・画像保存（Piカメラ／USBカメラ）
- スマホ通知（LINE Messaging API／Discord Webhook: 画像添付＋メッセージ）
- 音声再生（掃除機音源、スピーカー出力）／音声録音・送信（拡張）
- 定期報告スケジューラ（30秒/1分インターバル、クールダウン制御）
- GPIO制御（LEDステータス表示）
- ログDB（検知履歴、SQLite）とダッシュボード表示

## 7. 適した制作環境

| 環境 | 適性 | 評価理由 |
|---|---|---|
| **Raspberry Pi ＋ Python** | ◎ | カメラ・GPIO・OpenCV・通知APIが全部揃う標準構成 |
| **Qt (PySide6)** | ◎ | 監視ダッシュボードUI（PC側ビューア）に最適。指定5環境の中では唯一の適任 |
| exe (WPF) | ○ | Windows PC＋USBカメラ運用ならビューアとして可 |
| HTML5 | ○ | ダッシュボードをWeb化するなら（Flask＋ブラウザ） |
| Unity / UE | × | ゲームエンジンの出る幕なし |

**推奨: Raspberry Pi（検知・撃退本体）＋ PySide6/Qt または Web のダッシュボード**。

## 8. 開発ロードマップ

```mermaid
gantt
    title ハード先行で段階検証
    dateFormat YYYY-MM
    axisFormat %m月
    部品調達・GPIO疎通(LED/CdS/温度) :2026-04, 1M
    動体検知＋撮影                   :2026-05, 1M
    通知連携(LINE/Discord)           :2026-06, 1M
    サイズ判定・威嚇音               :2026-07, 1M
    定期報告・ダッシュボード          :2026-08, 2M
    画像分類による精度向上(拡張)      :2026-10, 2M
```
