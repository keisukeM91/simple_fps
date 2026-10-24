// どこからでも使う小さな道具

export const $ = id => document.getElementById(id);
export const V3 = THREE.Vector3;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 種（シード）を決めると毎回同じ並びになる乱数
export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const rng = mulberry32(20261024);

// 角度を最短の向きでなめらかにつなぐ
export function lerpAngle(a, b, k) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * k;
}

// 名前などを HTML に入れるときの安全な変換
export function esc(t) {
  return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// 秒 → 「分:秒」
export const mmss = s => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// ブラウザへの保存（使えない環境でも止まらないようにする）
export function loadLocal(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
}
export function saveLocal(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* 保存できなくても続ける */ }
}
