// ブロックの世界を画面に描く
// 外から見える面があるブロックだけを、種類ごとにまとめて描く（InstancedMesh）

import { W, D, H, AIR, CORE, GRASS, DIRT, STONE, PLANK, LOG, LEAF } from "../core/config.js";
import { vox, idx, get } from "../world/voxels.js";
import { scene } from "./scene.js";
import { MAT } from "./textures.js";

const BOX = new THREE.BoxGeometry(1, 1, 1);
const blockMeshes = {};
const _m = new THREE.Matrix4();

export function rebuild() {
  const lists = {};
  for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const v = vox[idx(x, y, z)];
    if (v === AIR || v === CORE) continue;
    // 6方向すべてがふさがっていれば見えないので描かない
    if (get(x + 1, y, z) && get(x - 1, y, z) && get(x, y + 1, z) && get(x, y - 1, z) && get(x, y, z + 1) && get(x, y, z - 1)) continue;
    (lists[v] || (lists[v] = [])).push(x, y, z);
  }
  for (const t of [GRASS, DIRT, STONE, PLANK, LOG, LEAF]) {
    if (blockMeshes[t]) { scene.remove(blockMeshes[t]); blockMeshes[t].dispose(); }
    const a = lists[t] || [], n = a.length / 3;
    const im = new THREE.InstancedMesh(BOX, MAT[t], Math.max(n, 1));
    im.count = n;
    for (let i = 0; i < n; i++) { _m.makeTranslation(a[i * 3] + .5, a[i * 3 + 1] + .5, a[i * 3 + 2] + .5); im.setMatrixAt(i, _m); }
    im.instanceMatrix.needsUpdate = true;
    blockMeshes[t] = im;
    scene.add(im);
  }
}
