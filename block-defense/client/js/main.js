// 入口：準備をして、毎フレームの処理（メインループ）を回す
//
// フォルダの役割
//   core/    決まった値・小さな道具・共有の状態
//   world/   ブロックの世界のデータ・地形づくり・視線の当たり判定
//   render/  3D表示（シーン・ブロック・キャラクター・コア・演出）
//   audio/   効果音
//   input/   パソコンとタッチの操作
//   player/  自分の体の動きと行動（撃つ・置く・こわす）
//   game/    一人用の進行と敵、ゲームの始まりと終わり
//   net/     サーバーとの通信と、届いた内容の反映
//   ui/      画面表示（HUD・待合室・結果）

import { CX, CZ, G, EYE, PLANK } from "./core/config.js";
import { game, P } from "./core/state.js";
import { buildSoloWorld } from "./world/generate.js";
import { renderer, scene, camera, gun, highlight, resize, updateClouds } from "./render/scene.js";
import { rebuild } from "./render/blocks.js";
import { setCores, animateCores, SOLO_CORE } from "./render/cores.js";
import { updateEffects } from "./render/effects.js";
import { initControls } from "./input/controls.js";
import { initTouch } from "./input/touch.js";
import { spawnPlayer, updatePlayer } from "./player/player.js";
import { targetBlock } from "./player/actions.js";
import { updateSolo } from "./game/solo.js";
import { initScreens } from "./game/session.js";
import { net } from "./net/connection.js";
import { netTick, updateNetEnemies, updateRemotes } from "./net/sync.js";
import { initLobby } from "./ui/lobby.js";
import { updateHud } from "./ui/hud.js";

let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;

  const online = game.running && game.mode === "online";
  const active = game.running && !game.paused;

  // ---- ゲームの中身 ----
  if (online) {
    // 敵やウェーブはサーバーが動かすので、ここでは自分の移動と表示だけ
    game.time += dt;
    if (!game.paused && !["over", "lobby", "wait"].includes(game.phase)) updatePlayer(dt);
    netTick(dt);
    updateNetEnemies(now, dt);
    game.coreHit -= dt; game.warnT -= dt;
  } else if (active) {
    game.time += dt;
    updatePlayer(dt);
    updateSolo(dt);
  }

  // ---- 演出（一時停止中も動かす） ----
  updateEffects(dt);
  updateRemotes(now, dt);
  updateClouds(dt);
  animateCores(now, dt);

  // ---- カメラ ----
  if (!game.running && !game.over) P.yaw += dt * .08;      // タイトル画面ではゆっくり見回す
  P.kick = Math.max(0, P.kick - dt * 10);
  const spectate = P.dead || (game.mode === "online" && (game.phase === "lobby" || game.phase === "wait"));
  if (spectate) {        // やられている間・待合室では、上空から拠点を眺める
    const r = game.mode === "online" && net.mode === "pvp" ? 20 : 10;
    camera.position.set(CX + .5 + Math.sin(now * .0004) * r, G + 8 + r * .3, CZ + .5 + Math.cos(now * .0004) * r);
    camera.lookAt(CX + .5, G + 1, CZ + .5);
  } else {
    camera.position.set(P.pos.x, P.pos.y + EYE, P.pos.z);
    camera.rotation.set(P.pitch + P.kick * .03, P.yaw, 0);
  }
  gun.visible = game.running && !spectate;
  gun.position.z = -.62 + P.kick * .05;

  // ---- 狙っているブロックの枠 ----
  if ((active || online) && !spectate && game.phase !== "over") {
    const h = targetBlock();
    if (h && !h.oob) {
      highlight.visible = true;
      highlight.position.set(h.x + .5, h.y + .5, h.z + .5);
      highlight.material.color.setHex(h.v === PLANK ? 0xffd25a : 0x101010);
    } else highlight.visible = false;
  } else highlight.visible = false;

  renderer.render(scene, camera);
  updateHud(dt);
}

function init() {
  initControls();
  initTouch();
  initLobby();
  initScreens();
  addEventListener("resize", resize);
  resize();
  // タイトル画面の背景として、一人用の地形を出しておく
  buildSoloWorld();
  rebuild();
  setCores([{ ...SOLO_CORE, x: CX, z: CZ }]);
  spawnPlayer();
  P.yaw = Math.PI * .75; P.pitch = -.2;
  requestAnimationFrame(frame);

  // 自動テスト用：アドレスの最後に ?debug を付けたときだけ、中の状態を外から見られるようにする
  if (new URLSearchParams(location.search).has("debug")) {
    import("./debug.js").then(m => m.expose());
  }
}

init();
