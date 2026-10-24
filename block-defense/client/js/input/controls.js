// パソコンの操作：キーボード・マウス・視点固定（ポインターロック）・一時停止

import { LOOK_SENS } from "../core/config.js";
import { $, clamp } from "../core/util.js";
import { game, P, input } from "../core/state.js";
import { canvas } from "../render/scene.js";
import { audioInit, toggleMute } from "../audio/sfx.js";
import { toast } from "../ui/hud.js";
import { jump } from "../player/player.js";
import { placeBlock, breakBlock } from "../player/actions.js";
import { skipBreak } from "../game/session.js";

// マウスで視点を動かすために、カーソルを画面に固定する
export function requestLock() {
  try {
    const r = canvas.requestPointerLock && canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => { input.lockFailed = true; });
  } catch (e) { input.lockFailed = true; }
}

export function resume() {
  $("pause").hidden = true;
  game.paused = false;
  if (!input.isTouch) requestLock();
}

// 待合室にいる間は一時停止画面を出さない
const inLobby = () => game.mode === "online" && (game.phase === "lobby" || game.phase === "wait");

export function initControls() {
  addEventListener("keydown", e => {
    if (!game.running) return;
    input.keys.add(e.code);
    if (e.code === "Space") { e.preventDefault(); jump(); }
    if (e.code === "KeyF") breakBlock();
    if (e.code === "KeyE") placeBlock();
    if (e.code === "KeyN") skipBreak();
    if (e.code === "KeyM") toast(toggleMute() ? "音を消しました" : "音を出します");
  });
  addEventListener("keyup", e => input.keys.delete(e.code));
  addEventListener("blur", () => { input.keys.clear(); input.firing = false; });

  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("mousedown", e => {
    if (!game.running || input.isTouch) return;
    audioInit();
    if (!input.locked && !input.lockFailed) { requestLock(); return; }
    if (e.button === 0) input.firing = true;
    if (e.button === 2) placeBlock();
  });
  addEventListener("mouseup", e => { if (e.button === 0) input.firing = false; });
  addEventListener("mousemove", e => {
    if (!game.running || game.paused || input.isTouch) return;
    if (input.locked || input.lockFailed) {
      P.yaw -= e.movementX * LOOK_SENS;
      P.pitch = clamp(P.pitch - e.movementY * LOOK_SENS, -1.5, 1.5);
    }
  });

  // Esc などで視点固定が外れたら一時停止
  document.addEventListener("pointerlockchange", () => {
    input.locked = document.pointerLockElement === canvas;
    if (!input.locked && game.running && !input.isTouch && !game.over && !inLobby()) {
      game.paused = true;
      input.firing = false;
      $("pause").hidden = false;
      $("pauseLead").textContent = game.mode === "online"
        ? "みんなで遊んでいる間は、ゲームは止まらずに進みます。画面をクリックすると戻ります"
        : "画面をクリックすると再開します";
    }
  });
  document.addEventListener("pointerlockerror", () => { input.lockFailed = true; });
  $("bResume").addEventListener("click", resume);
  $("pause").addEventListener("click", resume);
}
