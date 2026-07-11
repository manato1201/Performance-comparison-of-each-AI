/**
 * フロア生成の自動テスト — `node tests.mjs` で実行（外部依存なし）
 *
 * 1. 全床タイル接続性（flood fill）
 * 2. 同一seed決定性（2回生成でJSON一致）
 * 3. ループ存在（edges >= rooms-1 + 1）
 * 4. ボス深部性（bossDepth >= 最大depthの70%）
 * 5. 60部屋の生成速度（< 500ms）
 * 各テストは5つのseedで実施する。
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { generateFloor, TILE } = require('./floorgen.js');

const SEEDS = [1, 42, 777, 20260708, 99991];
let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✅ ${name} ${detail}`); }
  else    { fail++; console.log(`  ❌ ${name} ${detail}`); }
}

// ---- 1. 接続性 ----
console.log('\n[1] 全床タイル接続性（flood fill）');
for (const seed of SEEDS) {
  const f = generateFloor(seed, { roomCount: 25 });
  const g = f.grid, H = g.length, W = g[0].length;
  const walkable = v => v === TILE.FLOOR || v === TILE.DOOR;
  let total = 0, sx = -1, sy = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (walkable(g[y][x])) { total++; if (sx < 0) { sx = x; sy = y; } }
  const seen = new Set([sy * W + sx]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy, k = ny * W + nx;
      if (nx>=0 && ny>=0 && nx<W && ny<H && !seen.has(k) && walkable(g[ny][nx])) { seen.add(k); q.push([nx,ny]); }
    }
  }
  check(`seed=${seed}`, seen.size === total, `(到達 ${seen.size}/${total})`);
}

// ---- 2. 決定性 ----
console.log('\n[2] 同一seed決定性');
for (const seed of SEEDS) {
  const a = JSON.stringify(generateFloor(seed, { roomCount: 25 }), (k,v)=>k==='genMs'?0:v);
  const b = JSON.stringify(generateFloor(seed, { roomCount: 25 }), (k,v)=>k==='genMs'?0:v);
  check(`seed=${seed}`, a === b);
}

// ---- 3. ループ存在 ----
console.log('\n[3] ループ存在（グラフが木より濃い）');
for (const seed of SEEDS) {
  const f = generateFloor(seed, { roomCount: 25 });
  const loops = f.edges.filter(e => e.isLoop).length;
  check(`seed=${seed}`, f.edges.length >= f.rooms.length - 1 + 1 && loops >= 1,
        `(部屋${f.rooms.length} 辺${f.edges.length} ループ${loops})`);
}

// ---- 4. ボス深部性 ----
console.log('\n[4] ボスが深部にいる（depth >= 最深の70%）');
for (const seed of SEEDS) {
  const f = generateFloor(seed, { roomCount: 25 });
  const boss = f.rooms.find(r => r.id === f.meta.bossRoomId);
  check(`seed=${seed}`, boss && boss.depth >= f.meta.maxDepth * 0.7,
        `(boss depth ${boss ? boss.depth : '?'}/${f.meta.maxDepth})`);
}

// ---- 5. 生成速度 ----
console.log('\n[5] 60部屋の生成速度（< 500ms）');
for (const seed of SEEDS) {
  const t0 = performance.now();
  const f = generateFloor(seed, { roomCount: 60 });
  const ms = performance.now() - t0;
  check(`seed=${seed}`, ms < 500 && f.rooms.length === 60, `(${ms.toFixed(1)}ms, 部屋${f.rooms.length})`);
}

console.log(`\n==== 結果: ${pass} PASS / ${fail} FAIL ====`);
process.exit(fail ? 1 : 0);
