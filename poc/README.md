# PoC（プロトタイプ）一覧

各設計書（`docs/`）に対応する動作検証用プロトタイプ。**すべて単一HTML**で、ブラウザで開くだけで動きます（ライブラリはCDN読込のため**要インターネット接続**。08/09/13/17はライブラリ不要）。

## 🎬 共通ビジュアル基盤（[common/fx.js](common/fx.js)）

参考動画（ネオングロー系ダッシュボード／発光ネットワーク図／ローポリ幻想世界／ボクセル夜景）と [unitydesignpatterns.com](https://www.unitydesignpatterns.com/) を踏まえ、pixi系PoCは共通基盤 `FX` / `FXS` を使用:

- **Scene遷移（Stateパターン）**: タイトル → プレイ → リザルト。遷移は**ピクセルディゾルブshader**（モザイクサイズを山なりにアニメーション）
- **ポストFX**: AdvancedBloom（発光）＋ 自作CRTシェーダー（走査線・色収差・ビネット）。**Pキーでピクセル化（ボクセル風）モード**をトグル
- **FXS 複雑シェイプ集**: ○□△を卒業するためのプロシージャル部品 — 有機ブロブ（seed付きベジェ閉曲線）／不等辺ファセット結晶／ベジェ花弁／歯車／関節つき脚／トゲバースト／葉。全キャラ・敵・ギミックをこれらの合成で再構築済み（アヒル=尾羽3枚＋洋ナシ体＋二枚くちばし、ゴーレム=岩ブロブ×結晶ファセット、クモ=関節ベジェ8脚、UFO、流線形カー等）
- **雰囲気**: アンビエント火の粉（Object Pool）、タイトルのグローオーブ、接地影・ハイライトの多層描画
- 適用デザインパターン: State（シーン）／Singleton（FX）／Object Pool（粒子）／Observer（onStart/onResult）

three.js（15）は **UnrealBloom＋低解像度ピクセルレンダリング（ボクセル質感）＋ボクセル造形**（積みボクセルの樹・発光イコサヘドロン蕾・モノリス・発光花畑・ボクセルアヒル騎士）で全面刷新。DOM系（08/09/13/17）もタイトル/ブート画面によるScene遷移を実装（13は参考動画のアンバー端末風ブートログ）。

| PoC | 設計書 | 技術 | 検証ポイント | 操作 |
|---|---|---|---|---|
| [01_oozora-no-shuba](01_oozora-no-shuba/index.html) | [大空のしゅばぁ](../docs/01_oozora-no-shuba.md) | pixi.js | 啄み→コピー能力のデータ駆動・吸い込み演出・パララックス | ←→↑移動 / Z攻撃 / V啄み |
| [02_koyori-chemistry-rpg](02_koyori-chemistry-rpg/index.html) | [こより化学RPG](../docs/02_koyori-chemistry-rpg.md) | pixi.js | 反応式DB・弱点判定・炎色反応エフェクト・解説の教材化 | 元素を2つ選んで「詠唱」 |
| [03_holo-no-manabiya](03_holo-no-manabiya/index.html) | [ホロの学び舎](../docs/03_holo-no-manabiya.md) | pixi.js | 出題エンジン・正誤の色の文法・高度背景遷移（地中→銀河） | 答えを入力してEnter |
| [04_dennou-shoujo-rpg](04_dennou-shoujo-rpg/index.html) | [電脳少女のRPG](../docs/04_dennou-shoujo-rpg.md) | pixi.js | 属性相性ループ・領域拡大・グリッチ/走査線演出 | ユニット選択→隣接セルをクリック |
| [05_hashire-slime-kun](05_hashire-slime-kun/index.html) | [走れスライムくん](../docs/05_hashire-slime-kun.md) | pixi.js | **2Dメタボール**（blur+threshold shader）・三態の物理切替 | ←→移動 / 1液体 2固体 3気体 |
| [06_sweeper](06_sweeper/index.html) | [スイーパー](../docs/06_sweeper.md) | pixi.js | 巡回AI＋視界コーン・警戒ステート・Boids羽虫・糸の軌跡 | 矢印キー移動、触れて捕食 |
| [07_imo](07_imo/index.html) | [imo](../docs/07_imo.md) | pixi.js | 器具トリガー変身・調理法vs食材の相性・コミカル演出 | ←→移動 / Z攻撃、器具に触れて変身 |
| [08_plant-girl-horror](08_plant-girl-horror/index.html) | [植物娘育成ホラー](../docs/08_plant-girl-horror.md) | SVG+CSS | パラメータ→SVG成長の直結・攻撃性→LUT（彩度/色相）遷移 | 5つの育成ボタン×14日 |
| [09_uso-trilogy](09_uso-trilogy/index.html) | [嘘三部作](../docs/09_uso-trilogy.md) | HTML/JS | フェイク判定＋**根拠選択（メタ認知）**・時間制限・SNS風UI | 本物/フェイク→根拠を選ぶ |
| [10_ohadake-minigames](10_ohadake-minigames/index.html) | [おはだけ集](../docs/10_ohadake-minigames.md) | pixi.js | ポインタ追尾AI・ドリフト軌跡・燃料管理・逮捕→脱獄の連環 | マウスだけで運転 |
| [11_ahiru-no-sakebi](11_ahiru-no-sakebi/index.html) | [アヒルの叫び](../docs/11_ahiru-no-sakebi.md) | pixi.js+WebAudio | **マイクdB→ゲームイベント**・音波リング・声のリスク両面 | ←→移動、叫ぶ（or X長押し） |
| [12_verb-games](12_verb-games/index.html) | [動詞ゲーム集](../docs/12_verb-games.md) | pixi.js | Let'sDoThis: 刺激値→彩度フィルタ直結・「違う行動」判定 | 矢印キーで動き続ける |
| [13_cat-guard-system](13_cat-guard-system/index.html) | [猫監視システム](../docs/13_cat-guard-system.md) | Canvas+WebAudio | 動体検知→サイズ判定→通知/威嚇音・昼夜モード・定期報告 | 眺めるシミュレータ（夜切替可） |
| [15_plant-soulslike](15_plant-soulslike/index.html) | [植生ソウルライク](../docs/15_plant-soulslike.md) | three.js | 高低差移動・ダッシュ疾走感＋残像・派閥別インタラクション | WASD / Shift / Space / E / 派閥ボタン |
| [16_memory-triplet](16_memory-triplet/index.html) | [記憶トリプレット](../docs/16_memory-triplet.md) | pixi.js | 記憶3枠FIFO・3手制限・全体記憶解除・スライド移動演出 | 対象クリックで記憶→隣接マス移動 |
| [17_screen-time-family](17_screen-time-family/index.html) | [スクリーンタイム](../docs/17_screen-time-family.md) | React | 選択→遅延「本音」表示・隠しパラメータED分岐・彩度演出 | 選択肢クリック×7日 |

※ 14（その他構想集）はアイデア台帳のためPoC対象外。個別に昇格した時点で作成する。

## 起動方法

```powershell
# エクスプローラーからダブルクリックでOK。ローカルサーバーを立てる場合:
cd poc
python -m http.server 8000
# → http://localhost:8000/01_oozora-no-shuba/ など
```

- 11 のマイク機能は `http://localhost` か `file://` では動くブラウザと動かないブラウザがあるため、不可時は**X長押し**の代替操作を使用
- 13 の威嚇音はブラウザの自動再生制限により、初回はページ内クリック後に鳴る

## 本実装への移行方針

| PoC | 次のステップ |
|---|---|
| 01/04/06/07 | Unityへ移植（2Dアクション・RPG基盤） |
| 02/03 | Unity本実装（データ量産はCSV/SO化） |
| 05 | Unity＋メタボールシェーダー（PoCの2D表現を3D化） |
| 08/09/12/16 | **同一スタックのまま拡張**（Web完結） |
| 10 | HTML5のまま脱獄編（RanAway）を追加 |
| 11 | Unity＋Pythonサイドカーで語認識を追加（PoCは音量のみ） |
| 13 | Raspberry Pi実機＋OpenCVへ（PoCは判定ロジックの仕様書代わり） |
| 15 | Unity移植（戦闘・パリィはUnityで検証） |
| 17 | Next.js化してWeb公開 |
