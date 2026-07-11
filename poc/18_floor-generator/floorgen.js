/*
 * floorgen.js — ダンジョンフロア完全自動生成（純データ・データ駆動）
 *
 * 設計思想: 「いきなり見た目を作らない」。
 * generateFloor(seed, opts) は純関数で、描画に依存しない
 * { seed, rooms, edges, grid, props, spawns, meta } を返す。
 *
 * パイプライン:
 *   1. seed付き乱数 (mulberry32)
 *   2. 部屋のランダム配置 → AABB分離
 *   3. Delaunay三角分割 (Bowyer-Watson 自前実装)
 *   4. MST (Kruskal)
 *   5. 非MST辺の12〜15%をループ辺として追加
 *   6. L字通路をgridに彫る（床/壁/扉）
 *   7. 装飾 (松明/柱/宝箱)
 *   8. 敵配置＋難易度 (BFS深度でtier上昇、ボスは最深部屋)
 *
 * ブラウザ/Node両対応の classic script（ESM構文なし）。
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // 1. 乱数 (mulberry32)
  // ---------------------------------------------------------------
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // seedは数値/文字列どちらでも可（文字列はFNV-1aでハッシュ）
  function hashSeed(seed) {
    if (typeof seed === 'number' && isFinite(seed)) return seed >>> 0;
    var s = String(seed);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ---------------------------------------------------------------
  // 2. 部屋配置 + AABB分離
  // ---------------------------------------------------------------
  function placeRooms(rng, count) {
    var rooms = [];
    var spread = Math.ceil(Math.sqrt(count) * 9);
    for (var i = 0; i < count; i++) {
      var big = rng() < 0.18;
      var w = big ? 9 + Math.floor(rng() * 5) : 4 + Math.floor(rng() * 5);
      var h = big ? 9 + Math.floor(rng() * 5) : 4 + Math.floor(rng() * 5);
      rooms.push({
        id: i,
        fx: rng() * spread,
        fy: rng() * spread,
        w: w,
        h: h
      });
    }

    // 浮動小数点での反復分離（重なり + 最低ギャップ2）
    var GAP = 2;
    for (var iter = 0; iter < 400; iter++) {
      var moved = false;
      for (var a = 0; a < rooms.length; a++) {
        for (var b = a + 1; b < rooms.length; b++) {
          var A = rooms[a], B = rooms[b];
          var acx = A.fx + A.w / 2, acy = A.fy + A.h / 2;
          var bcx = B.fx + B.w / 2, bcy = B.fy + B.h / 2;
          var hx = (A.w + B.w) / 2 + GAP;
          var hy = (A.h + B.h) / 2 + GAP;
          var dx = bcx - acx, dy = bcy - acy;
          var ox = hx - Math.abs(dx);
          var oy = hy - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            moved = true;
            if (ox < oy) {
              var sx = dx >= 0 ? 1 : -1;
              if (dx === 0) sx = rng() < 0.5 ? 1 : -1;
              var px = (ox / 2 + 0.05) * sx;
              A.fx -= px; B.fx += px;
            } else {
              var sy = dy >= 0 ? 1 : -1;
              if (dy === 0) sy = rng() < 0.5 ? 1 : -1;
              var py = (oy / 2 + 0.05) * sy;
              A.fy -= py; B.fy += py;
            }
          }
        }
      }
      if (!moved) break;
    }

    // 整数化 + 残存重なりの解消（最低1タイルの隙間を保証）
    for (var r = 0; r < rooms.length; r++) {
      rooms[r].x = Math.round(rooms[r].fx);
      rooms[r].y = Math.round(rooms[r].fy);
    }
    var tries = 0;
    var again = true;
    while (again && tries < 5000) {
      again = false;
      tries++;
      for (var a2 = 0; a2 < rooms.length; a2++) {
        for (var b2 = a2 + 1; b2 < rooms.length; b2++) {
          var A2 = rooms[a2], B2 = rooms[b2];
          var overX = (A2.x < B2.x + B2.w + 1) && (B2.x < A2.x + A2.w + 1);
          var overY = (A2.y < B2.y + B2.h + 1) && (B2.y < A2.y + A2.h + 1);
          if (overX && overY) {
            again = true;
            var cdx = (B2.x + B2.w / 2) - (A2.x + A2.w / 2);
            var cdy = (B2.y + B2.h / 2) - (A2.y + A2.h / 2);
            if (Math.abs(cdx) >= Math.abs(cdy)) {
              B2.x += cdx >= 0 ? 1 : -1;
            } else {
              B2.y += cdy >= 0 ? 1 : -1;
            }
          }
        }
      }
    }

    // 原点シフト（余白margin=2）
    var minX = Infinity, minY = Infinity;
    for (var m = 0; m < rooms.length; m++) {
      minX = Math.min(minX, rooms[m].x);
      minY = Math.min(minY, rooms[m].y);
    }
    for (var m2 = 0; m2 < rooms.length; m2++) {
      rooms[m2].x += 2 - minX;
      rooms[m2].y += 2 - minY;
      delete rooms[m2].fx;
      delete rooms[m2].fy;
    }
    return rooms;
  }

  function roomCenter(r) {
    return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) };
  }

  // ---------------------------------------------------------------
  // 3. Delaunay三角分割 (Bowyer-Watson)
  // ---------------------------------------------------------------
  function makeTri(verts, a, b, c) {
    var A = verts[a], B = verts[b], C = verts[c];
    var d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    var ux, uy, r2;
    if (Math.abs(d) < 1e-12) {
      // 退化三角形: 常に「悪い三角形」として扱う
      ux = (A.x + B.x + C.x) / 3;
      uy = (A.y + B.y + C.y) / 3;
      r2 = Infinity;
    } else {
      var a2 = A.x * A.x + A.y * A.y;
      var b2 = B.x * B.x + B.y * B.y;
      var c2 = C.x * C.x + C.y * C.y;
      ux = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d;
      uy = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d;
      r2 = (A.x - ux) * (A.x - ux) + (A.y - uy) * (A.y - uy);
    }
    return { a: a, b: b, c: c, ux: ux, uy: uy, r2: r2 };
  }

  function delaunayEdges(points) {
    var n = points.length;
    if (n < 2) return [];
    if (n === 2) return [[0, 1]];

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < n; i++) {
      minX = Math.min(minX, points[i].x); maxX = Math.max(maxX, points[i].x);
      minY = Math.min(minY, points[i].y); maxY = Math.max(maxY, points[i].y);
    }
    var dm = Math.max(maxX - minX, maxY - minY, 1);
    var midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;

    var verts = [];
    for (var v = 0; v < n; v++) verts.push({ x: points[v].x, y: points[v].y });
    verts.push({ x: midX - 30 * dm, y: midY - 10 * dm });
    verts.push({ x: midX, y: midY + 30 * dm });
    verts.push({ x: midX + 30 * dm, y: midY - 10 * dm });

    var tris = [makeTri(verts, n, n + 1, n + 2)];

    for (var pi = 0; pi < n; pi++) {
      var p = verts[pi];
      var good = [];
      var edgeCount = new Map();
      for (var t = 0; t < tris.length; t++) {
        var tr = tris[t];
        var ddx = p.x - tr.ux, ddy = p.y - tr.uy;
        if (ddx * ddx + ddy * ddy <= tr.r2 + 1e-9) {
          // bad triangle → 境界辺を数える
          var es = [[tr.a, tr.b], [tr.b, tr.c], [tr.c, tr.a]];
          for (var e = 0; e < 3; e++) {
            var lo = Math.min(es[e][0], es[e][1]);
            var hi = Math.max(es[e][0], es[e][1]);
            var key = lo * 1000000 + hi;
            edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
          }
        } else {
          good.push(tr);
        }
      }
      tris = good;
      edgeCount.forEach(function (cnt, key) {
        if (cnt !== 1) return;
        var lo = Math.floor(key / 1000000);
        var hi = key % 1000000;
        tris.push(makeTri(verts, lo, hi, pi));
      });
    }

    var edgeSet = new Set();
    for (var t2 = 0; t2 < tris.length; t2++) {
      var tr2 = tris[t2];
      if (tr2.a >= n || tr2.b >= n || tr2.c >= n) continue;
      var es2 = [[tr2.a, tr2.b], [tr2.b, tr2.c], [tr2.c, tr2.a]];
      for (var e2 = 0; e2 < 3; e2++) {
        var lo2 = Math.min(es2[e2][0], es2[e2][1]);
        var hi2 = Math.max(es2[e2][0], es2[e2][1]);
        edgeSet.add(lo2 * 1000000 + hi2);
      }
    }
    var out = [];
    edgeSet.forEach(function (k) { out.push(k); });
    out.sort(function (x, y) { return x - y; }); // 決定性のためソート
    return out.map(function (k) {
      return [Math.floor(k / 1000000), k % 1000000];
    });
  }

  // ---------------------------------------------------------------
  // 4. MST (Kruskal) + 5. ループ辺
  // ---------------------------------------------------------------
  function UnionFind(n) {
    var parent = new Array(n);
    for (var i = 0; i < n; i++) parent[i] = i;
    function find(x) {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    }
    function union(a, b) {
      var ra = find(a), rb = find(b);
      if (ra === rb) return false;
      parent[ra] = rb;
      return true;
    }
    return { find: find, union: union };
  }

  function buildEdges(rooms, rng) {
    var n = rooms.length;
    var centers = rooms.map(roomCenter);
    // 退化回避の微小ジッター（決定的）
    var jittered = centers.map(function (c) {
      return { x: c.x + (rng() - 0.5) * 0.01, y: c.y + (rng() - 0.5) * 0.01 };
    });
    var cand = delaunayEdges(jittered).map(function (e) {
      var dx = centers[e[0]].x - centers[e[1]].x;
      var dy = centers[e[0]].y - centers[e[1]].y;
      return { a: e[0], b: e[1], d: dx * dx + dy * dy };
    });
    cand.sort(function (x, y) {
      return x.d - y.d || x.a - y.a || x.b - y.b;
    });

    var uf = UnionFind(n);
    var mst = [];
    var rest = [];
    for (var i = 0; i < cand.length; i++) {
      if (uf.union(cand[i].a, cand[i].b)) mst.push(cand[i]);
      else rest.push(cand[i]);
    }

    // フォールバック: Delaunayが連結を保証できなかった場合、最近接ペアで橋渡し
    while (mst.length < n - 1) {
      var best = null;
      for (var p = 0; p < n; p++) {
        for (var q = p + 1; q < n; q++) {
          if (uf.find(p) === uf.find(q)) continue;
          var dx2 = centers[p].x - centers[q].x;
          var dy2 = centers[p].y - centers[q].y;
          var dd = dx2 * dx2 + dy2 * dy2;
          if (!best || dd < best.d) best = { a: p, b: q, d: dd };
        }
      }
      if (!best) break;
      uf.union(best.a, best.b);
      mst.push(best);
    }

    // 非MST辺の12〜15%をループ辺として採用
    var ratio = 0.12 + rng() * 0.03;
    var loopCount = rest.length > 0
      ? Math.max(1, Math.round(rest.length * ratio))
      : 0;
    // Fisher-Yatesシャッフル（決定的）
    for (var s = rest.length - 1; s > 0; s--) {
      var j = Math.floor(rng() * (s + 1));
      var tmp = rest[s]; rest[s] = rest[j]; rest[j] = tmp;
    }
    var loops = rest.slice(0, loopCount);

    var edges = [];
    for (var m = 0; m < mst.length; m++) {
      edges.push({ a: mst[m].a, b: mst[m].b, isLoop: false });
    }
    for (var l = 0; l < loops.length; l++) {
      edges.push({ a: loops[l].a, b: loops[l].b, isLoop: true });
    }
    return edges;
  }

  // ---------------------------------------------------------------
  // 6. グリッド彫り込み（床/壁/扉） TILE: 0=空,1=床,2=壁,3=扉
  // ---------------------------------------------------------------
  var T_EMPTY = 0, T_FLOOR = 1, T_WALL = 2, T_DOOR = 3;

  function lPath(x0, y0, x1, y1, horizFirst) {
    var pts = [];
    var x, y;
    if (horizFirst) {
      var sx = x1 >= x0 ? 1 : -1;
      for (x = x0; x !== x1; x += sx) pts.push([x, y0]);
      var sy = y1 >= y0 ? 1 : -1;
      for (y = y0; y !== y1; y += sy) pts.push([x1, y]);
      pts.push([x1, y1]);
    } else {
      var sy2 = y1 >= y0 ? 1 : -1;
      for (y = y0; y !== y1; y += sy2) pts.push([x0, y]);
      var sx2 = x1 >= x0 ? 1 : -1;
      for (x = x0; x !== x1; x += sx2) pts.push([x, y1]);
      pts.push([x1, y1]);
    }
    return pts;
  }

  function carveGrid(rooms, edges, rng) {
    var maxX = 0, maxY = 0;
    for (var i = 0; i < rooms.length; i++) {
      maxX = Math.max(maxX, rooms[i].x + rooms[i].w);
      maxY = Math.max(maxY, rooms[i].y + rooms[i].h);
    }
    var W = maxX + 3, H = maxY + 3;
    var grid = [];
    var roomMap = [];
    for (var y = 0; y < H; y++) {
      grid.push(new Array(W).fill(T_EMPTY));
      roomMap.push(new Array(W).fill(-1));
    }

    // 部屋の床化
    for (var r = 0; r < rooms.length; r++) {
      var rm = rooms[r];
      for (var ry = rm.y; ry < rm.y + rm.h; ry++) {
        for (var rx = rm.x; rx < rm.x + rm.w; rx++) {
          grid[ry][rx] = T_FLOOR;
          roomMap[ry][rx] = rm.id;
        }
      }
    }

    // 通路彫り + 扉検出（部屋境界をまたぐ遷移点）
    var doorSet = new Set();
    for (var e = 0; e < edges.length; e++) {
      var A = roomCenter(rooms[edges[e].a]);
      var B = roomCenter(rooms[edges[e].b]);
      var path = lPath(A.x, A.y, B.x, B.y, rng() < 0.5);
      var prevRoom = roomMap[A.y][A.x];
      var prevX = A.x, prevY = A.y;
      for (var p = 0; p < path.length; p++) {
        var px = path[p][0], py = path[p][1];
        var cur = roomMap[py][px];
        if (grid[py][px] === T_EMPTY) grid[py][px] = T_FLOOR;
        if (cur !== prevRoom) {
          if (cur === -1) {
            doorSet.add(py * W + px);          // 部屋から出た直後のタイル
          } else if (prevRoom === -1) {
            doorSet.add(prevY * W + prevX);    // 部屋に入る直前のタイル
          }
        }
        prevRoom = cur;
        prevX = px; prevY = py;
      }
    }
    doorSet.forEach(function (k) {
      var dy = Math.floor(k / W), dx = k % W;
      if (roomMap[dy][dx] === -1) grid[dy][dx] = T_DOOR;
    });

    // 壁化: 床/扉に8近傍で接する空タイル
    for (var wy = 0; wy < H; wy++) {
      for (var wx = 0; wx < W; wx++) {
        if (grid[wy][wx] !== T_EMPTY) continue;
        var wall = false;
        for (var oy = -1; oy <= 1 && !wall; oy++) {
          for (var ox = -1; ox <= 1 && !wall; ox++) {
            if (ox === 0 && oy === 0) continue;
            var ny = wy + oy, nx = wx + ox;
            if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
            if (grid[ny][nx] === T_FLOOR || grid[ny][nx] === T_DOOR) wall = true;
          }
        }
        if (wall) grid[wy][wx] = T_WALL;
      }
    }

    return { grid: grid, roomMap: roomMap, W: W, H: H };
  }

  // ---------------------------------------------------------------
  // 部屋グラフのBFS深度（start基準）
  // ---------------------------------------------------------------
  function roomDepths(rooms, edges, startId) {
    var adj = {};
    for (var i = 0; i < rooms.length; i++) adj[i] = [];
    for (var e = 0; e < edges.length; e++) {
      adj[edges[e].a].push(edges[e].b);
      adj[edges[e].b].push(edges[e].a);
    }
    var depth = new Array(rooms.length).fill(-1);
    var queue = [startId];
    depth[startId] = 0;
    while (queue.length) {
      var cur = queue.shift();
      var nbrs = adj[cur];
      for (var n = 0; n < nbrs.length; n++) {
        if (depth[nbrs[n]] === -1) {
          depth[nbrs[n]] = depth[cur] + 1;
          queue.push(nbrs[n]);
        }
      }
    }
    return depth;
  }

  // ---------------------------------------------------------------
  // 7. 装飾（松明/柱/宝箱）
  // ---------------------------------------------------------------
  function decorate(rooms, grid, rng, occupied) {
    var props = [];
    var H = grid.length, W = grid[0].length;

    function occKey(x, y) { return y * 100000 + x; }

    for (var r = 0; r < rooms.length; r++) {
      var rm = rooms[r];

      // --- 壁沿い松明（内周を一定間隔で巡回） ---
      var per = [];
      var x, y;
      for (x = rm.x; x < rm.x + rm.w; x++) per.push([x, rm.y]);
      for (y = rm.y + 1; y < rm.y + rm.h; y++) per.push([rm.x + rm.w - 1, y]);
      for (x = rm.x + rm.w - 2; x >= rm.x; x--) per.push([x, rm.y + rm.h - 1]);
      for (y = rm.y + rm.h - 2; y > rm.y; y--) per.push([rm.x, y]);

      var counter = 0;
      for (var pi = 0; pi < per.length; pi++) {
        var px = per[pi][0], py = per[pi][1];
        var nearWall = false, nearDoor = false;
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var d = 0; d < 4; d++) {
          var nx = px + dirs[d][0], ny = py + dirs[d][1];
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          if (grid[ny][nx] === T_WALL) nearWall = true;
          if (grid[ny][nx] === T_DOOR) nearDoor = true;
        }
        if (!nearWall || nearDoor) continue;
        counter++;
        if (counter % 4 === 1) {
          props.push({ type: 'torch', x: px, y: py });
          occupied.add(occKey(px, py));
        }
      }

      // --- 大部屋に柱 ---
      if (rm.w >= 8 && rm.h >= 8) {
        var pillarPos = [
          [rm.x + 2, rm.y + 2],
          [rm.x + rm.w - 3, rm.y + 2],
          [rm.x + 2, rm.y + rm.h - 3],
          [rm.x + rm.w - 3, rm.y + rm.h - 3]
        ];
        for (var pp = 0; pp < pillarPos.length; pp++) {
          props.push({ type: 'pillar', x: pillarPos[pp][0], y: pillarPos[pp][1] });
          occupied.add(occKey(pillarPos[pp][0], pillarPos[pp][1]));
        }
      }

      // --- 宝部屋（行き止まり）に宝箱 ---
      if (rm.type === 'treasure') {
        var c = roomCenter(rm);
        props.push({ type: 'chest', x: c.x, y: c.y });
        occupied.add(occKey(c.x, c.y));
        // 大きめの宝部屋には追加の宝箱
        if (rm.w * rm.h >= 42 && rng() < 0.7) {
          props.push({ type: 'chest', x: c.x + 1, y: c.y });
          occupied.add(occKey(c.x + 1, c.y));
        }
      }
    }
    return props;
  }

  // ---------------------------------------------------------------
  // 8. 敵配置＋難易度
  // ---------------------------------------------------------------
  function populate(rooms, depths, maxDepth, rng, occupied) {
    var spawns = [];
    function occKey(x, y) { return y * 100000 + x; }

    for (var r = 0; r < rooms.length; r++) {
      var rm = rooms[r];
      if (rm.type === 'start') continue;
      var c = roomCenter(rm);

      if (rm.type === 'boss') {
        spawns.push({ type: 'boss', x: c.x, y: c.y, tier: 5 });
        continue;
      }

      var tier = maxDepth > 0
        ? 1 + Math.round(3 * depths[rm.id] / maxDepth)
        : 1;
      var count = Math.max(1, Math.min(4, Math.floor((rm.w * rm.h) / 22)));
      if (rm.type === 'treasure') count = Math.max(1, count - 1); // 宝部屋は番人少なめ

      for (var e = 0; e < count; e++) {
        var placedAt = null;
        for (var attempt = 0; attempt < 12; attempt++) {
          var ex = rm.x + 1 + Math.floor(rng() * Math.max(1, rm.w - 2));
          var ey = rm.y + 1 + Math.floor(rng() * Math.max(1, rm.h - 2));
          if (!occupied.has(occKey(ex, ey))) {
            placedAt = [ex, ey];
            break;
          }
        }
        if (placedAt) {
          spawns.push({ type: 'enemy', x: placedAt[0], y: placedAt[1], tier: tier });
          occupied.add(occKey(placedAt[0], placedAt[1]));
        }
      }
    }
    return spawns;
  }

  // ---------------------------------------------------------------
  // 床タイルごとのBFS深度（ヒートマップ用）
  // ---------------------------------------------------------------
  function tileDepthMap(grid, startX, startY) {
    var H = grid.length, W = grid[0].length;
    var depth = [];
    for (var y = 0; y < H; y++) depth.push(new Array(W).fill(-1));
    var queue = [[startX, startY]];
    var head = 0;
    depth[startY][startX] = 0;
    var maxD = 0;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < queue.length) {
      var cur = queue[head++];
      var cx = cur[0], cy = cur[1];
      for (var d = 0; d < 4; d++) {
        var nx = cx + dirs[d][0], ny = cy + dirs[d][1];
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        if (depth[ny][nx] !== -1) continue;
        var t = grid[ny][nx];
        if (t !== T_FLOOR && t !== T_DOOR) continue;
        depth[ny][nx] = depth[cy][cx] + 1;
        if (depth[ny][nx] > maxD) maxD = depth[ny][nx];
        queue.push([nx, ny]);
      }
    }
    return { depth: depth, max: maxD };
  }

  // ---------------------------------------------------------------
  // メイン: generateFloor（純関数）
  // ---------------------------------------------------------------
  function generateFloor(seed, opts) {
    opts = opts || {};
    var roomCount = Math.max(2, Math.min(200, opts.roomCount || 24));
    var t0 = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();

    var rng = mulberry32(hashSeed(seed));

    // 1-2. 部屋配置
    var rooms = placeRooms(rng, roomCount);

    // 3-5. Delaunay → MST → ループ辺
    var edges = buildEdges(rooms, rng);

    // start: 最も原点(0,0)に近い部屋 / boss: BFS最深部屋
    var startId = 0;
    var bestDist = Infinity;
    for (var i = 0; i < rooms.length; i++) {
      var c = roomCenter(rooms[i]);
      var dd = c.x * c.x + c.y * c.y;
      if (dd < bestDist) { bestDist = dd; startId = i; }
    }
    var depths = roomDepths(rooms, edges, startId);
    var maxDepth = 0;
    var bossId = startId;
    for (var d = 0; d < depths.length; d++) {
      if (depths[d] > maxDepth) { maxDepth = depths[d]; bossId = d; }
    }
    if (bossId === startId && rooms.length > 1) bossId = startId === 0 ? 1 : 0;

    // 次数（行き止まり=宝部屋の判定）
    var degree = new Array(rooms.length).fill(0);
    for (var e = 0; e < edges.length; e++) {
      degree[edges[e].a]++;
      degree[edges[e].b]++;
    }

    for (var r = 0; r < rooms.length; r++) {
      rooms[r].depth = depths[r];
      if (r === startId) rooms[r].type = 'start';
      else if (r === bossId) rooms[r].type = 'boss';
      else if (degree[r] === 1) rooms[r].type = 'treasure';
      else rooms[r].type = 'normal';
    }

    // 6. グリッド彫り込み
    var carved = carveGrid(rooms, edges, rng);
    var grid = carved.grid;

    // 7. 装飾
    var occupied = new Set();
    var props = decorate(rooms, grid, rng, occupied);

    // 8. 敵配置
    var spawns = populate(rooms, depths, maxDepth, rng, occupied);

    // ヒートマップ用タイル深度
    var sc = roomCenter(rooms[startId]);
    var td = tileDepthMap(grid, sc.x, sc.y);

    var loopCount = 0;
    for (var le = 0; le < edges.length; le++) if (edges[le].isLoop) loopCount++;

    var t1 = (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();

    return {
      seed: seed,
      rooms: rooms,
      edges: edges,
      grid: grid,
      props: props,
      spawns: spawns,
      meta: {
        genMs: Math.round((t1 - t0) * 100) / 100,
        roomCount: rooms.length,
        loopCount: loopCount,
        maxDepth: maxDepth,
        width: carved.W,
        height: carved.H,
        startRoomId: startId,
        bossRoomId: bossId,
        tileDepth: td.depth,
        tileDepthMax: td.max
      }
    };
  }

  // ---------------------------------------------------------------
  // デュアルエクスポート（Node / ブラウザ）
  // ---------------------------------------------------------------
  var api = {
    generateFloor: generateFloor,
    mulberry32: mulberry32,
    hashSeed: hashSeed,
    TILE: { EMPTY: T_EMPTY, FLOOR: T_FLOOR, WALL: T_WALL, DOOR: T_DOOR }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.FloorGen = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
