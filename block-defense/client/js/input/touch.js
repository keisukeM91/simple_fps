// タブレット・スマホの操作：左下のスティック・右側をなぞって視点・画面のボタン

import { $, clamp } from "../core/util.js";
import { game, P, input } from "../core/state.js";
import { audioInit } from "../audio/sfx.js";
import { jump } from "../player/player.js";
import { placeBlock, breakBlock } from "../player/actions.js";

export function enableTouch() {
  if (input.isTouch) return;
  input.isTouch = true;
  document.body.classList.add("touch");
  if (game.running) $("touch").hidden = false;
}

function holdBtn(id, down, up) {
  const b = $(id);
  b.addEventListener("pointerdown", e => { e.preventDefault(); audioInit(); b.classList.add("on"); down(); });
  const u = () => { b.classList.remove("on"); if (up) up(); };
  b.addEventListener("pointerup", u);
  b.addEventListener("pointercancel", u);
  b.addEventListener("pointerleave", u);
}

export function initTouch() {
  addEventListener("touchstart", enableTouch, { passive: true });
  if (matchMedia("(pointer:coarse)").matches) enableTouch();

  const { joy, look } = input;
  const jz = $("joyzone"), lz = $("lookzone"), joyEl = $("joy"), knob = $("knob");

  // スティック
  function moveJoy(e) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const m = Math.hypot(dx, dy), R = 48;
    if (m > R) { dx *= R / m; dy *= R / m; }
    joy.x = dx / R; joy.y = dy / R;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  }
  jz.addEventListener("pointerdown", e => {
    if (joy.id !== null) return;
    joy.id = e.pointerId; jz.setPointerCapture(e.pointerId);
    const r = joyEl.getBoundingClientRect();
    joy.ox = r.left + r.width / 2; joy.oy = r.top + r.height / 2;
    moveJoy(e);
  });
  jz.addEventListener("pointermove", e => { if (e.pointerId === joy.id) moveJoy(e); });
  const endJoy = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ""; } };
  jz.addEventListener("pointerup", endJoy);
  jz.addEventListener("pointercancel", endJoy);

  // 視点
  lz.addEventListener("pointerdown", e => {
    if (look.id !== null) return;
    look.id = e.pointerId; lz.setPointerCapture(e.pointerId);
    look.lx = e.clientX; look.ly = e.clientY;
    audioInit();
  });
  lz.addEventListener("pointermove", e => {
    if (e.pointerId !== look.id || game.paused) return;
    P.yaw -= (e.clientX - look.lx) * .006;
    P.pitch = clamp(P.pitch - (e.clientY - look.ly) * .006, -1.5, 1.5);
    look.lx = e.clientX; look.ly = e.clientY;
  });
  const endLook = e => { if (e.pointerId === look.id) look.id = null; };
  lz.addEventListener("pointerup", endLook);
  lz.addEventListener("pointercancel", endLook);

  // ボタン
  holdBtn("bFire", () => input.firing = true, () => input.firing = false);
  holdBtn("bPlace", () => placeBlock());
  holdBtn("bBreak", () => breakBlock());
  holdBtn("bJump", () => jump());
}
