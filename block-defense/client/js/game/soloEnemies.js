// 一人用の敵ロボット（オンラインでは server/coop.py が同じことをする）

import { W, D, CX, CZ, G, AIR, PLANK, PLANK_MAX, PH, ET } from "../core/config.js";
import { V3 } from "../core/util.js";
import { game, P } from "../core/state.js";
import { get, set, solid, surface, plankHP, key } from "../world/voxels.js";
import { rayVox } from "../world/raycast.js";
import { scene, camera } from "../render/scene.js";
import { rebuild } from "../render/blocks.js";
import { burst } from "../render/effects.js";
import { makeEnemyMesh, makeHealthBar, animateEnemy } from "../render/models.js";
import { SFX } from "../audio/sfx.js";
import { toast } from "../ui/hud.js";
import { hurtPlayer, hurtCore } from "./solo.js";

export const enemies = [];
const shots = [];             // 射撃ボットの弾
const tmp = new V3();

export function spawnEnemy(type) {
  const def = ET[type];
  let x, z;
  const side = (Math.random() * 4) | 0, r = 2 + Math.floor(Math.random() * (W - 4));
  if (side === 0) { x = r; z = 1; } else if (side === 1) { x = r; z = D - 2; } else if (side === 2) { x = 1; z = r; } else { x = W - 2; z = r; }
  const m = makeEnemyMesh(def, type);
  const hpMul = 1 + (game.wave - 1) * .13;
  const { bar, fg } = makeHealthBar();
  const e = {
    type, def, pos: new V3(x + .5, surface(x, z), z + .5), vy: 0, hp: def.hp * hpMul, max: def.hp * hpMul,
    ...m, bar, fg, flash: 0, atk: 0, shootT: 1.5 + Math.random() * 1.5, detour: 0, detourT: 0,
    walk: Math.random() * 6, strafe: Math.random() < .5 ? 1 : -1,
  };
  scene.add(bar); scene.add(e.g);
  enemies.push(e);
}

export function removeEnemy(e, killed) {
  scene.remove(e.g); scene.remove(e.bar);
  const i = enemies.indexOf(e);
  if (i >= 0) enemies.splice(i, 1);
  if (killed) {
    burst(e.pos.clone().add(new V3(0, e.def.h * .6, 0)), e.def.body, 14, 5);
    burst(e.pos.clone().add(new V3(0, e.def.h * .6, 0)), e.def.eye, 4, 3);
    game.blocks += e.def.reward; game.score += e.def.score * game.wave; game.kills++;
    SFX.kill(); toast(`+${e.def.reward} 板`, 0.6);
  }
}

export function damageEnemy(e, dmg, at) {
  e.hp -= dmg; e.flash = .1;
  burst(at, 0xffffff, 3, 2);
  if (e.hp <= 0) removeEnemy(e, true); else SFX.hit();
}

export function clearSoloEnemies() {
  for (const e of [...enemies]) removeEnemy(e, false);
  for (const s of shots) scene.remove(s.m);
  shots.length = 0;
}

function damagePlank(x, y, z, d) {
  const k = key(x, y, z), hp = (plankHP.get(k) ?? PLANK_MAX) - d;
  burst(new V3(x + .5, y + .5, z + .5), 0xc99a5b, 3, 2);
  if (hp <= 0) {
    set(x, y, z, AIR); plankHP.delete(k); rebuild(); SFX.brk();
    burst(new V3(x + .5, y + .5, z + .5), 0x9c703c, 8, 3);
  } else plankHP.set(k, hp);
}

export function updateEnemies(dt) {
  for (const e of [...enemies]) if (enemies.includes(e)) updateEnemy(e, dt);
}

function updateEnemy(e, dt) {
  const d = e.def;
  // 重力
  const fx = Math.floor(e.pos.x), fz = Math.floor(e.pos.z);
  if (!solid(fx, Math.floor(e.pos.y - .01), fz)) {
    e.vy -= 20 * dt; e.pos.y += e.vy * dt;
    if (solid(fx, Math.floor(e.pos.y), fz)) { e.pos.y = Math.floor(e.pos.y) + 1; e.vy = 0; }
  } else e.vy = 0;
  if (e.pos.y < -5) { removeEnemy(e, false); return; }

  // 目標を決める（近くのプレイヤー、それ以外は拠点コア）
  const toP = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  const coreX = CX + .5, coreZ = CZ + .5, toC = Math.hypot(coreX - e.pos.x, coreZ - e.pos.z);
  let tx, tz, chasingPlayer = false;
  if (!P.dead && ((e.type === "shooter" && toP < 20) || (e.type !== "shooter" && toP < 4.5 && toP < toC))) { tx = P.pos.x; tz = P.pos.z; chasingPlayer = true; }
  else { tx = coreX; tz = coreZ; }
  let dx = tx - e.pos.x, dz = tz - e.pos.z;
  const dist = Math.hypot(dx, dz) || 1;
  dx /= dist; dz /= dist;
  e.g.rotation.y = Math.atan2(dx, dz);
  e.atk -= dt;

  let mvx = dx, mvz = dz, moving = true;
  if (e.type === "shooter") {
    if (chasingPlayer) {
      if (dist < 6) { mvx = -dx; mvz = -dz; }
      else if (dist < 10) { mvx = -dz * e.strafe; mvz = dx * e.strafe; if (Math.random() < dt * .4) e.strafe *= -1; }
      e.shootT -= dt;
      if (e.shootT <= 0) {
        e.shootT = 2.2 - Math.min(1, game.wave * .08);
        const from = e.pos.clone().add(new V3(0, d.h * .6, 0));
        const to = P.pos.clone().add(new V3(0, 1.2, 0));
        const dir = to.clone().sub(from).normalize();
        if (!rayVox(from, dir, from.distanceTo(to))) {       // 見通しがあるときだけ撃つ
          const m = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshBasicMaterial({ color: 0xff7ae6 }));
          m.position.copy(from); scene.add(m);
          shots.push({ m, v: dir.multiplyScalar(13), life: 4 });
          SFX.enemyShot();
        }
      }
    } else if (toC < 3) moving = false;
  } else {
    if (chasingPlayer && dist < 1.25) { moving = false; if (e.atk <= 0) { e.atk = .9; hurtPlayer(d.melee); } }
    if (!chasingPlayer && toC < 1.45) { moving = false; if (e.atk <= 0) { e.atk = .9; hurtCore(d.melee); burst(new V3(coreX, G + 1.2, coreZ), 0x5fe3ff, 4, 2); } }
  }
  if (e.detourT > 0) { e.detourT -= dt; mvx = -dz * e.detour * .85 + dx * .3; mvz = dx * e.detour * .85 + dz * .3; }

  if (moving) {
    const m = Math.hypot(mvx, mvz) || 1;
    mvx /= m; mvz /= m;
    const sp = d.spd * dt, fy = Math.floor(e.pos.y + .001);
    const cx = Math.floor(e.pos.x + mvx * (d.w * .5 + .15)), cz = Math.floor(e.pos.z + mvz * (d.w * .5 + .15));
    let ok = true;
    if (cx !== fx || cz !== fz) {
      const foot = solid(cx, fy, cz), head = solid(cx, fy + 1, cz), above = solid(cx, fy + 2, cz);
      if (!foot && !head) { /* そのまま進む */ }
      else if (foot && !head && !above && e.vy === 0) { e.pos.y = fy + 1; }        // 1段なら登る
      else {
        ok = false;
        const wy = get(cx, fy, cz) === PLANK ? fy : (get(cx, fy + 1, cz) === PLANK ? fy + 1 : -1);
        if (wy >= 0 && d.wood > 0 && !chasingPlayer) {                           // 木の板なら叩いて壊す
          if (e.atk <= 0) { e.atk = .85; damagePlank(cx, wy, cz, d.wood); }
        } else if (e.detourT <= 0) { e.detour = Math.random() < .5 ? 1 : -1; e.detourT = 1.2 + Math.random(); }  // 回り道
      }
    }
    if (ok) { e.pos.x += mvx * sp; e.pos.z += mvz * sp; e.walk += dt * d.spd * 5; }
  }

  // 敵どうしの押し合い
  for (const o of enemies) {
    if (o === e) continue;
    const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, dd = Math.hypot(ox, oz), min = (d.w + o.def.w) * .45;
    if (dd > 0 && dd < min) {
      const push = (min - dd) * .5;
      tmp.set(e.pos.x + ox / dd * push, e.pos.y, e.pos.z + oz / dd * push);
      if (!solid(Math.floor(tmp.x), Math.floor(tmp.y + .001), Math.floor(tmp.z))) { e.pos.x = tmp.x; e.pos.z = tmp.z; }
    }
  }

  // 見た目
  animateEnemy(e, Math.sin(e.walk) * .6, !moving && e.atk > .6);
  e.g.position.copy(e.pos);
  e.flash -= dt;
  e.bodyMat.emissive.setHex(e.flash > 0 ? 0xffffff : 0x000000);
  e.bar.visible = e.hp < e.max;
  e.bar.position.set(e.pos.x, e.pos.y + d.h + .35, e.pos.z);
  e.bar.quaternion.copy(camera.quaternion);
  e.fg.scale.x = Math.max(0, e.hp / e.max);
}

// 射撃ボットの弾を進める
export function updateEnemyShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.m.position.addScaledVector(s.v, dt);
    s.life -= dt;
    const p = s.m.position;
    let dead = s.life <= 0;
    if (!dead && solid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) { dead = true; burst(p, 0xff7ae6, 3, 1.5); }
    if (!dead && !P.dead && Math.abs(p.x - P.pos.x) < .45 && Math.abs(p.z - P.pos.z) < .45 && p.y > P.pos.y && p.y < P.pos.y + PH) { dead = true; hurtPlayer(9); }
    if (dead) { scene.remove(s.m); shots.splice(i, 1); }
  }
}
