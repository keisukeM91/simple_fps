// 自分の行動：撃つ・板を置く・板をこわす
// 一人用はその場で結果を出す。オンラインはサーバーへお願いを送り、結果はサーバーから届く

import { H, AIR, PLANK, PLANK_MAX, PW, PH } from "../core/config.js";
import { V3 } from "../core/util.js";
import { game, P, view } from "../core/state.js";
import { set, inXZ, plankHP, key } from "../world/voxels.js";
import { rayVox, rayBox } from "../world/raycast.js";
import { camPos, camDir, viewRay, gunTip } from "../render/scene.js";
import { rebuild } from "../render/blocks.js";
import { burst, tracer } from "../render/effects.js";
import { SFX } from "../audio/sfx.js";
import { toast } from "../ui/hud.js";
import { enemies, damageEnemy } from "../game/soloEnemies.js";
import { net, netSend } from "../net/connection.js";
import { netEnemies, remotes } from "../net/sync.js";

const REACH = 6;           // 板を置ける・こわせる距離（画面側の目安。最終判断はサーバー）
const muzzle = new V3();

export function targetBlock() {
  viewRay();
  return rayVox(camPos, camDir, REACH);
}

const canAct = () => game.running && !game.paused && !P.dead;
const overlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

export function placeBlock() {
  if (!canAct()) return;
  const h = targetBlock();
  if (!h || !h.prev || h.oob) { toast("近くのブロックをねらってください"); return; }
  const [x, y, z] = h.prev;
  if (!inXZ(x, z) || y < 0 || y >= H) return;
  if (game.blocks <= 0) { toast("木の板がありません。敵を倒して集めよう"); return; }
  if (overlap(P.pos.x - PW, P.pos.x + PW, x, x + 1) && overlap(P.pos.y, P.pos.y + PH, y, y + 1) && overlap(P.pos.z - PW, P.pos.z + PW, z, z + 1)) {
    toast("自分の立っている場所には置けません"); return;
  }
  for (const e of enemies) {
    const w = e.def.w / 2;
    if (overlap(e.pos.x - w, e.pos.x + w, x, x + 1) && overlap(e.pos.y, e.pos.y + e.def.h, y, y + 1) && overlap(e.pos.z - w, e.pos.z + w, z, z + 1)) return;
  }
  if (game.mode === "online") { netSend({ t: "place", x, y, z }); return; }
  set(x, y, z, PLANK); plankHP.set(key(x, y, z), PLANK_MAX);
  game.blocks--;
  rebuild(); SFX.place();
  burst(new V3(x + .5, y + .5, z + .5), 0xc99a5b, 5, 2);
}

export function breakBlock() {
  if (!canAct()) return;
  const h = targetBlock();
  if (!h || h.oob) return;
  if (h.v !== PLANK) { toast("こわせるのは木の板だけです"); return; }
  if (game.mode === "online") { netSend({ t: "break", x: h.x, y: h.y, z: h.z }); return; }
  set(h.x, h.y, h.z, AIR); plankHP.delete(key(h.x, h.y, h.z));
  game.blocks++;
  rebuild(); SFX.brk();
  burst(new V3(h.x + .5, h.y + .5, h.z + .5), 0xc99a5b, 8, 3);
}

export function shoot() {
  P.cd = .14; P.kick = 1;
  viewRay();
  // 光線をどこで止めるか（ブロック・敵・対戦相手のうち、いちばん手前）
  const vh = rayVox(camPos, camDir, 60);
  let tMax = vh ? vh.t : 60, hitE = null;
  for (const e of (game.mode === "online" ? netEnemies.values() : enemies)) {
    const w = e.def.w / 2;
    const t = rayBox(camPos, camDir, { x: e.pos.x - w, y: e.pos.y, z: e.pos.z - w }, { x: e.pos.x + w, y: e.pos.y + e.def.h, z: e.pos.z + w });
    if (t >= 0 && t < tMax) { tMax = t; hitE = e; }
  }
  if (game.mode === "online" && net.mode === "pvp") {
    for (const r of remotes.values()) {
      if (r.team === net.team || !r.g.visible) continue;
      const q = r.g.position;
      const t = rayBox(camPos, camDir, { x: q.x - .3, y: q.y, z: q.z - .3 }, { x: q.x + .3, y: q.y + 1.8, z: q.z + .3 });
      if (t >= 0 && t < tMax) { tMax = t; hitE = r; }
    }
  }
  const end = camPos.clone().addScaledVector(camDir, tMax);
  gunTip.getWorldPosition(muzzle);
  tracer(muzzle, end, view.tracerColor);
  SFX.shot();

  if (game.mode === "online") {
    // 見た目だけ先に出し、当たったかどうかはサーバーが判定する
    netSend({
      t: "shoot",
      ox: +camPos.x.toFixed(3), oy: +camPos.y.toFixed(3), oz: +camPos.z.toFixed(3),
      dx: +camDir.x.toFixed(4), dy: +camDir.y.toFixed(4), dz: +camDir.z.toFixed(4),
    });
    if (!hitE && vh) burst(end, 0xdddddd, 3, 1.5);
    return;
  }
  if (hitE) damageEnemy(hitE, 24, end);
  else if (vh) burst(end, 0xdddddd, 3, 1.5);
}
