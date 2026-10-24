// 視線がどこに当たるかを調べる

import { H, AIR } from "../core/config.js";
import { get, inXZ } from "./voxels.js";

// ブロックとの当たり（DDA法で1マスずつ進む）
// 当たれば {x,y,z: 当たったマス, t: 距離, prev: 手前の空きマス, v: ブロックの種類, oob: 世界の外か}
export function rayVox(o, d, max) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
  const ax = Math.abs(d.x) || 1e-9, ay = Math.abs(d.y) || 1e-9, az = Math.abs(d.z) || 1e-9;
  const tdx = 1 / ax, tdy = 1 / ay, tdz = 1 / az;
  let tmx = (sx > 0 ? x + 1 - o.x : o.x - x) / ax;
  let tmy = (sy > 0 ? y + 1 - o.y : o.y - y) / ay;
  let tmz = (sz > 0 ? z + 1 - o.z : o.z - z) / az;
  let t = 0, prev = null;
  for (let i = 0; i < 300; i++) {
    const v = get(x, y, z);
    if (v !== AIR) return { x, y, z, t, prev, v, oob: !inXZ(x, z) || y < 0 };
    prev = [x, y, z];
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; }
    else { z += sz; t = tmz; tmz += tdz; }
    if (t > max || y >= H + 4) return null;
  }
  return null;
}

// 箱との当たり。当たれば距離、外れれば -1
export function rayBox(o, d, mn, mx) {
  let t0 = 0, t1 = 1e9;
  for (const a of ["x", "y", "z"]) {
    const dv = d[a] || 1e-9;
    let ta = (mn[a] - o[a]) / dv, tb = (mx[a] - o[a]) / dv;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t1 < t0) return -1;
  }
  return t0;
}
