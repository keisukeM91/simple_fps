// 一人用の進行：ウェーブ、拠点コアの体力、やられたとき、ゲームオーバー

import { $, loadLocal, saveLocal } from "../core/util.js";
import { game, P, input } from "../core/state.js";
import { SFX } from "../audio/sfx.js";
import { toast, flashHurt, setBanner } from "../ui/hud.js";
import { showSoloOver } from "../ui/results.js";
import { enemies, spawnEnemy, updateEnemies, updateEnemyShots } from "./soloEnemies.js";

let best = +loadLocal("blockdef_best", 0) || 0;
export const getBest = () => best;

export function startWave() {
  game.wave++; game.phase = "fight";
  const n = game.wave, q = [];
  for (let i = 0; i < 3 + n * 2; i++) q.push("walker");
  if (n >= 2) for (let i = 0; i < Math.floor(n * 1.2); i++) q.push("shooter");
  if (n >= 3) for (let i = 0; i < Math.floor((n - 1) / 2); i++) q.push("brute");
  for (let i = q.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [q[i], q[j]] = [q[j], q[i]]; }
  game.queue = q; game.spawnT = 1;
  SFX.wave();
  setBanner(`ウェーブ ${n} 開始！`, 1800);
  $("bNext").hidden = true;
}

// 1フレーム分の一人用の処理
export function updateSolo(dt) {
  if (game.phase === "break") {
    game.breakT -= dt;
    setBanner(game.wave === 0 ? `ロボットが来るまで ${Math.ceil(game.breakT)} 秒` : `ウェーブ ${game.wave} クリア！ 次まで ${Math.ceil(game.breakT)} 秒`);
    $("bNext").hidden = false;
    if (game.breakT <= 0) startWave();
  } else {
    game.spawnT -= dt;
    if (game.queue.length && game.spawnT <= 0) { spawnEnemy(game.queue.pop()); game.spawnT = Math.max(.45, 1.7 - game.wave * .09); }
    if (!game.queue.length && !enemies.length) { game.phase = "break"; game.breakT = 12; game.blocks += 5; toast("ボーナス +5 板", 2); }
  }
  updateEnemies(dt);
  updateEnemyShots(dt);
  game.coreHit -= dt; game.warnT -= dt;
}

export function hurtPlayer(d) {
  if (P.dead) return;
  P.hp -= d; P.lastHurt = game.time;
  flashHurt(d);
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.respawn = 4; input.firing = false; toast("やられた！ 拠点で復活します", 2.5); }
}

export function hurtCore(d) {
  game.core -= d; game.coreHit = .15; game.warnT = 1.5;
  if (Math.random() < .3) SFX.core();
  if (game.core <= 0) { game.core = 0; gameOver(); }
}

function gameOver() {
  game.over = true; game.running = false; input.firing = false;
  if (document.pointerLockElement) document.exitPointerLock();
  if (game.score > best) { best = game.score; saveLocal("blockdef_best", best); }
  showSoloOver({ wave: game.wave, kills: game.kills, score: game.score, best });
}
