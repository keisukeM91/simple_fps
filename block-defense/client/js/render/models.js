// キャラクターの見た目：敵ロボット・他のプレイヤー・名札・体力バー

// ---- 体力バー（頭の上に出る） ----
const BARBG = new THREE.MeshBasicMaterial({ color: 0x101010, depthTest: false, transparent: true });
const BARFG = new THREE.MeshBasicMaterial({ color: 0xff5a5a, depthTest: false, transparent: true });
const barGeo = new THREE.PlaneGeometry(1, .12);
const barFgGeo = new THREE.PlaneGeometry(1, .1);
barFgGeo.translate(.5, 0, 0);   // 左端を基準に縮むようにする

export function makeHealthBar() {
  const bar = new THREE.Group();
  const bg = new THREE.Mesh(barGeo, BARBG);
  const fg = new THREE.Mesh(barFgGeo, BARFG);
  fg.position.set(-.5, 0, .001);
  bg.renderOrder = 10; fg.renderOrder = 11;
  bar.add(bg, fg);
  bar.visible = false;
  return { bar, fg };
}

// ---- 敵ロボット ----
export function makeEnemyMesh(def, type) {
  const g = new THREE.Group();
  const s = def.h / 1.7;
  const bodyMat = new THREE.MeshLambertMaterial({ color: def.body, emissive: 0x000000 });
  const accMat = new THREE.MeshLambertMaterial({ color: def.acc });
  const eyeMat = new THREE.MeshBasicMaterial({ color: def.eye });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(.26, .6, .3), accMat);
  legL.geometry.translate(0, -.3, 0); legL.position.set(-.17, .6, 0);
  const legR = legL.clone(); legR.position.x = .17;
  const body = new THREE.Mesh(new THREE.BoxGeometry(.72, .62, .48), bodyMat); body.position.y = .92;
  const head = new THREE.Mesh(new THREE.BoxGeometry(.6, .48, .52), bodyMat); head.position.y = 1.48;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(.48, .14, .04), new THREE.MeshBasicMaterial({ color: 0x111522 })); visor.position.set(0, 1.5, .27);
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(.1, .07, .03), eyeMat); eyeL.position.set(-.11, 1.5, .3);
  const eyeR = eyeL.clone(); eyeR.position.x = .11;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(.18, .5, .2), accMat);
  armL.geometry.translate(0, -.2, 0); armL.position.set(-.46, 1.15, 0);
  const armR = armL.clone(); armR.position.x = .46;
  g.add(legL, legR, body, head, visor, eyeL, eyeR, armL, armR);
  if (type === "shooter") {
    const ant = new THREE.Mesh(new THREE.BoxGeometry(.05, .3, .05), accMat); ant.position.set(0, 1.85, 0);
    const ball = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .12), eyeMat); ball.position.set(0, 2.02, 0);
    const blaster = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, .4), new THREE.MeshLambertMaterial({ color: 0x2a3040 })); blaster.position.set(.46, .95, .25);
    g.add(ant, ball, blaster);
  }
  if (type === "brute") {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(1, .18, .6), accMat); sh.position.y = 1.26;
    g.add(sh);
  }
  g.scale.setScalar(s);
  return { g, bodyMat, legL, legR, armL, armR };
}

// 敵ロボットの手足の動き（一人用・オンライン共通）
export function animateEnemy(e, swing, attacking) {
  e.legL.rotation.x = swing; e.legR.rotation.x = -swing;
  e.armL.rotation.x = -swing * .7;
  e.armR.rotation.x = e.type === "shooter" ? -1.3 : swing * .7;
  if (attacking && e.type !== "shooter") e.armL.rotation.x = e.armR.rotation.x = -1.6;
}

// ---- 名札 ----
export function nameTag(name, color) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(11,16,32,.78)";
  g.fillRect(0, 10, 256, 44);
  g.font = '30px "DotGothic16","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif';
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(name, 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(1.6, .4, 1);
  s.renderOrder = 20;
  return s;
}

// ---- 他のプレイヤー ----
export function makeAvatar(name, color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2d3550 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf0c9a0 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x101522 });
  const leg = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.22, .75, .26), pants); m.geometry.translate(0, -.375, 0); return m; };
  const legL = leg(), legR = leg();
  legL.position.set(-.12, .75, 0); legR.position.set(.12, .75, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.56, .66, .3), shirt); body.position.y = 1.08;
  const arm = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.18, .62, .22), shirt); m.geometry.translate(0, -.28, 0); return m; };
  const armL = arm(), armR = arm();
  armL.position.set(-.38, 1.38, 0); armR.position.set(.38, 1.38, 0);
  const head = new THREE.Group(); head.position.y = 1.42;
  const face = new THREE.Mesh(new THREE.BoxGeometry(.46, .46, .46), skin); face.position.y = .23;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(.48, .12, .48), shirt); hair.position.y = .44;
  const eL = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .02), dark); eL.position.set(-.1, .26, .235);
  const eR = eL.clone(); eR.position.x = .1;
  head.add(face, hair, eL, eR);
  const blaster = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .42), new THREE.MeshLambertMaterial({ color: 0x3a4256 }));
  blaster.position.set(0, -.52, .18);
  armR.add(blaster);
  const tag = nameTag(name, color); tag.position.y = 2.2;
  g.add(legL, legR, body, armL, armR, head, tag);
  return { g, legL, legR, armL, armR, head };
}
