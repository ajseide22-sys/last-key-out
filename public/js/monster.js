// The monster: a big purple jaw on legs. Host moves it; everyone animates it from shared state.
import * as THREE from 'three';
import { toon, outline } from './props.js';

export function makeMonster(parent) {
  const g = new THREE.Group(); g.scale.setScalar(1.35); parent.add(g);
  const skin = new THREE.MeshToonMaterial({ color: 0x4a2466, side: THREE.DoubleSide });
  const mouthM = new THREE.MeshToonMaterial({ color: 0x7a0e22, emissive: 0x4a0010, side: THREE.DoubleSide });
  const toothM = toon(0xf6eedc), eyeM = new THREE.MeshBasicMaterial({ color: 0xffe14d }), pupil = new THREE.MeshBasicMaterial({ color: 0x110000 });
  const add = (geo, m, x, y, z, p, ink = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; if (ink) outline(o, .03); p.add(o); return o; };
  const pvU = new THREE.Group(); pvU.position.set(0, 1.75, -1.35); g.add(pvU);
  add(new THREE.SphereGeometry(1.45, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 0, 1.35, pvU);
  const um = add(new THREE.CircleGeometry(1.42, 28), mouthM, 0, -.01, 1.35, pvU, false); um.rotation.x = Math.PI / 2;
  const pvL = new THREE.Group(); pvL.position.set(0, 1.75, -1.2); g.add(pvL);
  const lo = add(new THREE.SphereGeometry(1.3, 28, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin, 0, 0, 1.2, pvL); lo.scale.y = .75;
  const lm = add(new THREE.CircleGeometry(1.27, 28), mouthM, 0, .01, 1.2, pvL, false); lm.rotation.x = -Math.PI / 2;
  const tg = add(new THREE.SphereGeometry(.5, 12, 8), toon(0xc22a44), 0, .05, 1.5, pvL); tg.scale.set(1, .3, 1.4);
  const tooth = new THREE.ConeGeometry(.11, .38, 6);
  for (let a = -1.25; a <= 1.26; a += .21) {
    const t = new THREE.Mesh(tooth, toothM); t.position.set(Math.sin(a) * 1.32, -.16, 1.35 + Math.cos(a) * 1.32); t.rotation.x = Math.PI; pvU.add(t);
    const b = new THREE.Mesh(tooth, toothM); b.position.set(Math.sin(a + .1) * 1.17, .14, 1.2 + Math.cos(a + .1) * 1.17); b.scale.setScalar(.8); pvL.add(b);
  }
  [[-.55, .95, 1.0, .24], [.55, .95, 1.0, .24], [-.2, 1.25, .75, .14], [.25, 1.3, .72, .12]].forEach(([x, y, z, r]) => { const e = add(new THREE.SphereGeometry(r, 12, 8), eyeM, x, y, z + 1.35, pvU); const pp = new THREE.Mesh(new THREE.BoxGeometry(r * .35, r * 1.5, .05), pupil); pp.position.z = r * .95; e.add(pp); });
  [-1, 1].forEach(s => { const h = add(new THREE.ConeGeometry(.2, .8, 8), toothM, s * .85, 1.2, .9, pvU); h.rotation.z = -s * .5; h.rotation.x = -.2; });
  const legs = [-1, 1].map(s => { const l = new THREE.Group(); l.position.set(s * .75, 1.05, -.3); g.add(l); add(new THREE.CylinderGeometry(.26, .32, 1.05, 10), skin, 0, -.5, 0, l); add(new THREE.BoxGeometry(.55, .2, .75), skin, 0, -1, .15, l); return l; });
  const arms = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(s * 1.35, 1.6, -.2); g.add(a); add(new THREE.CylinderGeometry(.16, .2, 1.6, 8), skin, 0, -.75, 0, a); for (let c = -1; c <= 1; c++) { const cl = new THREE.Mesh(new THREE.ConeGeometry(.06, .32, 5), toothM); cl.position.set(c * .1, -1.65, .05); cl.rotation.x = Math.PI; a.add(cl); } return a; });
  const ml = new THREE.PointLight(0xff2a3a, 20, 10, 1.5); ml.position.set(0, 1.75, 1.4); g.add(ml);
  return { g, pvU, pvL, legs, arms, walk: 0, rx: 0, rz: 0, rf: 0 };
}

// Animate from the shared monster state m = { x, z, face, open, chew, moving }
export function animMonster(M, m, dt, t) {
  const k = Math.min(1, dt * 12);
  M.rx += (m.x - M.rx) * k; M.rz += (m.z - M.rz) * k;
  let df = m.face - M.rf; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; M.rf += df * k;
  M.walk += dt * (m.moving ? 7 : 2); const s = Math.sin(M.walk);
  M.legs[0].rotation.x = m.moving ? s * .5 : 0; M.legs[1].rotation.x = m.moving ? -s * .5 : 0;
  M.arms[0].rotation.x = m.moving ? -s * .6 : Math.sin(t * 1.5) * .15; M.arms[1].rotation.x = m.moving ? s * .6 : -Math.sin(t * 1.5) * .15;
  M.arms[0].rotation.z = -.25; M.arms[1].rotation.z = .25;
  const open = m.chew > 0 ? .15 + Math.abs(Math.sin(t * 18)) * .35 : m.open;
  M.pvU.rotation.x = -open * .9; M.pvL.rotation.x = open * .45;
  M.ry = (M.ry ?? (m.y || 0)) + ((m.y || 0) - (M.ry ?? 0)) * k;
  M.g.position.set(M.rx, M.ry + (m.moving ? Math.abs(s) * .15 : Math.sin(t * 2) * .05), M.rz); M.g.rotation.y = M.rf;
}

// Host-side chase step. Mutates m and returns the id of a player it just ate, if any.
export function stepMonster(m, dt, players, elapsed) {
  if (m.chew > 0) { m.chew -= dt; m.moving = false; return null; }
  if (m.wait > 0) { m.wait -= dt; m.open = .7; m.moving = false; return null; }
  const alive = players.filter(p => !p.eaten);
  if (!alive.length) { m.open = .1; m.moving = false; return null; }
  let tgt = null, best = 1e9; alive.forEach(p => { const d = Math.hypot(p.x - m.x, p.z - m.z); if (d < best) { best = d; tgt = p; } });
  const sp = elapsed < 2.5 ? 4 : 7.4, dx = tgt.x - m.x, dz = tgt.z - m.z, d = Math.hypot(dx, dz);
  m.moving = d > 2;
  if (m.moving) { m.x += dx / d * sp * dt; m.z += dz / d * sp * dt; }
  m.face = Math.atan2(dx, dz);
  m.y = (m.y || 0) + (Math.max(0, (tgt.y || 0) - 1) - (m.y || 0)) * Math.min(1, dt * 3); // climbs up to players on platforms
  m.open = d < 6 ? 1 : .4;
  if (d < 2.2 && Math.abs((tgt.y || 0) - 1 - (m.y || 0)) < 2.5) { m.chew = .8; return tgt.id; }
  return null;
}
