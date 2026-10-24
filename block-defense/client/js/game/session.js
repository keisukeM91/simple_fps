// ゲームの始まりと終わり：タイトル画面 → 一人用 / みんなで遊ぶ → タイトルへ戻る

import { CX, CZ } from "../core/config.js";
import { $, loadLocal, saveLocal } from "../core/util.js";
import { game, input } from "../core/state.js";
import { buildSoloWorld } from "../world/generate.js";
import { rebuild } from "../render/blocks.js";
import { setCores, SOLO_CORE } from "../render/cores.js";
import { audioInit } from "../audio/sfx.js";
import { toast, setBanner, resetHudLabels } from "../ui/hud.js";
import { requestLock } from "../input/controls.js";
import { spawnPlayer } from "../player/player.js";
import { clearSoloEnemies } from "./soloEnemies.js";
import { getBest } from "./solo.js";
import { netSend, connect, disconnect } from "../net/connection.js";

function playerName() {
  const v = $("nameIn").value.trim().slice(0, 12);
  saveLocal("blockdef_name", v);
  return v;
}

// mode: "solo"（ひとりで）または "online"（みんなで）
export function startGame(mode = "solo") {
  if (mode !== "online") disconnect();
  buildSoloWorld(); rebuild();
  clearSoloEnemies();
  Object.assign(game, {
    mode, running: true, paused: false, over: false, time: 0, wave: 0, score: 0, kills: 0,
    blocks: 20, core: 600, phase: "break", breakT: 15, queue: [], spawnT: 0,
  });
  if (mode === "online") { game.phase = "wait"; game.blocks = 0; }
  setBanner("");
  $("bNext").hidden = mode === "online";
  $("retryRow").hidden = mode === "online";
  $("overNote").textContent = "";
  spawnPlayer();
  resetHudLabels();
  if (mode === "online") { setCores([]); connect(playerName()); }
  else setCores([{ ...SOLO_CORE, x: CX, z: CZ }]);
  $("title").hidden = true;
  $("over").hidden = true;
  $("hud").hidden = mode === "online";
  $("touch").hidden = mode === "online" || !input.isTouch;
  if (mode !== "online") toast("まずは拠点のまわりを見てみよう", 2.5);
}

// 準備時間を終わらせる（Nキー・「すぐ始める」ボタン）
export function skipBreak() {
  if (game.mode === "online") {
    if (game.phase === "break" || game.phase === "prep") netSend({ t: "skip" });
    return;
  }
  if (game.running && game.phase === "break") game.breakT = 0;
}

export function backToTitle() {
  disconnect();
  game.running = false; game.paused = false; input.firing = false;
  for (const id of ["lobby", "hud", "touch", "over", "pause"]) $(id).hidden = true;
  $("title").hidden = false;
  document.body.classList.remove("pvp");
  if (document.pointerLockElement) document.exitPointerLock();
}

export function initScreens() {
  $("bStart").addEventListener("click", () => { audioInit(); startGame("solo"); if (!input.isTouch) requestLock(); });
  $("bOnline").addEventListener("click", () => { audioInit(); startGame("online"); });
  $("bRetry").addEventListener("click", () => { audioInit(); startGame("solo"); if (!input.isTouch) requestLock(); });
  $("bNext").addEventListener("click", e => { e.stopPropagation(); skipBreak(); });
  $("nameIn").value = loadLocal("blockdef_name", "");
  const best = getBest();
  $("bestT").textContent = best ? `ベストスコア ${best}` : "";
}

