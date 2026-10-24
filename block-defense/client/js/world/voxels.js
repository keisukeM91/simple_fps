// ブロックの世界のデータ（どこに何のブロックがあるか）

import { W, D, H, AIR, STONE } from "../core/config.js";

export const vox = new Uint8Array(W * H * D);
export const plankHP = new Map();                   // 一人用：木の板ごとの残り耐久

export const idx = (x, y, z) => x + W * (z + D * y);
export const inXZ = (x, z) => x >= 0 && x < W && z >= 0 && z < D;
export const key = (x, y, z) => x + "," + y + "," + z;

export function get(x, y, z) {
  if (!inXZ(x, z) || y < 0) return STONE;          // 世界の外は壁あつかい
  if (y >= H) return AIR;
  return vox[idx(x, y, z)];
}
export function set(x, y, z, v) {
  if (inXZ(x, z) && y >= 0 && y < H) vox[idx(x, y, z)] = v;
}
export const solid = (x, y, z) => get(x, y, z) !== AIR;

// その列のいちばん上の地面の高さ
export function surface(x, z) {
  for (let y = H - 1; y >= 0; y--) if (get(x, y, z) !== AIR) return y + 1;
  return 0;
}

// サーバーから届いた地形（base64）で置き換える。大きさが合わなければ false
export function loadVoxels(b64) {
  const bin = atob(b64);
  if (bin.length !== vox.length) return false;
  for (let i = 0; i < bin.length; i++) vox[i] = bin.charCodeAt(i);
  plankHP.clear();
  return true;
}
