// 複数のモジュールで共有する「いまの状態」
// ここにあるオブジェクトは中身を書き換えて使う（変数そのものを置き換えない）

import { V3 } from "./util.js";

// ゲームの進み具合
// mode: "solo"（ひとりで）/ "online"（みんなで）
// phase: 一人用は break・fight。オンラインはサーバーから届く lobby・break・fight・prep・pvp・over など
export const game = {
  mode: "solo", running: false, paused: false, over: false, time: 0,
  wave: 0, score: 0, kills: 0, blocks: 20, core: 600, coreMax: 600,
  phase: "break", breakT: 15, queue: [], spawnT: 0, coreHit: 0, warnT: 0,
};

// 自分（プレイヤー）
export const P = {
  pos: new V3(), vel: new V3(), yaw: Math.PI, pitch: -.05, hp: 100,
  onGround: false, dead: false, respawn: 0, lastHurt: -9, cd: 0, kick: 0,
};

// 入力の状態
export const input = {
  keys: new Set(), firing: false, isTouch: false, locked: false, lockFailed: false,
  joy: { id: null, ox: 0, oy: 0, x: 0, y: 0 },   // 画面左下のスティック
  look: { id: null, lx: 0, ly: 0 },              // 画面右側をなぞる視点操作
};

// 見た目に関する設定
export const view = { tracerColor: 0x5fe3ff };    // 自分の光線の色
