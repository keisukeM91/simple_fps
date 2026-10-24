// 効果音（音声ファイルを使わず、その場で音を作る）

let actx = null;
let muted = false;

// 音はユーザーが画面を操作したあとでないと鳴らせないので、ボタンを押したときに呼ぶ
export function audioInit() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
  } catch (e) { /* 音が使えなくてもゲームは続ける */ }
}

export function toggleMute() { muted = !muted; return muted; }

export function beep(f1, f2, dur, type = "square", vol = .08) {
  if (!actx || muted) return;
  try {
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f2, 30), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + dur + .02);
  } catch (e) { /* 無視 */ }
}

export const SFX = {
  shot: () => beep(1200, 300, .09, "square", .05),
  hit: () => beep(500, 180, .08, "triangle", .09),
  kill: () => { beep(300, 80, .25, "sawtooth", .07); beep(900, 1400, .12, "square", .04); },
  place: () => beep(220, 180, .07, "triangle", .12),
  brk: () => beep(160, 60, .12, "sawtooth", .08),
  hurt: () => beep(200, 90, .18, "sawtooth", .1),
  core: () => beep(140, 100, .15, "square", .06),
  wave: () => { beep(440, 440, .12, "square", .06); setTimeout(() => beep(660, 660, .18, "square", .06), 130); },
  enemyShot: () => beep(700, 400, .1, "triangle", .04),
  otherShot: () => beep(1100, 320, .08, "square", .02),
  otherKill: () => beep(300, 90, .2, "sawtooth", .03),
  coreHitMine: () => beep(260, 200, .06, "square", .05),
};
