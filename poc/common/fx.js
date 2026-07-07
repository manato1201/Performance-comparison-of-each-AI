/**
 * FX — PoC共通ビジュアル基盤（pixi.js v7用・classic script）
 *
 * 参考: X参考動画群（暗背景×グロー×粒子×精緻UI）/ unitydesignpatterns.com
 * 適用デザインパターン:
 *  - State        : タイトル→プレイ→リザルトのシーン遷移
 *  - Singleton    : window.FX
 *  - Object Pool  : アンビエント粒子・バーストのプール
 *  - Observer     : シーン変更コールバック(onStart/onResult)
 *
 * 提供機能:
 *  - FX.attach(app, opts) : タイトルシーン＋ポストFX(ブルーム/CRT/ビネット)装着
 *  - ピクセルディゾルブ遷移（モザイクshaderのsizeを山なりにアニメーション）
 *  - FX.result(opts)      : リザルトシーン（クリックでリトライ）
 *  - FX.playing           : ゲーム側tickerのゲートに使うフラグ
 *  - Pキー                : ピクセル化(ボクセル風)モードのトグル
 */
(function(){
  'use strict';

  // ---- カスタムシェーダー ----
  const FRAG_CRT = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform float uTime;
    uniform float uCrt;
    void main(void){
      vec2 uv = vTextureCoord;
      // 色収差
      float ca = 0.0016 * uCrt;
      vec3 col;
      col.r = texture2D(uSampler, uv + vec2(ca, 0.)).r;
      col.g = texture2D(uSampler, uv).g;
      col.b = texture2D(uSampler, uv - vec2(ca, 0.)).b;
      // 走査線
      col *= 1.0 - uCrt * 0.10 * (0.5 + 0.5 * sin(uv.y * 720.0 + uTime * 2.4));
      // ビネット
      float d = distance(uv, vec2(0.5));
      col *= 1.0 - d * d * (0.62 * uCrt);
      // ほんのり持ち上げ（黒潰れ防止）
      col += 0.012;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const FRAG_PIXEL = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler;
    uniform vec2 uRes;
    uniform float uSize;
    void main(void){
      vec2 uv = vTextureCoord;
      if (uSize > 1.0) {
        uv = (floor(uv * uRes / uSize) + 0.5) * uSize / uRes;
      }
      gl_FragColor = texture2D(uSampler, uv);
    }`;

  const state = {
    app: null, scene: 'title', playing: false,
    overlay: null, pixFilter: null, crtFilter: null,
    trans: 0, transDir: 0, afterTrans: null,
    hint: null, titleParts: [], pool: [],
    retro: false, opts: {},
  };

  function hex(n){ return '#' + n.toString(16).padStart(6, '0'); }

  // ---- Object Pool: 粒子 ----
  function getParticle(container){
    let p = state.pool.pop();
    if (!p) {
      p = new PIXI.Graphics();
    }
    container.addChild(p);
    return p;
  }
  function freeParticle(p){
    if (p.parent) p.parent.removeChild(p);
    p.clear();
    state.pool.push(p);
  }

  function attach(app, opts){
    state.app = app; state.opts = opts = Object.assign({
      title: 'PoC', sub: '', accent: 0xffe46d, accent2: 0x6d9bcc,
      hint: 'クリック / 任意のキーでスタート', crt: 1.0, bloom: true,
      ambient: true, onStart: null,
    }, opts || {});
    const W = app.renderer.width / app.renderer.resolution;
    const H = app.renderer.height / app.renderer.resolution;

    // ---- ポストFX（ブルーム→CRT→ピクセル） ----
    const filters = (app.stage.filters || []).slice();
    if (opts.bloom && PIXI.filters && PIXI.filters.AdvancedBloomFilter) {
      filters.push(new PIXI.filters.AdvancedBloomFilter({
        threshold: opts.bloomThreshold != null ? opts.bloomThreshold : 0.55,
        bloomScale: opts.bloomScale != null ? opts.bloomScale : 0.9,
        brightness: 1.0, blur: 7, quality: 4,
      }));
    }
    state.crtFilter = new PIXI.Filter(undefined, FRAG_CRT, { uTime: 0, uCrt: opts.crt });
    state.pixFilter = new PIXI.Filter(undefined, FRAG_PIXEL, { uRes: new Float32Array([W, H]), uSize: 1 });
    filters.push(state.crtFilter, state.pixFilter);
    app.stage.filters = filters;
    app.stage.filterArea = app.renderer.screen;

    // ---- タイトルオーバーレイ ----
    const ov = new PIXI.Container();
    state.overlay = ov;
    const dim = new PIXI.Graphics();
    for (let i = 0; i < 24; i++) { // 縦グラデーション
      const t = i / 23;
      const c = PIXI.utils.rgb2hex([0.02 + t*0.05, 0.02 + t*0.03, 0.06 + t*0.10]);
      dim.beginFill(c, 0.96).drawRect(0, i*H/24, W, H/24 + 1).endFill();
    }
    ov.addChild(dim);
    // グローオーブ（参考動画のノードグロー風）
    for (let i = 0; i < 10; i++) {
      const o = new PIXI.Graphics();
      const col = i % 2 ? opts.accent : opts.accent2;
      for (let r = 5; r > 0; r--) o.beginFill(col, 0.05 * r).drawCircle(0, 0, 6 + (5 - r) * 7).endFill();
      o.beginFill(0xffffff, .9).drawCircle(0, 0, 2.5).endFill();
      o.position.set(Math.random() * W, Math.random() * H);
      o._spd = .1 + Math.random() * .3; o._ph = Math.random() * 9;
      ov.addChild(o); state.titleParts.push(o);
    }
    const tShadow = new PIXI.Text(opts.title, { fontFamily: 'Yu Gothic UI', fontSize: 52, fontWeight: '900', fill: opts.accent2 });
    tShadow.anchor.set(.5); tShadow.position.set(W/2 + 3, H/2 - 40 + 3); tShadow.alpha = .55;
    const tMain = new PIXI.Text(opts.title, {
      fontFamily: 'Yu Gothic UI', fontSize: 52, fontWeight: '900', fill: 0xffffff,
      dropShadow: true, dropShadowColor: opts.accent, dropShadowBlur: 18, dropShadowDistance: 0,
    });
    tMain.anchor.set(.5); tMain.position.set(W/2, H/2 - 40);
    const tSub = new PIXI.Text(opts.sub, { fontFamily: 'Yu Gothic UI', fontSize: 15, fill: hex(opts.accent) });
    tSub.anchor.set(.5); tSub.position.set(W/2, H/2 + 8);
    const rule = new PIXI.Graphics();
    rule.beginFill(opts.accent, .8).drawRect(W/2 - 130, H/2 + 26, 260, 2).endFill();
    state.hint = new PIXI.Text(opts.hint, { fontFamily: 'Yu Gothic UI', fontSize: 14, fill: 0xffffff });
    state.hint.anchor.set(.5); state.hint.position.set(W/2, H/2 + 52);
    ov.addChild(tShadow, tMain, tSub, rule, state.hint);
    app.stage.addChild(ov);

    // ---- アンビエント粒子（プレイ中の空気感・8co28の火の粉風） ----
    state.ambientLayer = new PIXI.Container();
    app.stage.addChildAt(state.ambientLayer, app.stage.getChildIndex(ov));
    state.embers = [];

    // ---- 入力（シーンState遷移） ----
    const start = () => {
      if (state.scene !== 'title' || state.transDir !== 0) return;
      transition(() => {
        ov.visible = false;
        state.scene = 'play'; state.playing = true;
        if (opts.onStart) opts.onStart();
      });
    };
    app.view.addEventListener('pointerdown', () => {
      if (state.scene === 'title') start();
      else if (state.scene === 'result') location.reload();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') { state.retro = !state.retro; return; }
      if (state.scene === 'title') start();
      else if (state.scene === 'result' && e.code === 'KeyR') location.reload();
    });

    // ---- FX専用ticker ----
    app.ticker.add((dt) => {
      const now = performance.now();
      state.crtFilter.uniforms.uTime = now / 1000;
      // ピクセルディゾルブ遷移（山なり）
      if (state.transDir !== 0) {
        state.trans += state.transDir * .06 * dt;
        if (state.trans >= 1) { state.trans = 1; state.transDir = -1; if (state.afterTrans) { state.afterTrans(); state.afterTrans = null; } }
        if (state.trans <= 0) { state.trans = 0; state.transDir = 0; }
      }
      const base = state.retro ? 5 : 1;
      state.pixFilter.uniforms.uSize = base + Math.pow(state.trans, 1.6) * 30;
      // タイトルオーブ
      if (ov.visible) for (const o of state.titleParts) {
        o.y -= o._spd * dt; o.x += Math.sin(now/1400 + o._ph) * .3 * dt;
        o.alpha = .5 + Math.sin(now/600 + o._ph) * .4;
        if (o.y < -30) o.y = H + 20;
      }
      if (state.hint) state.hint.alpha = .45 + Math.sin(now/350) * .45;
      // アンビエント火の粉
      if (opts.ambient && state.playing && Math.random() < .1 * dt) {
        const p = getParticle(state.ambientLayer);
        const col = Math.random() < .5 ? opts.accent : 0xffffff;
        p.beginFill(col, .8).drawCircle(0, 0, 1 + Math.random() * 2).endFill();
        p.position.set(Math.random() * W, H + 8);
        p._vy = -(.3 + Math.random() * .6); p._vx = (Math.random() - .5) * .3;
        p._life = 1; p._ph = Math.random() * 9;
        state.embers.push(p);
      }
      for (let i = state.embers.length - 1; i >= 0; i--) {
        const p = state.embers[i];
        p.y += p._vy * dt; p.x += (p._vx + Math.sin(now/900 + p._ph) * .2) * dt;
        p._life -= .0035 * dt; p.alpha = Math.max(0, p._life) * (.4 + Math.sin(now/300 + p._ph) * .3);
        if (p._life <= 0 || p.y < -10) { freeParticle(p); state.embers.splice(i, 1); }
      }
    });
    return state;
  }

  function transition(after){
    state.trans = 0; state.transDir = 1; state.afterTrans = after;
  }

  function result(opts){
    opts = Object.assign({ title: 'RESULT', lines: [], accent: state.opts.accent }, opts || {});
    if (state.scene === 'result') return;
    const app = state.app;
    const W = app.renderer.width / app.renderer.resolution;
    const H = app.renderer.height / app.renderer.resolution;
    transition(() => {
      state.playing = false; state.scene = 'result';
      const ov = state.overlay;
      ov.removeChildren();
      const dim = new PIXI.Graphics();
      dim.beginFill(0x05060f, .88).drawRect(0, 0, W, H).endFill();
      ov.addChild(dim);
      const tt = new PIXI.Text(opts.title, {
        fontFamily: 'Yu Gothic UI', fontSize: 44, fontWeight: '900', fill: 0xffffff,
        dropShadow: true, dropShadowColor: opts.accent, dropShadowBlur: 16, dropShadowDistance: 0,
      });
      tt.anchor.set(.5); tt.position.set(W/2, H/2 - 60);
      ov.addChild(tt);
      opts.lines.forEach((ln, i) => {
        const t = new PIXI.Text(ln, { fontFamily: 'Yu Gothic UI', fontSize: 16, fill: hex(opts.accent) });
        t.anchor.set(.5); t.position.set(W/2, H/2 - 8 + i * 26);
        ov.addChild(t);
      });
      state.hint = new PIXI.Text('クリック / Rキーでリトライ', { fontFamily: 'Yu Gothic UI', fontSize: 14, fill: 0xffffff });
      state.hint.anchor.set(.5); state.hint.position.set(W/2, H/2 + 30 + opts.lines.length * 26);
      ov.addChild(state.hint);
      ov.visible = true;
    });
  }

  window.FX = {
    attach, result, transition,
    get playing(){ return state.playing; },
    get scene(){ return state.scene; },
  };

  // ==============================================================
  // FXS — プロシージャル複雑シェイプ集（○□△を卒業するための部品箱）
  //   すべて PIXI.Graphics に描き込むヘルパー。seedで形が決定論的に決まる
  // ==============================================================
  function rng(seed){ let a = seed >>> 0 || 1;
    return function(){ a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  window.FXS = {
    rng,
    // 多層グローオーブ（ネオンの発光コア）
    glowOrb(g, color, r, core = 0xffffff, cx = 0, cy = 0){
      for (let i = 5; i > 0; i--) g.beginFill(color, 0.06 * i).drawCircle(cx, cy, r * (1 + (5 - i) * .45)).endFill();
      g.beginFill(color, .95).drawCircle(cx, cy, r * .62).endFill();
      g.beginFill(core, .9).drawCircle(cx - r * .18, cy - r * .18, r * .26).endFill();
      return g;
    },
    // 有機ブロブ（ベジェ閉曲線・seedで凸凹が決まる）
    blob(g, color, r, points = 9, jitter = .3, seed = 1, alpha = 1, cx = 0, cy = 0){
      const rand = rng(seed), pts = [];
      for (let i = 0; i < points; i++){
        const a = i / points * Math.PI * 2;
        const rr = r * (1 - jitter / 2 + rand() * jitter);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      g.beginFill(color, alpha);
      g.moveTo((pts[0][0] + pts[points - 1][0]) / 2, (pts[0][1] + pts[points - 1][1]) / 2);
      for (let i = 0; i < points; i++){
        const p = pts[i], n = pts[(i + 1) % points];
        g.quadraticCurveTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2);
      }
      g.closePath().endFill();
      return g;
    },
    // 結晶（不等辺ファセット多面体＋稜線ハイライト）
    crystal(g, color, r, facets = 6, seed = 2, cx = 0, cy = 0){
      const rand = rng(seed), pts = [];
      for (let i = 0; i < facets; i++){
        const a = i / facets * Math.PI * 2 - Math.PI / 2;
        const rr = r * (.7 + rand() * .5);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      g.beginFill(color, .95).drawPolygon(pts.flat()).endFill();
      for (let i = 0; i < facets; i++){
        const p = pts[i], n = pts[(i + 1) % facets];
        g.beginFill(i % 2 ? 0xffffff : 0x000000, i % 2 ? .18 : .12)
         .drawPolygon([cx, cy, p[0], p[1], n[0], n[1]]).endFill();
      }
      g.lineStyle(1, 0xffffff, .5);
      for (const p of pts) g.moveTo(cx, cy).lineTo(p[0], p[1]);
      g.lineStyle(0);
      return g;
    },
    // 花（ベジェ花弁×コア。参考動画の花畑向け）
    flower(g, petalCol, coreCol, r, petals = 6, seed = 3, cx = 0, cy = 0){
      const rand = rng(seed);
      for (let i = 0; i < petals; i++){
        const a = i / petals * Math.PI * 2 + rand() * .2;
        const len = r * (.85 + rand() * .3), wid = r * .42;
        const ca = Math.cos(a), sa = Math.sin(a);
        g.beginFill(petalCol, .95);
        g.moveTo(cx, cy);
        g.bezierCurveTo(cx + ca * len * .3 - sa * wid, cy + sa * len * .3 + ca * wid,
                        cx + ca * len - sa * wid * .5, cy + sa * len + ca * wid * .5, cx + ca * len, cy + sa * len);
        g.bezierCurveTo(cx + ca * len + sa * wid * .5, cy + sa * len - ca * wid * .5,
                        cx + ca * len * .3 + sa * wid, cy + sa * len * .3 - ca * wid, cx, cy);
        g.closePath().endFill();
      }
      g.beginFill(coreCol).drawCircle(cx, cy, r * .28).endFill();
      g.beginFill(0xffffff, .8).drawCircle(cx - r * .08, cy - r * .08, r * .12).endFill();
      return g;
    },
    // 歯車（スチーム/メカ用）
    gear(g, color, r, teeth = 8, cx = 0, cy = 0){
      const pts = [];
      for (let i = 0; i < teeth * 2; i++){
        const a = i / (teeth * 2) * Math.PI * 2;
        const rr = i % 2 ? r : r * .74;
        pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.beginFill(color).drawPolygon(pts).endFill();
      g.beginHole().drawCircle(cx, cy, r * .3).endHole();
      return g;
    },
    // 関節つき脚（クモ・生物用の二次ベジェ）
    limb(g, color, w, x0, y0, x1, y1, x2, y2){
      g.lineStyle({ width: w, color, cap: PIXI.LINE_CAP.ROUND });
      g.moveTo(x0, y0).quadraticCurveTo(x1, y1, x2, y2);
      g.lineStyle(0);
      return g;
    },
    // トゲトゲバースト（爆発・棘）
    burstStar(g, color, r, spikes = 10, inner = .45, seed = 5, cx = 0, cy = 0){
      const rand = rng(seed), pts = [];
      for (let i = 0; i < spikes * 2; i++){
        const a = i / (spikes * 2) * Math.PI * 2;
        const rr = (i % 2 ? r : r * inner) * (.85 + rand() * .3);
        pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.beginFill(color).drawPolygon(pts).endFill();
      return g;
    },
    // 葉っぱ（付け根(cx,cy)から伸びるベジェ葉）
    leaf(g, color, len, wid, bend = .3, cx = 0, cy = 0){
      g.beginFill(color);
      g.moveTo(cx, cy);
      g.bezierCurveTo(cx + len * .3, cy - wid - len * bend * .3, cx + len * .8, cy - wid * .6, cx + len, cy - len * bend);
      g.bezierCurveTo(cx + len * .8, cy + wid * .2, cx + len * .3, cy + wid * .5, cx, cy);
      g.closePath().endFill();
      return g;
    },
  };
})();
