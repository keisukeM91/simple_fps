// 演出：飛び散る小さなブロックと、撃ったときの光線

import { V3 } from "../core/util.js";
import { scene } from "./scene.js";

const parts = [];
const tracers = [];
const PGEO = new THREE.BoxGeometry(.14, .14, .14);

export function burst(p, color, n = 10, spd = 4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(PGEO, new THREE.MeshLambertMaterial({ color }));
    m.position.copy(p);
    scene.add(m);
    parts.push({ m, v: new V3((Math.random() - .5) * spd, Math.random() * spd * .9 + 1, (Math.random() - .5) * spd), life: .5 + Math.random() * .4 });
  }
}

export function tracer(a, b, color = 0x5fe3ff) {
  const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
  scene.add(l);
  tracers.push({ l, life: .08 });
}

export function updateEffects(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt; p.v.y -= 14 * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.rotation.x += dt * 6;
    if (p.life <= 0) { scene.remove(p.m); parts.splice(i, 1); }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.l.material.opacity = Math.max(0, t.life / .08);
    if (t.life <= 0) { scene.remove(t.l); t.l.geometry.dispose(); tracers.splice(i, 1); }
  }
}
