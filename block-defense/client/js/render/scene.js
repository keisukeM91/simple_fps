// 3D表示の土台：描画機・シーン・カメラ・光・背景・手持ちの銃・狙いの枠

import { CX, CZ, SKY } from "../core/config.js";
import { $, V3, rng } from "../core/util.js";

export const canvas = $("cv");
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));

export const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 26, 68);

export const camera = new THREE.PerspectiveCamera(75, 1, .05, 200);
camera.rotation.order = "YXZ";
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x56703c, .9));
const sun = new THREE.DirectionalLight(0xfff4dc, .75);
sun.position.set(.6, 1, .35);
scene.add(sun);

// 島の外側の地面
const outer = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshLambertMaterial({ color: 0x5f9e40 }));
outer.rotation.x = -Math.PI / 2;
outer.position.set(CX, 1.95, CZ);
scene.add(outer);

// 雲
const clouds = [];
for (let i = 0; i < 14; i++) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(6 + rng() * 10, 1.2, 4 + rng() * 6), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  c.position.set(rng() * 160 - 56, 26 + rng() * 6, rng() * 160 - 56);
  scene.add(c); clouds.push(c);
}
export function updateClouds(dt) {
  for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 110) c.position.x = -60; }
}

// 狙っているブロックの枠
export const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
  new THREE.LineBasicMaterial({ color: 0x101010 }));
highlight.visible = false;
scene.add(highlight);

// 手持ちのブラスター（カメラにくっつける）
export const gun = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(.14, .14, .5), new THREE.MeshLambertMaterial({ color: 0x3a4256 }));
export const gunTop = new THREE.Mesh(new THREE.BoxGeometry(.1, .06, .3), new THREE.MeshLambertMaterial({ color: 0xffd25a }));
gunTop.position.set(0, .1, -.02);
const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(.1, .18, .1), new THREE.MeshLambertMaterial({ color: 0x2a3040 }));
gunGrip.position.set(0, -.13, .13);
export const gunTip = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .06), new THREE.MeshBasicMaterial({ color: 0x5fe3ff }));
gunTip.position.set(0, 0, -.28);
gun.add(gunBody, gunTop, gunGrip, gunTip);
gun.position.set(.34, -.3, -.62);
gun.scale.setScalar(.7);
camera.add(gun);

// カメラの位置と向き（視線の計算に使う）
export const camPos = new V3(), camDir = new V3();
export function viewRay() {
  camera.getWorldPosition(camPos);
  camera.getWorldDirection(camDir);
}

export function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
