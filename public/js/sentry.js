// Sentries: small spidery things that patrol the dark and hunt flashlights.
// The host runs their brains on a walk grid; everyone animates them from S.sentries = [{ x, z, f, st }].
import * as THREE from 'three';
import { toon, outline } from './props.js';
import { wallBetween } from './world.js';

/* ---------------- walk grid + BFS paths ---------------- */
export function buildNav(solids, W, D, cell = .5, R = .32) {
  const x0 = -W / 2, z0 = -D / 2, nx = Math.ceil(W / cell), nz = Math.ceil(D / cell), block = new Uint8Array(nx * nz);
  for (const s of solids) {
    if (!s.on) continue;
    const i0 = Math.max(0, Math.floor((s.x0 - R - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((s.x1 + R - x0) / cell));
    const j0 = Math.max(0, Math.floor((s.z0 - R - z0) / cell)), j1 = Math.min(nz - 1, Math.floor((s.z1 + R - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) block[j * nx + i] = 1;
  }
  // the room's own edge
  for (let i = 0; i < nx; i++) { block[i] = 1; block[(nz - 1) * nx + i] = 1; } for (let j = 0; j < nz; j++) { block[j * nx] = 1; block[j * nx + nx - 1] = 1; }
  const nav = { cell, x0, z0, nx, nz, block };
  nav.idx = (x, z) => { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
  nav.center = k => ({ x: x0 + (k % nx + .5) * cell, z: z0 + (Math.floor(k / nx) + .5) * cell });
  nav.free = k => k >= 0 && !block[k];
  nav.nearestFree = (x, z) => { const k = nav.idx(x, z); if (nav.free(k)) return k; for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const q = k + dj * nx + di; if (nav.free(q)) return q; } return -1; };
  const prev = new Int32Array(nx * nz), seen = new Uint32Array(nx * nz); let stamp = 1; const queue = new Int32Array(nx * nz);
  nav.path = (ax, az, bx, bz) => {
    const s = nav.nearestFree(ax, az), t = nav.nearestFree(bx, bz); if (s < 0 || t < 0) return null;
    stamp++; let h = 0, tl = 0; queue[tl++] = s; seen[s] = stamp; prev[s] = -1;
    while (h < tl) { const k = queue[h++]; if (k === t) break; const i = k % nx;
      const nb = [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx];
      for (const q of nb) { if (q < 0 || q >= nx * nz || seen[q] === stamp || block[q]) continue; seen[q] = stamp; prev[q] = k; queue[tl++] = q; } }
    if (seen[t] !== stamp) return null;
    const out = []; let k = t; while (k !== -1) { out.push(k); k = prev[k]; } out.reverse();
    return out.filter((_, i) => i % 3 === 0 || i === out.length - 1).map(nav.center);
  };
  nav.randomFree = rng => { for (let k = 0; k < 400; k++) { const q = Math.floor(rng() * nx * nz); if (nav.free(q)) return nav.center(q); } return { x: 0, z: 0 }; };
  return nav;
}

/* ---------------- host brain ---------------- */
// opts: { speed, sense, beam, grace(ms) }
export function stepSentries(S, brains, nav, players, now, dt, opts, rng, startAt) {
  const caught = [];
  S.sentries.forEach((s, i) => {
    const b = brains[i] || (brains[i] = { path: null, repath: 0, seen: 0, sx: 0, sz: 0, feed: 0 });
    if (s.st === 'feed') { b.feed -= dt; if (b.feed <= 0) { s.st = 'patrol'; b.path = null; } return; }
    // who is lighting me up?
    let tgt = null, best = 1e9;
    if (now > startAt + opts.grace) for (const p of players) {
      if (p.eaten || p.jailed || !p.fl) continue;
      const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz); if (d > opts.beam) continue;
      let lit = d < opts.sense;
      if (!lit) { const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), dot = (-dx * fx - dz * fz) / (d || 1); lit = dot > .94; } // they're shining the beam right at me
      if (!lit || wallBetween(s.x, s.z, p.x, p.z, nav.walls)) continue;
      if (d < best) { best = d; tgt = p; }
    }
    if (tgt) { if (s.st !== 'hunt') b.repath = 0; s.st = 'hunt'; b.seen = now; b.sx = tgt.x; b.sz = tgt.z; }
    else if (s.st === 'hunt' && now - b.seen > 3500) { s.st = 'patrol'; b.path = null; }
    // plan
    b.repath -= dt;
    if (s.st === 'hunt' && b.repath <= 0) { b.path = nav.path(s.x, s.z, b.sx, b.sz); b.repath = .7; }
    if (s.st === 'patrol' && (!b.path || !b.path.length)) { const w = nav.randomFree(rng); b.path = nav.path(s.x, s.z, w.x, w.z); if (!b.path) b.path = []; }
    // walk
    const sp = s.st === 'hunt' ? opts.speed : 1.4;
    if (b.path && b.path.length) {
      const w = b.path[0], dx = w.x - s.x, dz = w.z - s.z, d = Math.hypot(dx, dz);
      if (d < .3) b.path.shift(); else { const st = Math.min(d, sp * dt); s.x += dx / d * st; s.z += dz / d * st; s.f = Math.atan2(dx, dz); }
    }
    // direct lunge when close and in sight
    if (tgt && best < 3) { const dx = tgt.x - s.x, dz = tgt.z - s.z; s.x += dx / best * opts.speed * .4 * dt; s.z += dz / best * opts.speed * .4 * dt; s.f = Math.atan2(dx, dz); }
    // catch anyone close, light or not
    for (const p of players) { if (p.eaten || p.jailed) continue; if (Math.hypot(p.x - s.x, p.z - s.z) < .95 && p.y < 1.2) { caught.push({ id: p.id, by: i }); s.st = 'feed'; b.feed = 3.5; b.path = null; break; } }
    s.x = +s.x.toFixed(2); s.z = +s.z.toFixed(2); s.f = +(s.f || 0).toFixed(2);
  });
  return caught;
}

/* ---------------- visuals: three cartoon monsters ---------------- */
// Each design returns parts the shared animator understands:
// { g, body, head, jaw, eyeMats:[{m, calm, hunt}], limbs:[{p, ph, amp, axis}], bodyY, height }
const KINDS = ['gloom', 'stitch', 'gulp'];
function part(geo, mat, x, y, z, parent, ink = .02) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (ink) outline(m, ink); parent.add(m); return m; }
function pivot(x, y, z, parent) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function glow(color) { return new THREE.MeshBasicMaterial({ color }); }

function buildGloom(g) { // a tall hunched shadow with a huge grin and long arms
  const skin = toon(0x15111d), cloth = toon(0x221a2e), tooth = toon(0xf2ead6);
  const body = pivot(0, 0, 0, g);
  const torso = part(new THREE.CylinderGeometry(.22, .42, 1.3, 12), cloth, 0, 1.15, 0, body); torso.rotation.x = .25;
  const head = pivot(0, 1.95, .28, body);
  const hm = part(new THREE.SphereGeometry(.34, 18, 14), skin, 0, 0, 0, head); hm.scale.set(1, 1.15, .95);
  const eyeM = glow(0xfff0a0), eyes = [];
  [-1, 1].forEach(s => { const e = part(new THREE.SphereGeometry(.085, 10, 8), eyeM, s * .13, .1, .28, head, 0); e.scale.set(1.2, .7, .5); eyes.push(e); });
  const mouth = part(new THREE.CircleGeometry(.24, 20, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: 0x050205 }), 0, -.09, .315, head, 0);
  const jaw = pivot(0, -.09, .3, head);
  for (let k = -5; k <= 5; k++) { const a = k / 5 * 1.25; const t = part(new THREE.ConeGeometry(.022, .08, 4), tooth, Math.sin(a) * .22, -.02, Math.cos(a) * .03, head, 0); t.position.set(Math.sin(a) * .22, -.1, .3); t.rotation.x = Math.PI; const b = part(new THREE.ConeGeometry(.02, .07, 4), tooth, Math.sin(a) * .2, -.2 + Math.cos(a) * .06, .02, jaw, 0); }
  const limbs = [];
  [-1, 1].forEach(s => { const sh = pivot(s * .32, 1.62, .18, body); const a = part(new THREE.CylinderGeometry(.045, .03, 1.2, 6), skin, 0, -.6, 0, sh); for (let f = -1; f <= 1; f++) { const c = part(new THREE.ConeGeometry(.02, .22, 4), tooth, f * .04, -1.28, .02, sh, 0); c.rotation.x = Math.PI; } sh.rotation.z = s * .12; limbs.push({ p: sh, ph: s > 0 ? Math.PI : 0, amp: .45, axis: 'x' }); });
  [-1, 1].forEach(s => { const hp = pivot(s * .16, .6, 0, body); part(new THREE.CylinderGeometry(.05, .04, .62, 6), skin, 0, -.31, 0, hp); limbs.push({ p: hp, ph: s > 0 ? 0 : Math.PI, amp: .5, axis: 'x' }); });
  return { body, head, jaw, eyeMats: [{ m: eyeM, calm: 0x9a8c50, hunt: 0xfff6c0 }], limbs, height: 2.3, face: .28 + 1.95 };
}
function buildStitch(g) { // a patched-up ragdoll with one button eye and a zigzag grin
  const burlap = toon(0x8a6f4f), patchA = toon(0x5d7a8a), patchB = toon(0x9a4a5a), thread = new THREE.MeshBasicMaterial({ color: 0x1a120c }), tooth = toon(0xf2ead6);
  const body = pivot(0, 0, 0, g);
  const torso = part(new THREE.SphereGeometry(.34, 16, 12), burlap, 0, .78, 0, body); torso.scale.set(1, 1.25, .8);
  part(new THREE.BoxGeometry(.2, .2, .04), patchA, .12, .86, .27, body, .01).rotation.z = .3;
  part(new THREE.BoxGeometry(.16, .14, .04), patchB, -.14, .62, .26, body, .01).rotation.z = -.2;
  for (let k = 0; k < 5; k++) part(new THREE.BoxGeometry(.012, .07, .02), thread, 0, .55 + k * .1, .28, body, 0).rotation.z = (k % 2 ? .6 : -.6);
  const head = pivot(0, 1.32, 0, body);
  const hm = part(new THREE.SphereGeometry(.3, 16, 12), burlap, 0, 0, 0, head); hm.scale.set(1.05, .95, .95);
  const btn = part(new THREE.CylinderGeometry(.075, .075, .03, 14), toon(0x2a1f3a), -.11, .07, .28, head, .01); btn.rotation.x = Math.PI / 2;
  [[-.02, .02], [.02, .02], [-.02, -.02], [.02, -.02]].forEach(([a, b]) => part(new THREE.SphereGeometry(.01, 4, 3), thread, -.11 + a, .07 + b, .3, head, 0));
  const eyeM = glow(0xff3040); part(new THREE.SphereGeometry(.06, 10, 8), eyeM, .12, .07, .26, head, 0);
  const jaw = pivot(0, -.1, .24, head);
  for (let k = -4; k <= 4; k++) { const z = part(new THREE.BoxGeometry(.055, .014, .02), thread, k * .045, (k % 2 ? .015 : -.015), .03, jaw, 0); z.rotation.z = k % 2 ? .6 : -.6; if (k % 2 === 0) { const t = part(new THREE.ConeGeometry(.016, .05, 4), tooth, k * .045, -.03, .03, jaw, 0); t.rotation.x = Math.PI; } }
  [-1, 1].forEach(s => part(new THREE.ConeGeometry(.07, .14, 6), burlap, s * .2, .26, 0, head, .01).rotation.z = -s * .5);
  const limbs = [];
  [-1, 1].forEach(s => { const sh = pivot(s * .32, 1, 0, body); const a = part(new THREE.CylinderGeometry(.06, .05, .6, 6), burlap, 0, -.3, 0, sh); part(new THREE.SphereGeometry(.07, 8, 6), burlap, 0, -.62, 0, sh); sh.rotation.z = s * .35; limbs.push({ p: sh, ph: s > 0 ? Math.PI : 0, amp: .8, axis: 'x' }); });
  [-1, 1].forEach(s => { const hp = pivot(s * .14, .38, 0, body); part(new THREE.CylinderGeometry(.07, .06, .38, 6), patchA, 0, -.19, 0, hp); limbs.push({ p: hp, ph: s > 0 ? 0 : Math.PI, amp: .6, axis: 'x' }); });
  return { body, head, jaw, eyeMats: [{ m: eyeM, calm: 0x7a1820, hunt: 0xff4050 }], limbs, height: 1.65, face: 1.32 };
}
function buildGulp(g) { // a slimy one-eyed blob that is mostly mouth
  const slime = toon(0x3d8a4e), slimeD = toon(0x2a6438), mouthM = toon(0x5a0a1e), tooth = toon(0xf2ead6);
  const body = pivot(0, 0, 0, g);
  const blob = part(new THREE.SphereGeometry(.55, 20, 16), slime, 0, .68, 0, body); blob.scale.set(1, .95, .9);
  for (let k = 0; k < 6; k++) { const d = part(new THREE.SphereGeometry(.06 + (k % 3) * .02, 8, 6), slimeD, Math.sin(k * 1.7) * .45, .3 + (k % 2) * .1, Math.cos(k * 1.7) * .35, body, 0); }
  const head = pivot(0, .82, .3, body);
  const eyeW = part(new THREE.SphereGeometry(.2, 16, 12), toon(0xf6f2e6), 0, .22, .12, head, .015);
  const eyeM = glow(0xc8ff3a); const iris = part(new THREE.SphereGeometry(.1, 12, 10), eyeM, 0, .22, .27, head, 0); iris.scale.z = .4;
  part(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x050505 }), 0, .22, .31, head, 0).scale.set(.5, 1.3, .4);
  const lid = part(new THREE.SphereGeometry(.215, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), slime, 0, .22, .12, head, 0); lid.rotation.x = -.5;
  part(new THREE.CircleGeometry(.36, 20, Math.PI, Math.PI), mouthM, 0, -.04, .23, head, 0);
  for (let k = -5; k <= 5; k++) { const a = k / 5 * 1.3; const t = part(new THREE.ConeGeometry(.03, .1, 4), tooth, Math.sin(a) * .34, -.07, .23 + Math.cos(a) * .01, head, 0); t.rotation.x = Math.PI; }
  const jaw = pivot(0, -.06, .2, head);
  part(new THREE.SphereGeometry(.34, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), slime, 0, 0, -.05, jaw).scale.set(1, .6, .8);
  const tongue = part(new THREE.SphereGeometry(.12, 10, 8), toon(0xd04a6a), 0, -.04, .1, jaw, 0); tongue.scale.set(1, .35, 1.6);
  for (let k = -4; k <= 4; k++) { const t = part(new THREE.ConeGeometry(.025, .08, 4), tooth, k * .07, .02, .2 - Math.abs(k) * .02, jaw, 0); }
  const limbs = [];
  [-1, 1].forEach(s => { const hp = pivot(s * .28, .25, 0, body); part(new THREE.CylinderGeometry(.11, .13, .26, 8), slimeD, 0, -.12, 0, hp); part(new THREE.SphereGeometry(.13, 8, 6), slimeD, 0, -.24, .06, hp, 0).scale.set(1, .5, 1.3); limbs.push({ p: hp, ph: s > 0 ? 0 : Math.PI, amp: .55, axis: 'x' }); });
  return { body, head, jaw, eyeMats: [{ m: eyeM, calm: 0x6a8a1a, hunt: 0xe8ff60 }], limbs, height: 1.25, face: .82 };
}
const BUILD = { gloom: buildGloom, stitch: buildStitch, gulp: buildGulp };
export function makeCreature(parent, kind) {
  const g = new THREE.Group(); parent.add(g); const parts = BUILD[kind](g);
  return Object.assign({ g, kind, rx: null, rz: 0, rf: 0, walk: Math.random() * 6 }, parts);
}
export function makeSentry(parent, i) { return makeCreature(parent, KINDS[i % KINDS.length]); }
export const CREATURE_KINDS = KINDS;

// Pose a creature: speed in m/s, mood 'calm' | 'hunt' | 'scream'
export function poseCreature(V, sp, mood, dt, t) {
  V.walk += dt * (2 + sp * 4.5);
  const moving = sp > .2, hunt = mood !== 'calm';
  V.limbs.forEach(l => { const a = Math.sin(V.walk + l.ph) * (moving ? l.amp : l.amp * .12); l.p.rotation.x = a; });
  V.body.position.y = Math.abs(Math.sin(V.walk)) * (moving ? .06 : .015);
  V.body.rotation.z = Math.sin(V.walk * .5) * (moving ? .06 : .02);
  V.head.rotation.y = Math.sin(t * (hunt ? 8 : 1.7) + V.walk) * (hunt ? .2 : .35);
  V.head.rotation.z = Math.sin(t * 11) * (hunt ? .1 : .02);
  V.jaw.rotation.x = mood === 'scream' ? .75 + Math.sin(t * 40) * .1 : hunt ? .2 + Math.abs(Math.sin(t * 12)) * .3 : .04;
  V.eyeMats.forEach(e => e.m.color.setHex(hunt ? e.hunt : e.calm));
}
export function animSentry(V, s, dt, t) {
  if (V.rx === null) { V.rx = s.x; V.rz = s.z; V.rf = s.f || 0; }
  const k = Math.min(1, dt * 10), ox = V.rx, oz = V.rz;
  V.rx += (s.x - V.rx) * k; V.rz += (s.z - V.rz) * k;
  let df = (s.f || 0) - V.rf; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; V.rf += df * k;
  const sp = Math.hypot(V.rx - ox, V.rz - oz) / Math.max(dt, 1e-3);
  poseCreature(V, sp, s.st === 'hunt' || s.st === 'feed' ? 'hunt' : 'calm', dt, t);
  V.g.position.set(V.rx, 0, V.rz); V.g.rotation.y = V.rf;
}
