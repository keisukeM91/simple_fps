// 拠点コアの見た目（協力・一人用は1つ、対戦は赤と青の2つ）

import { G } from "../core/config.js";
import { game } from "../core/state.js";
import { scene } from "./scene.js";
import { T } from "./textures.js";

export const coreList = [];
const coreHitT = {};          // チームごとの「攻撃された」光り残り時間

// list: [{team, x, z, color}]
export function setCores(list) {
  for (const c of coreList) scene.remove(c.g);
  coreList.length = 0;
  for (const c of list) {
    const col = new THREE.Color(c.color);
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1, .5, 1), new THREE.MeshLambertMaterial({ map: T.stone }));
    ped.position.y = .25;
    const mat = new THREE.MeshLambertMaterial({ color: col, emissive: col.clone().multiplyScalar(.45) });
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.55, 0), mat);
    cr.position.y = 1.25;
    const light = new THREE.PointLight(col, 1.1, 9);
    light.position.y = 1.3;
    g.add(ped, cr, light);
    g.position.set(c.x + .5, G, c.z + .5);
    scene.add(g);
    coreList.push({ team: c.team, g, cr, mat, base: mat.emissive.getHex(), color: col.getHex() });
  }
}

export const SOLO_CORE = { team: "all", color: "#5fe3ff" };

export function flashCore(team) { coreHitT[team] = .15; }

export function animateCores(now, dt) {
  for (const k in coreHitT) coreHitT[k] -= dt;
  for (const c of coreList) {
    c.cr.rotation.y += dt * 1.2;
    c.cr.position.y = 1.25 + Math.sin(now * .002) * .08;
    const hit = (coreHitT[c.team] || 0) > 0 || (game.mode !== "online" && game.coreHit > 0);
    c.mat.emissive.setHex(hit ? 0xff3030 : c.base);
  }
}
