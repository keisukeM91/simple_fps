// サーバーから届いた状態を画面に反映する
// 他のプレイヤー・敵・敵の弾は、少し遅らせて表示し、届いた位置の間をなめらかにつなぐ（補間）

import { INTERP_DELAY, TEAM_NAME, SEND_RATE, ET } from "../core/config.js";
import { $, V3, clamp, lerpAngle } from "../core/util.js";
import { game, P, input, view } from "../core/state.js";
import { loadVoxels } from "../world/voxels.js";
import { scene, camera, gunTop } from "../render/scene.js";
import { rebuild } from "../render/blocks.js";
import { burst } from "../render/effects.js";
import { makeAvatar, makeEnemyMesh, makeHealthBar, animateEnemy } from "../render/models.js";
import { toast } from "../ui/hud.js";
import { net, netSend } from "./connection.js";
import { applyFx } from "./events.js";

export const remotes = new Map();      // 他のプレイヤー
export const netEnemies = new Map();   // 敵ロボット（協力プレイ）
const netShots = new Map();            // 敵の弾
const world = { needRebuild: false };

// 自分の板やコアを数える単位（協力は全員で "all"、対戦はチーム名）
export const myKey = () => net.mode === "pvp" ? net.team : "all";
export const requestRebuild = () => { world.needRebuild = true; };

export function loadWorld(b64) {
  if (loadVoxels(b64)) rebuild();
}

function pushBuf(buf, now, s) {
  buf.push(Object.assign({ t: now }, s));
  if (buf.length > 30) buf.shift();
}

// 時刻 rt の位置を、前後に届いた位置から計算する
function sample(buf, rt) {
  while (buf.length >= 2 && buf[1].t <= rt) buf.shift();
  const a = buf[0];
  if (buf.length < 2 || a.t > rt) return a;
  const c = buf[1], k = clamp((rt - a.t) / ((c.t - a.t) || 1), 0, 1), o = {};
  for (const key in a) {
    if (key === "t") continue;
    o[key] = key === "yaw" ? lerpAngle(a.yaw, c.yaw, k) : a[key] + (c[key] - a[key]) * k;
  }
  return o;
}

let myColorHex = "";
function myColor(c) {
  if (c === myColorHex) return;
  myColorHex = c;
  gunTop.material.color.set(c);
  view.tracerColor = new THREE.Color(c).getHex();
}

// ---- 届いた状態（snap）を反映 ----
export function applySnap(m) {
  const now = performance.now(), g = m.game || {};
  game.phase = g.phase; game.wave = g.wave; game.breakT = g.breakT; game.score = g.score;
  net.mode = g.mode; net.left = g.left; net.overT = g.overT; net.over = g.over || null; net.cores = g.cores || {};
  net.prepT = g.prepT; net.timeLeft = g.timeLeft; net.canStart = !!g.canStart; net.why = g.why || "";

  applyPlayers(m.players || [], now, g.phase);
  game.blocks = (g.blocks || {})[myKey()] ?? 0;
  applyEnemies(m.enemies || [], now);
  applyShots(m.shots || [], now);

  for (const f of m.e || []) applyFx(f);
  if (world.needRebuild) { world.needRebuild = false; rebuild(); }
  phaseChanged(net.prevPhase, game.phase);
  net.prevPhase = game.phase;
}

function applyPlayers(list, now, phase) {
  const seen = new Set(), plist = [];
  net.teamKills = { red: 0, blue: 0 };
  for (const p of list) {
    net.names.set(p.id, { name: p.name, color: p.color });
    plist.push({ id: p.id, name: p.name, team: p.team, color: p.color });
    if (p.team in net.teamKills) net.teamKills[p.team] += p.k;
    if (p.id === net.id) {
      P.hp = p.hp; net.team = p.team; net.kills = p.k; net.deaths = p.d;
      myColor(p.color);
      if (p.dead && !P.dead) { P.dead = true; input.firing = false; }
      continue;
    }
    seen.add(p.id);
    let r = remotes.get(p.id);
    if (r && r.color !== p.color) { scene.remove(r.g); remotes.delete(p.id); r = null; }   // チームが変わったら作り直す
    if (!r) {
      r = makeAvatar(p.name, p.color);
      Object.assign(r, { color: p.color, buf: [], walk: 0, last: null });
      remotes.set(p.id, r); scene.add(r.g);
    }
    r.team = p.team;
    r.g.visible = !p.dead && phase !== "lobby";
    pushBuf(r.buf, now, { x: +p.x, y: +p.y, z: +p.z, yaw: +p.yaw, pitch: +p.pitch });
  }
  for (const [id, r] of remotes) if (!seen.has(id)) { scene.remove(r.g); remotes.delete(id); }
  net.players = plist.length;
  net.plist = plist;
}

function applyEnemies(list, now) {
  const seen = new Set();
  for (const e of list) {
    seen.add(e.id);
    let r = netEnemies.get(e.id);
    if (!r) { r = newNetEnemy(e); netEnemies.set(e.id, r); }
    pushBuf(r.buf, now, { x: +e.x, y: +e.y, z: +e.z, yaw: +e.r });
    r.hp = e.hp; r.max = e.mx; r.atk = !!e.a;
  }
  for (const [id] of netEnemies) if (!seen.has(id)) removeNetEnemy(id);
}

function applyShots(list, now) {
  const seen = new Set();
  for (const sh of list) {
    seen.add(sh.id);
    let r = netShots.get(sh.id);
    if (!r) {
      r = { m: new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshBasicMaterial({ color: 0xff7ae6 })), buf: [] };
      r.m.position.set(sh.x, sh.y, sh.z);
      scene.add(r.m); netShots.set(sh.id, r);
    }
    pushBuf(r.buf, now, { x: +sh.x, y: +sh.y, z: +sh.z });
  }
  for (const [id, r] of netShots) if (!seen.has(id)) { burst(r.m.position, 0xff7ae6, 3, 1.5); scene.remove(r.m); netShots.delete(id); }
}

// 待合室 ⇔ 試合 の切り替わり
function phaseChanged(a, b) {
  if (a === b) return;
  if (b === "lobby") {
    input.firing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    $("pause").hidden = true; game.paused = false;
  }
  if ((a === "lobby" || a === "") && ["break", "prep", "fight", "pvp"].includes(b)) {
    if (net.mode === "pvp") toast(`あなたは${TEAM_NAME[net.team]}チームです`, 3);
    if (!input.isTouch && !input.locked) {          // パソコンは、クリックしてマウス操作を始めてもらう
      game.paused = true;
      $("pause").hidden = false;
      $("pauseLead").textContent = "ゲームが始まりました。画面をクリックして参加しましょう";
    }
  }
}

// ---- 自分の位置を送る ----
export function netTick(dt) {
  net.sendT -= dt;
  if (net.sendT > 0 || !net.connected || P.dead || game.phase === "lobby") return;
  net.sendT = SEND_RATE;
  netSend({ t: "state", x: +P.pos.x.toFixed(3), y: +P.pos.y.toFixed(3), z: +P.pos.z.toFixed(3), yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3) });
}

export function clearNet() {
  for (const r of remotes.values()) scene.remove(r.g);
  remotes.clear();
  for (const id of [...netEnemies.keys()]) removeNetEnemy(id);
  for (const s of netShots.values()) scene.remove(s.m);
  netShots.clear();
}

// ---- 敵の表示 ----
function newNetEnemy(e) {
  const def = ET[e.t] || ET.walker;
  const m = makeEnemyMesh(def, e.t);
  const { bar, fg } = makeHealthBar();
  m.g.position.set(e.x, e.y, e.z);
  scene.add(m.g); scene.add(bar);
  return Object.assign(m, { type: e.t, def, pos: new V3(e.x, e.y, e.z), buf: [], walk: 0, last: null, flash: 0, hp: e.hp, max: e.mx, atk: false, bar, fg });
}
export function removeNetEnemy(id) {
  const r = netEnemies.get(id);
  if (!r) return;
  scene.remove(r.g); scene.remove(r.bar);
  netEnemies.delete(id);
}

// ---- 毎フレーム：補間して動かす ----
export function updateNetEnemies(now, dt) {
  const rt = now - INTERP_DELAY;
  for (const e of netEnemies.values()) {
    if (!e.buf.length) continue;
    const s = sample(e.buf, rt);
    const sp = e.last && dt > 0 ? Math.hypot(s.x - e.last.x, s.z - e.last.z) / dt : 0;
    e.last = { x: s.x, z: s.z };
    e.pos.set(s.x, s.y, s.z);
    e.g.position.copy(e.pos);
    e.g.rotation.y = s.yaw;
    e.walk += Math.min(sp, 6) * dt * 3;
    animateEnemy(e, sp > .2 ? Math.sin(e.walk) * .6 : 0, e.atk);
    e.flash -= dt;
    e.bodyMat.emissive.setHex(e.flash > 0 ? 0xffffff : 0x000000);
    e.bar.visible = e.hp < e.max;
    e.bar.position.set(e.pos.x, e.pos.y + e.def.h + .35, e.pos.z);
    e.bar.quaternion.copy(camera.quaternion);
    e.fg.scale.x = Math.max(0, e.hp / e.max);
  }
  for (const r of netShots.values()) {
    if (r.buf.length) { const s = sample(r.buf, rt); r.m.position.set(s.x, s.y, s.z); }
  }
}

export function updateRemotes(now, dt) {
  const rt = now - INTERP_DELAY;
  for (const r of remotes.values()) {
    if (!r.buf.length) continue;
    const s = sample(r.buf, rt);
    const sp = r.last && dt > 0 ? Math.hypot(s.x - r.last.x, s.z - r.last.z) / dt : 0;
    r.last = { x: s.x, z: s.z };
    r.walk += Math.min(sp, 8) * dt * 2.2;
    const sw = sp > .3 ? Math.sin(r.walk) * .7 : 0;
    r.legL.rotation.x = sw; r.legR.rotation.x = -sw; r.armL.rotation.x = -sw * .8;
    r.armR.rotation.x = -1.2 - s.pitch * .6;
    r.g.position.set(s.x, s.y, s.z);
    r.g.rotation.y = s.yaw + Math.PI;
    r.head.rotation.x = -s.pitch * .8;
  }
}
