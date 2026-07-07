---
marp: true
theme: default
paginate: true
header: "ゲーム設計書 全体概要"
footer: "出典: ゲーム案.txt ／ 配色: kotonoha_sai ／ レベルデザイン理論: C.Totten"
style: |
  :root {
    --shinonome1: #ebcfd2; --shinonome2: #d996c0; --shinonome3: #898bbe;
    --shinonome4: #6d9bcc; --shinonome5: #126cb1; --shinonome6: #09397a;
  }
  section {
    background: linear-gradient(160deg, #ffffff 75%, var(--shinonome1));
    font-family: "Yu Gothic UI", "Noto Sans JP", sans-serif;
  }
  section h1 { color: var(--shinonome6); border-bottom: 4px solid var(--shinonome2); }
  section h2 { color: var(--shinonome5); }
  section strong { color: var(--shinonome5); }
  section table { font-size: 0.72em; }
  section.lead h1 { font-size: 2.2em; border: none; text-align: center; }
  section.lead p { text-align: center; }
  .chip { display:inline-block; width:1.1em; height:1.1em; border-radius:3px;
          vertical-align:middle; border:1px solid #ccc; }
  .env { display:inline-block; padding:0 .6em; border-radius:10px;
         background:var(--shinonome5); color:#fff; font-size:.8em; }
---

<!-- _class: lead -->

# 🎮 ゲーム設計書 全体概要

**全18案 ─ 差別化 × 技術要素 × 制作環境**

詳細は `docs/00_INDEX.md` から各設計書へ（15〜17は `poc/` に動くプロトタイプあり）

---

# ポートフォリオ全体図

| 群 | タイトル | 規模 |
|---|---|---|
| 本命（ホロ二次創作） | 大空のしゅばぁ | 大 |
| 教育×エンタメ | こより化学RPG／ホロの学び舎 | 中〜大 |
| 収集RPG | 電脳少女のRPG | 大 |
| オリジナルACT | 走れスライムくん／スイーパー／imo | 中 |
| ナラティブ | 植物娘ホラー／嘘三部作 | 中 |
| 技術実証 | アヒルの叫び（音声認識） | 中 |
| 量産ライン | おはだけ集／動詞ゲーム12本 | 小 |
| 非ゲーム | 猫監視・撃退システム | 小 |
| 追加案（PoCあり） | 植生ソウルライク／記憶トリプレット／スクリーンタイム | 中〜大 |

---

# 01 大空のしゅばぁ <span class="env">Unity</span>

**カービィライク × キャラ切替（4人×2形態）**

- 差別化: コピー能力ゲーに「誰でコピーするか」の縦軸。知識吸収のリスク管理
- 技術: コピー能力のデータ駆動化／二段変身ステートマシン／FamiTracker チップチューン
- 6面×5ステージ、itch.io配布、アプデ＋引継ぎ前提
- 配色: 花鳥風月 <span class="chip" style="background:#ffe46d"></span><span class="chip" style="background:#d08907"></span><span class="chip" style="background:#f8ccd1"></span><span class="chip" style="background:#95c0b9"></span><span class="chip" style="background:#2e9ea2"></span> ＋ 面別6パレット

---

# 02 博衣こよりと始まりの魔法使い <span class="env">Unity</span>

**化学式＝呪文のRPG**

- 差別化: 「教科書の反応式がそのまま攻略Wikiになる」。失敗反応も教材
- 技術: 反応式DB（データ駆動）／周期表UI／炎色反応エフェクト
- レベル: ラボをハブとする放射状ワールド（Totten Ch4 ハブ型）
- 配色: 天弓 <span class="chip" style="background:#f4afa4"></span><span class="chip" style="background:#ec759e"></span><span class="chip" style="background:#fdda83"></span><span class="chip" style="background:#67c1af"></span><span class="chip" style="background:#18a5d3"></span><span class="chip" style="background:#156fb3"></span>（虹＝スペクトル）

---

# 03 ホロの学び舎 <span class="env">Unity / WPF</span>

**教科ごとにジャンルが変わる学習ゲーム（小学生向け）**

- 国=文字インベーダー／社=幸福度すごろく／数=計算バトル／英=単語ダンジョン
- 差別化: ドリルでなく「ジャンル適合」。ホロメンボイスが発音・解説まで担当
- 一教科からリリース可能なモジュール構成。背景は 地中→…→銀河 に進化
- 配色: 麗か ＋ 高度別6パレット <span class="chip" style="background:#ffdf5e"></span><span class="chip" style="background:#5baedb"></span><span class="chip" style="background:#004492"></span>

---

# 04 電脳少女のRPG <span class="env">Unity</span>

**電波人間のRPGオマージュ × 推し属性収集**

- 差別化: ファン知識＝属性表。電脳桜神社の領域拡大メタゲーム
- 技術: 属性・状態異常エンジン／QRパーティ交換／ミニゲーム2種同梱
- 配色: 星合いの空 <span class="chip" style="background:#fff2ad"></span><span class="chip" style="background:#b9a0cb"></span><span class="chip" style="background:#5391c8"></span><span class="chip" style="background:#004492"></span><span class="chip" style="background:#0f1d3e"></span>

---

# 05 走れスライムくん <span class="env">Unity</span>

**気体・液体・固体の三態変化 × 時間制限謎解き**

- 差別化: HP＝運搬物＝移動能力＝「自分の体積」に統一
- 技術: メタボールシェーダー／物理特性切替／引っ張り射出
- レベル: 空間サイズと形態の対応（Totten Ch4）、日なた=危険・日陰=避難（Ch6）
- 配色: 泡沫 <span class="chip" style="background:#fff4d1"></span><span class="chip" style="background:#fad7d2"></span><span class="chip" style="background:#9aced8"></span><span class="chip" style="background:#5db3c9"></span><span class="chip" style="background:#1572a3"></span>

---

# 06 スイーパー <span class="env">Unity</span>

**蜘蛛＝益虫の非対称ステルス捕食アクション**

- 差別化: 一軒家を丸ごとダンジョン化。住人は倒せない「動く壁」
- 技術: 壁天井歩行／糸物理／住人ルーチンAI／Boidsの羽虫
- レベル: 眺望と避難の反転 — 床こそ危険地帯（Totten Ch6）
- 配色: 終夜 <span class="chip" style="background:#e2d0c6"></span><span class="chip" style="background:#72818c"></span><span class="chip" style="background:#487589"></span><span class="chip" style="background:#0a224b"></span> ＋ 警戒赤 <span class="chip" style="background:#c65244"></span>

---

# 07 imo <span class="env">Unity</span>

**調理法＝ジョブチェンジの芋の王子様RPG**

- 差別化: ゆで・揚げ・凍結…台所器具がダンジョンギミック＝変身装置
- 敵は芋科縛り（自然薯・こんにゃく芋・じゃがアリゴ=擬態）
- レベル: 畑→台所→食卓の「食材の一生」を英雄の旅に写像（Totten Ch9）
- 配色: 最中の月 <span class="chip" style="background:#fee59f"></span><span class="chip" style="background:#c8b5b3"></span><span class="chip" style="background:#445c8d"></span><span class="chip" style="background:#091139"></span>

---

# 08 植物娘育成ホラー <span class="env">Unity</span>

**「手放すこと」がゴールの育成×ホラー**

- 差別化: ホラーが演出でなく育成パラメータの帰結。過保護も放任も破滅
- 技術: 植物×精神の相互作用行列／LUT遷移／進捗率分岐ED（不穏カットイン）
- 配色: 草青む <span class="chip" style="background:#c8e3bd"></span><span class="chip" style="background:#5ea589"></span> → ホラー時 焦がれる <span class="chip" style="background:#da2730"></span><span class="chip" style="background:#4e0003"></span>

---

# 09 嘘三部作 <span class="env">HTML5</span>

**嘘を「つく・生きる・見抜く」の三面から解剖**

- イリュージョン・プレイ（仮面×自己喪失）／ザ・ラスト・ディセプション（嘘人生シム）／フィクション・ハンター（フェイクニュース対策官）
- 技術: ノードベース対話／嘘の整合性DB／疑似SNSフィード
- 配色: 依怙地基調 <span class="chip" style="background:#c8ced0"></span><span class="chip" style="background:#475a61"></span> ＋ 作品別アクセント

---

# 10 おはだけ＆ミニゲーム集 <span class="env">HTML5</span>

**月産1本のスコアアタック集（技術練習を兼ねる）**

- テニスVS NPC／二軸ブロック崩し／的当て王／CarChase／RanAway／トイレッツ
- 発明: **逮捕編→脱獄編**の連環（ゲームオーバーが次のゲームの開始）
- 技術: 追尾AI／ジャストヒット判定／ゲージ設計／共通ランチャー
- 配色: 戯れ <span class="chip" style="background:#fdd000"></span><span class="chip" style="background:#f19db5"></span><span class="chip" style="background:#89c997"></span><span class="chip" style="background:#9fd9f6"></span>

---

# 11 アヒルの叫び <span class="env">Unity＋Python</span>

**声がアビリティのメトロイドヴァニア**

- 差別化: 声量と語が探索の鍵。配信者が遊ぶと画面外まで面白い
- 技術知見: MS API=ラグで断念／Vosk=ビルド地獄で断念／**Python連携=現行**
- ローカルワード辞書＋dB計測、キーボード完結の代替操作も用意
- 配色: 霹靂 <span class="chip" style="background:#ffeca6"></span><span class="chip" style="background:#83c2e2"></span><span class="chip" style="background:#49afd3"></span><span class="chip" style="background:#082f50"></span>

---

# 12 動詞ゲーム集（12本） <span class="env">Unity / HTML5</span>

**動詞からゲームを作る量産ライン**

- Let'sDoThis（行動＝彩度＝生命）／俺色に染まれ／呪殺／ムジュン／SHODO／金剛石ガ砕けない／幽体観光／ワイヤーキング…
- 差別化: 動詞にない機能は実装しない、というスコープ管理の仕組み化
- 技術資産を連鎖させる開発順（物理→ロープ→ステルス、彩度→塗り）

---

# 13 猫監視・撃退システム <span class="env">RasPi＋Qt</span>

**動体検知で人／猫を判別し、撮影・通知・威嚇**

- 猫→写真通知＋掃除機音で威嚇、人→写真通知、30秒〜1分の定期報告
- 部品: CdSセル・温度センサー・LED（＋カメラ・スピーカー）
- 技術: OpenCV差分検知／サイズ判定／LINE・Discord通知／SQLiteログ

---

# 14 その他構想集（熟成庫）

- 頭脳チェイス（逃走×裁判）／精神状態視界ゲーム／本の世界メトロイドヴァニア
- ChatGPT NPC会話／TTS探索ゲーム／お絵描き魔法（AI判別）
- ホロ派生: ホロクエスト・ホロカート・micomet経営 ほか
- 運用: 第一次メモ→台帳整理→**寝かせる**→設計書昇格（思考の整理学準拠）

---

# 15 植生ソウルライク（仮題: VERDANT） <span class="env">Unity（PoC: three.js）</span>

**全ての敵と「戦う・飼う・組む・奪う・奪われる」が選べるスピードソウルライク**

- 5派閥: 自生／群生（餌で使役）／共生（好感度上限）／支配（侵食リスク）／寄生（敗北がビルドになる）
- 高低差×疾走感（移動でスタミナが減らない）。攻撃した種は**敵対進化**して学習する
- 配色: 山滴る <span class="chip" style="background:#c2da75"></span><span class="chip" style="background:#48a772"></span><span class="chip" style="background:#018573"></span><span class="chip" style="background:#00512e"></span> ＋ 敵対の赤 <span class="chip" style="background:#b33033"></span>

---

# 16 記憶トリプレット <span class="env">HTML5 (pixi.js)</span>

**「三つしか覚えられない」錯視×錯聴の詰将棋パズル**

- 記憶3枠FIFO（4つ目で最初を忘れる）＋3手クリア制限＋全体記憶アイテム
- 明ステージ=錯視（ミュラー・リヤー／エビングハウス／コフカのリング／色の対比…）
- 暗ステージ=錯聴（両耳ビート／先行音効果／ファントムセンセーション…）
- 配色: 黄昏時 <span class="chip" style="background:#f7df51"></span><span class="chip" style="background:#eab031"></span><span class="chip" style="background:#513738"></span> ＋ 月の雫（暗モード）

---

# 17 スクリーンタイム <span class="env">HTML5 (React/Next.js)</span>

**同じ一週間を親と子の両方で二度生きる、“取り上げない”依存対策ADV**

- ターゲット: 小学生の弟妹がいる10〜20代のゲーム好き（親でも子でもない第三の当事者）
- 選択は常に3系統: 強要／放任／工夫 — 表メーターは動くが**「本音の距離」だけがEDを決める**
- 誰も悪者にしない。ゲーム自体も悪ではない、が出発点
- 配色: 玉響 <span class="chip" style="background:#ffefc8"></span><span class="chip" style="background:#e9a3c0"></span><span class="chip" style="background:#a7dae1"></span> — 溝が深まるほど家の彩度が落ちる

---

<!-- _class: lead -->

# 共通方針まとめ

**レベルデザイン**: Totten『レベルデザインの教科書』— 分子構造図・眺望と避難・報酬の拒絶・Level 1-1理論

**配色**: kotonoha_sai の名前付き和風パレットを各作品の世界観に割当て

**制作環境の基本方針**: アクション＝Unity／UI・Web系＝HTML5／IoT＝RasPi+Qt／UEとWinFormsは今回は非採用
