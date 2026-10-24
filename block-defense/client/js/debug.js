// 自動テスト用の窓口（index.html?debug で開いたときだけ読み込まれる）
// ブラウザを自動操作するテストから、中の状態を読んだり、撃つ・置くを呼んだりするために使う

import { game, P } from "./core/state.js";
import { get, surface } from "./world/voxels.js";
import { shoot, placeBlock } from "./player/actions.js";
import { coreList } from "./render/cores.js";
import { net } from "./net/connection.js";
import { netEnemies, remotes } from "./net/sync.js";

export function expose() {
  window.__d = { game, P, net, netEnemies, remotes, coreList, get, surface, shoot, placeBlock };
}
