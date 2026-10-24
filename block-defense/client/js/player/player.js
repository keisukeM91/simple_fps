// 自分の体：当たり判定・出現・移動・ジャンプ

import { CX, CZ, G, PW, PH } from "../core/config.js";
import { clamp } from "../core/util.js";
import { game, P, input } from "../core/state.js";
import { solid } from "../world/voxels.js";
import { hurtPlayer } from "../game/solo.js";
import { shoot } from "./actions.js";

// この位置に立つとブロックにめり込むか
export function collides(px, py, pz) {
  const x0 = Math.floor(px - PW), x1 = Math.floor(px + PW - 1e-4);
  const y0 = Math.floor(py), y1 = Math.floor(py + PH - 1e-4);
  const z0 = Math.floor(pz - PW), z1 = Math.floor(pz + PW - 1e-4);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (solid(x, y, z)) return true;
  return false;
}

export function spawnPlayer() {
  let sx = CX + .5, sz = CZ + 3.5;
  if (game.mode === "online") {   // オンラインでは重ならないように、少しずらして出現（すぐサーバーの位置で上書きされる）
    for (let i = 0; i < 20; i++) {
      const x = CX + .5 + (Math.random() * 8 - 4), z = CZ + .5 + (Math.random() * 8 - 4);
      if (Math.hypot(x - CX - .5, z - CZ - .5) > 1.6 && !collides(x, G, z)) { sx = x; sz = z; break; }
    }
  }
  P.pos.set(sx, G, sz); P.vel.set(0, 0, 0);
  P.hp = 100; P.dead = false; P.yaw = Math.PI; P.pitch = -.05;
}

export function jump() {
  if (P.onGround && !P.dead) { P.vel.y = 8.2; P.onGround = false; }
}

export function updatePlayer(dt) {
  if (P.dead) {
    if (game.mode !== "online") { P.respawn -= dt; if (P.respawn <= 0) spawnPlayer(); }
    return;
  }
  const keys = input.keys;
  let ix = 0, iz = 0;
  if (keys.has("KeyW")) iz += 1;
  if (keys.has("KeyS")) iz -= 1;
  if (keys.has("KeyD")) ix += 1;
  if (keys.has("KeyA")) ix -= 1;
  if (keys.has("ArrowLeft")) P.yaw += 2.2 * dt;
  if (keys.has("ArrowRight")) P.yaw -= 2.2 * dt;
  if (keys.has("ArrowUp")) P.pitch = clamp(P.pitch + 1.6 * dt, -1.5, 1.5);
  if (keys.has("ArrowDown")) P.pitch = clamp(P.pitch - 1.6 * dt, -1.5, 1.5);
  if (input.joy.id !== null) { ix += input.joy.x; iz -= input.joy.y; }
  const m = Math.hypot(ix, iz);
  if (m > 1) { ix /= m; iz /= m; }

  const spd = 5.4 * (keys.has("ShiftLeft") ? 1.35 : 1);
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  P.vel.x = (fx * iz + rx * ix) * spd;
  P.vel.z = (fz * iz + rz * ix) * spd;
  P.vel.y = Math.max(P.vel.y - 22 * dt, -30);

  // 横移動（1段なら自動で登る）
  for (const a of ["x", "z"]) {
    const n = P.pos[a] + P.vel[a] * dt;
    const nx = a === "x" ? n : P.pos.x, nz = a === "z" ? n : P.pos.z;
    if (!collides(nx, P.pos.y, nz)) P.pos[a] = n;
    else if (P.onGround && !collides(nx, P.pos.y + 1.01, nz) && !collides(P.pos.x, P.pos.y + 1.01, P.pos.z)) {
      P.pos.y = Math.floor(P.pos.y) + 1; P.pos[a] = n;
    }
  }
  // 縦移動（着地）
  const ny = P.pos.y + P.vel.y * dt;
  if (!collides(P.pos.x, ny, P.pos.z)) { P.pos.y = ny; P.onGround = false; }
  else {
    if (P.vel.y < 0) { const s = Math.floor(ny) + 1; if (!collides(P.pos.x, s, P.pos.z)) P.pos.y = s; P.onGround = true; }
    P.vel.y = 0;
  }

  // 落下と自然回復は、オンラインではサーバーが決める
  if (game.mode !== "online") {
    if (P.pos.y < -6) hurtPlayer(999);
    if (game.time - P.lastHurt > 4 && P.hp < 100) P.hp = Math.min(100, P.hp + 6 * dt);
  }

  P.cd -= dt;
  if (input.firing && P.cd <= 0) shoot();
}
