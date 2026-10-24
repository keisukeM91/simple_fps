// ゲーム全体で使う決まった値
// ※ ワールドの大きさ・ブロックの番号・体の大きさは server/config.py と同じ値にすること

// ワールド（W×D マス、高さ H）。拠点は (CX, CZ)、地面の高さは G
export const W = 48, D = 48, H = 16, CX = 24, CZ = 24, G = 4;

// ブロックの種類
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, PLANK = 4, LOG = 5, LEAF = 6, CORE = 9;
export const PLANK_MAX = 4;          // 木の板の耐久（叩かれる回数）

// プレイヤーの体（幅の半分・身長・目の高さ）
export const PW = .3, PH = 1.7, EYE = 1.55;
export const LOOK_SENS = .0024;      // マウスの視点感度

// 空の色
export const SKY = 0x9fd3ff;

// 敵ロボットの種類（一人用の強さと、見た目の色）
export const ET = {
  walker:  { name: "ボット",     hp: 60,  spd: 1.7, body: 0x4f9a63, acc: 0x255c34, eye: 0xffe14d, w: .8,  h: 1.7, melee: 12, wood: 1, reward: 2, score: 10 },
  shooter: { name: "射撃ボット", hp: 45,  spd: 2.3, body: 0x8a63c9, acc: 0x46297a, eye: 0xff7ae6, w: .75, h: 1.6, melee: 0,  wood: 0, reward: 2, score: 15 },
  brute:   { name: "重装ボット", hp: 230, spd: 1.1, body: 0xd9822b, acc: 0x7a3f0e, eye: 0xff4a3a, w: 1.25, h: 2.3, melee: 26, wood: 2, reward: 5, score: 40 },
};

// 対戦のチーム
export const TEAM_NAME = { red: "赤", blue: "青" };
export const TEAM_COLOR = { red: "#ff5a5a", blue: "#5fa8ff" };

// 通信
export const SEND_RATE = 1 / 20;     // 自分の位置を送る間隔（秒）
export const INTERP_DELAY = 120;     // 他の人や敵を何ms遅れで表示するか（server/config.py の INTERP_DELAY と合わせる）
