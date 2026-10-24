// 一人用の地形づくり（オンラインではサーバーが作った地形を使う）

import { W, D, CX, CZ, G, AIR, GRASS, DIRT, STONE, PLANK, LOG, LEAF, CORE, PLANK_MAX } from "../core/config.js";
import { clamp, mulberry32 } from "../core/util.js";
import { vox, plankHP, inXZ, key, get, set, surface } from "./voxels.js";

export function buildSoloWorld() {
  vox.fill(0); plankHP.clear();

  // 起伏のある地面。拠点のまわりは平らにする
  const h = new Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const c = Math.max(Math.abs(x - CX), Math.abs(z - CZ));
    let n = G + Math.sin(x * .23) * 1.3 + Math.cos(z * .19) * 1.3 + Math.sin((x + z) * .11 + 1) * 1.6 + Math.cos((x - z) * .07) * 1.2;
    if (c <= 8) n = G; else if (c < 12) n = G + (n - G) * (c - 8) / 4;
    h[x + z * W] = Math.round(clamp(n, 2, 9));
  }
  // となり同士の段差を1以内にする（歩いて登れるように）
  for (let it = 0; it < 12; it++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    let mn = 99, mx = -99;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, zz = z + dz;
      if (!inXZ(xx, zz)) continue;
      const v = h[xx + zz * W]; mn = Math.min(mn, v); mx = Math.max(mx, v);
    }
    h[x + z * W] = clamp(h[x + z * W], mx - 1, mn + 1);
  }
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (Math.max(Math.abs(x - CX), Math.abs(z - CZ)) <= 7) h[x + z * W] = G;
    const hh = h[x + z * W];
    for (let y = 0; y < hh; y++) set(x, y, z, y < hh - 3 ? STONE : y < hh - 1 ? DIRT : GRASS);
  }

  // 拠点のまわりの木の壁（四方に門）
  for (let z = CZ - 6; z <= CZ + 6; z++) for (let x = CX - 6; x <= CX + 6; x++) {
    const dx = x - CX, dz = z - CZ;
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== 6) continue;
    if (Math.abs(dx) <= 1 || Math.abs(dz) <= 1) continue;
    for (let y = G; y < G + 2; y++) { set(x, y, z, PLANK); plankHP.set(key(x, y, z), PLANK_MAX); }
  }

  // 木
  let made = 0, guard = 0;
  const wr = mulberry32(4242);
  while (made < 14 && guard++ < 400) {
    const x = 3 + Math.floor(wr() * (W - 6)), z = 3 + Math.floor(wr() * (D - 6));
    if (Math.max(Math.abs(x - CX), Math.abs(z - CZ)) < 13) continue;
    const g = surface(x, z), th = 4;
    for (let y = g; y < g + th; y++) set(x, y, z, LOG);
    for (let y = g + th - 2; y <= g + th; y++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dz) > (y === g + th ? 1 : 3)) continue;
      if (get(x + dx, y, z + dz) === AIR) set(x + dx, y, z + dz, LEAF);
    }
    made++;
  }

  // 拠点コア（2マス分のブロック）
  set(CX, G, CZ, CORE); set(CX, G + 1, CZ, CORE);
}
