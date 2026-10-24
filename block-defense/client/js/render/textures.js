// ブロックの模様（16×16ドットを、その場で描いて作る）

import { GRASS, DIRT, STONE, PLANK, LOG, LEAF } from "../core/config.js";
import { clamp, rng } from "../core/util.js";

function shade(c, v) {
  return `rgb(${clamp(c[0] + v, 0, 255) | 0},${clamp(c[1] + v, 0, 255) | 0},${clamp(c[2] + v, 0, 255) | 0})`;
}
function mkTex(draw) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  draw(c.getContext("2d"));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}
function noise(g, base, vari, x0 = 0, y0 = 0, w = 16, h = 16) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    g.fillStyle = shade(base, (rng() - .5) * vari);
    g.fillRect(x, y, 1, 1);
  }
}

const GRN = [104, 174, 68], DRT = [136, 98, 66];

export const T = {
  grassTop: mkTex(g => noise(g, GRN, 34)),
  grassSide: mkTex(g => { noise(g, DRT, 30); for (let x = 0; x < 16; x++) { const d = 3 + ((rng() * 3) | 0); noise(g, GRN, 30, x, 0, 1, d); } }),
  dirt: mkTex(g => noise(g, DRT, 30)),
  stone: mkTex(g => { noise(g, [128, 132, 140], 26); for (let i = 0; i < 7; i++) { g.fillStyle = "rgba(60,64,72,.55)"; g.fillRect((rng() * 14) | 0, (rng() * 14) | 0, 2 + ((rng() * 2) | 0), 1); } }),
  plank: mkTex(g => { noise(g, [190, 144, 86], 22); g.fillStyle = "#7a5328"; for (const y of [3, 7, 11, 15]) g.fillRect(0, y, 16, 1); g.fillRect(6, 0, 1, 4); g.fillRect(12, 4, 1, 4); g.fillRect(3, 8, 1, 4); g.fillRect(10, 12, 1, 4); }),
  logSide: mkTex(g => { noise(g, [104, 76, 48], 20); g.fillStyle = "rgba(50,34,20,.6)"; for (let x = 1; x < 16; x += 3) g.fillRect(x, 0, 1, 16); }),
  logTop: mkTex(g => { noise(g, [184, 146, 92], 16); g.strokeStyle = "#7a5328"; g.lineWidth = 1; g.strokeRect(2.5, 2.5, 11, 11); g.strokeRect(5.5, 5.5, 5, 5); }),
  leaf: mkTex(g => { noise(g, [60, 138, 56], 50); g.fillStyle = "#2c5a28"; for (let i = 0; i < 10; i++) g.fillRect((rng() * 16) | 0, (rng() * 16) | 0, 1, 1); }),
};

const L = t => new THREE.MeshLambertMaterial({ map: t });

// ブロックの種類ごとの材質（6面で模様が違うものは配列：右・左・上・下・前・後）
export const MAT = {
  [GRASS]: [L(T.grassSide), L(T.grassSide), L(T.grassTop), L(T.dirt), L(T.grassSide), L(T.grassSide)],
  [DIRT]: L(T.dirt),
  [STONE]: L(T.stone),
  [PLANK]: L(T.plank),
  [LOG]: [L(T.logSide), L(T.logSide), L(T.logTop), L(T.logTop), L(T.logSide), L(T.logSide)],
  [LEAF]: L(T.leaf),
};
