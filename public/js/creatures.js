// Realistic horror creatures, built from primitives with physically based materials and painted skin.
// The Pale: a tall emaciated thing with an unhinging jaw. The Crawler: a corpse on all fours behind a curtain of hair.
// The Hollow: a gliding shroud with a cracked porcelain face. All share one API:
//   makeCreature(parent, kind) → V with { g, head, face, rig(sp, mood, dt, t) }
//   poseCreature(V, speed, mood, dt, t)   mood: 'calm' | 'hunt' | 'scream'
import * as THREE from 'three';

export const CREATURE_KINDS = ['pale', 'crawler', 'hollow'];

/* ---------------- painted skin ---------------- */
function skinTex(base, vein, spots, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { const a = r() * .14; x.fillStyle = r() < .5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * .6})`; const sz = 4 + r() * 40; x.beginPath(); x.arc(r() * 512, r() * 512, sz, 0, 7); x.fill(); }
  for (let i = 0; i < 70; i++) { x.strokeStyle = vein; x.globalAlpha = .25 + r() * .45; x.lineWidth = .6 + r() * 2.2; let px = r() * 512, py = r() * 512; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 9; k++) { px += (r() - .5) * 46; py += (r() - .5) * 46; x.lineTo(px, py); } x.stroke(); }
  x.globalAlpha = 1;
  for (let i = 0; i < 120; i++) { x.fillStyle = spots; x.globalAlpha = .1 + r() * .35; x.beginPath(); x.arc(r() * 512, r() * 512, 1 + r() * 6, 0, 7); x.fill(); }
  x.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function clothTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#0d0b0f'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) { x.strokeStyle = `rgba(${40 + Math.random() * 30},${30 + Math.random() * 20},${30 + Math.random() * 20},${.2 + Math.random() * .3})`; x.lineWidth = 1; x.beginPath(); const px = Math.random() * 256; x.moveTo(px, 0); x.lineTo(px + (Math.random() - .5) * 20, 256); x.stroke(); }
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(60,20,18,${Math.random() * .3})`; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 18, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const MATS = {};
function mats() {
  if (MATS.ok) return MATS;
  const pale = skinTex('#b9b2a6', '#5a3a4a', '#4a3030', 11), corpse = skinTex('#7d8784', '#2e3a4e', '#2a2228', 23), bone = skinTex('#d8d0bf', '#8a7a6a', '#6a5a4a', 37);
  Object.assign(MATS, {
    ok: true,
    pale: new THREE.MeshStandardMaterial({ map: pale, bumpMap: pale, bumpScale: 1.2, roughness: .62, metalness: 0 }),
    corpse: new THREE.MeshStandardMaterial({ map: corpse, bumpMap: corpse, bumpScale: 1.5, roughness: .55, metalness: 0 }),
    porcelain: new THREE.MeshStandardMaterial({ map: bone, bumpMap: bone, bumpScale: .6, roughness: .28, metalness: 0 }),
    cloth: new THREE.MeshStandardMaterial({ map: clothTex(), roughness: .95, side: THREE.DoubleSide }),
    hair: new THREE.MeshStandardMaterial({ color: 0x060507, roughness: .5, side: THREE.DoubleSide }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x2a0408, roughness: .3, side: THREE.DoubleSide }),
    gum: new THREE.MeshStandardMaterial({ color: 0x6a1a22, roughness: .35 }),
    tooth: new THREE.MeshStandardMaterial({ color: 0xd9d0b4, roughness: .3 }),
    nail: new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: .4 }),
    socket: new THREE.MeshBasicMaterial({ color: 0x000000 }),
  });
  Object.values(MATS).forEach(m => { if (m && m.isMaterial) m.userData.keep = true; });
  return MATS;
}
// Eye-shine is the only thing about them you can see in the dark.
function eyeMat(color) { const m = new THREE.MeshBasicMaterial({ color }); m.userData.base = m.color.clone(); return m; }

/* ---------------- building blocks ---------------- */
function M(geo, mat, x, y, z, p) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; }
function piv(x, y, z, p) { const g = new THREE.Group(); g.position.set(x || 0, y || 0, z || 0); p.add(g); return g; }
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
// A two-bone limb hanging down from its pivot: returns { a: upper pivot, b: lower pivot, end: tip pivot }
function limb(p, x, y, z, l1, l2, r1, r2, mat) {
  const a = piv(x, y, z, p); M(cap(r1, l1), mat, 0, -l1 / 2, 0, a); M(new THREE.SphereGeometry(r1 * 1.15, 10, 8), mat, 0, -l1, 0, a);
  const b = piv(0, -l1, 0, a); M(cap(r2, l2), mat, 0, -l2 / 2, 0, b);
  const end = piv(0, -l2, 0, b); return { a, b, end };
}
function hand(p, mat, nail, len, spread = .5) {
  M(new THREE.SphereGeometry(.05, 8, 6), mat, 0, -.02, 0, p).scale.set(1.2, 1, .7);
  const fingers = [];
  for (let k = 0; k < 4; k++) {
    const f = piv((k - 1.5) * .025, -.05, .01, p); f.rotation.z = (k - 1.5) * spread * .25; f.rotation.x = .2;
    M(cap(.009, len * .55), mat, 0, -len * .3, 0, f);
    const f2 = piv(0, -len * .58, 0, f); f2.rotation.x = .5; M(cap(.008, len * .4), mat, 0, -len * .22, 0, f2);
    const n = M(new THREE.ConeGeometry(.008, .05, 5), nail, 0, -len * .46, 0, f2); n.rotation.x = Math.PI;
    fingers.push([f, f2]);
  }
  return fingers;
}
function teeth(p, n, w, len, y, z, down, mat) {
  for (let k = 0; k < n; k++) { const a = (k / (n - 1) - .5) * 2; const t = M(new THREE.ConeGeometry(.007 + Math.random() * .004, len * (.6 + Math.random() * .7), 4), mat, a * w, y, z - Math.abs(a) * w * .5, p); t.rotation.x = down ? Math.PI : 0; t.rotation.z = (Math.random() - .5) * .4; }
}

/* ---------------- The Pale ---------------- */
function buildPale(g) {
  const m = mats(), skin = m.pale;
  const hips = piv(0, 1.12, 0, g);
  M(new THREE.SphereGeometry(.17, 14, 10), skin, 0, 0, 0, hips).scale.set(1.2, .7, .8);
  const spine = piv(0, .08, 0, hips); spine.rotation.x = .55; // hunched
  const chest = M(new THREE.SphereGeometry(.2, 16, 12), skin, 0, .5, 0, spine); chest.scale.set(1.15, 1.7, .75);
  for (let k = 0; k < 6; k++) { const rib = M(new THREE.TorusGeometry(.2 - k * .006, .014, 5, 16, Math.PI * 1.15), skin, 0, .7 - k * .075, .03, spine); rib.rotation.set(Math.PI / 2 - .2, 0, Math.PI * -.075); rib.scale.set(1.12, .78, 1); }
  for (let k = 0; k < 9; k++) M(new THREE.SphereGeometry(.028, 6, 5), skin, 0, .12 + k * .085, -.14, spine); // vertebrae through the skin
  M(new THREE.SphereGeometry(.1, 10, 8), skin, 0, .2, .06, spine).scale.set(1.4, 1, .6); // sunken belly
  const neck = piv(0, .88, .02, spine); neck.rotation.x = -.35; M(cap(.045, .24), skin, 0, .14, 0, neck);
  const head = piv(0, .3, .02, neck);
  const skull = M(new THREE.SphereGeometry(.13, 18, 14), skin, 0, .06, 0, head); skull.scale.set(.9, 1.35, 1.05);
  M(new THREE.SphereGeometry(.035, 8, 6), skin, 0, .02, .135, head).scale.set(.7, 1.2, .6); // nose ridge
  const eyeM = eyeMat(0xd8e4e0);
  [-1, 1].forEach(s => { const so = M(new THREE.SphereGeometry(.042, 10, 8), m.socket, s * .052, .08, .1, head); so.scale.set(1, 1.25, .5); M(new THREE.SphereGeometry(.007, 6, 5), eyeM, s * .052, .075, .122, head); });
  M(new THREE.SphereGeometry(.07, 10, 8), m.mouth, 0, -.06, .08, head).scale.set(1.1, .9, .6);
  teeth(head, 13, .055, .045, -.055, .118, true, m.tooth);
  const jaw = piv(0, -.04, .02, head);
  const jb = M(new THREE.SphereGeometry(.085, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin, 0, 0, .04, jaw); jb.scale.set(1, 1.6, 1.2);
  M(new THREE.SphereGeometry(.07, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.gum, 0, .005, .05, jaw).scale.set(.95, .6, 1.1);
  teeth(jaw, 12, .05, .04, .01, .1, false, m.tooth);
  const arms = [-1, 1].map(s => { const L = limb(spine, s * .24, .8, .02, .55, .55, .035, .028, skin); L.a.rotation.z = s * .15; const f = hand(L.end, skin, m.nail, .2, .8); return { L, f, s }; });
  const legs = [-1, 1].map(s => { const L = limb(hips, s * .11, -.05, 0, .55, .55, .045, .034, skin); M(new THREE.BoxGeometry(.07, .04, .2), skin, 0, -.02, .06, L.end); return { L, s }; });
  const V = { head, jaw, face: 2.05, eyes: [eyeM] };
  V.rig = (sp, mood, dt, t, W) => {
    const mv = sp > .2, hunt = mood !== 'calm', scream = mood === 'scream', w = W;
    legs.forEach(({ L, s }) => { const ph = w + (s > 0 ? Math.PI : 0); L.a.rotation.x = mv ? Math.sin(ph) * .55 : -.08; L.b.rotation.x = mv ? Math.max(0, Math.sin(ph + 1.4)) * .9 + .1 : .15; });
    arms.forEach(({ L, f, s }) => { const ph = w + (s > 0 ? 0 : Math.PI); L.a.rotation.x = scream ? -1.5 : hunt ? -.9 + Math.sin(t * 9 + s) * .1 : (mv ? Math.sin(ph) * .4 : .05); L.a.rotation.z = s * (scream ? .55 : .15); L.b.rotation.x = scream ? -.3 : hunt ? -.5 : -.2 - (mv ? Math.max(0, Math.sin(ph)) * .3 : 0); f.forEach(([a, b], i) => { a.rotation.x = .2 + (hunt ? Math.sin(t * 14 + i) * .25 : 0); b.rotation.x = hunt ? .2 : .55; }); });
    hips.position.y = 1.12 + (mv ? Math.abs(Math.cos(w)) * .04 : 0);
    spine.rotation.x = scream ? .25 : hunt ? .7 : .55; spine.rotation.z = mv ? Math.sin(w) * .05 : 0;
    jaw.rotation.x = scream ? 1.05 + Math.sin(t * 50) * .05 : hunt ? .35 + Math.abs(Math.sin(t * 7)) * .3 : .08;
  };
  return V;
}

/* ---------------- The Crawler ---------------- */
function buildCrawler(g) {
  const m = mats(), skin = m.corpse;
  const body = piv(0, .78, 0, g);
  const torso = M(new THREE.SphereGeometry(.2, 16, 12), skin, 0, 0, .05, body); torso.scale.set(1, .7, 2.1); // arched back, horizontal
  for (let k = 0; k < 11; k++) M(new THREE.SphereGeometry(.03, 6, 5), skin, 0, .13 + Math.sin(k / 10 * Math.PI) * .05, -.32 + k * .07, body);
  for (let k = 0; k < 5; k++) [-1, 1].forEach(s => { const r = M(cap(.012, .16), skin, s * .16, -.02, -.05 + k * .07, body); r.rotation.z = s * .9; });
  const neck = piv(0, .02, .42, body); neck.rotation.x = .9; M(cap(.045, .18), skin, 0, -.1, 0, neck);
  const head = piv(0, -.2, .05, neck);
  const skull = M(new THREE.SphereGeometry(.12, 16, 12), skin, 0, 0, 0, head); skull.scale.set(.95, 1.15, 1.05);
  head.rotation.z = .5; // unnaturally tilted
  const eyeM = eyeMat(0xf0f2e0);
  M(new THREE.SphereGeometry(.03, 8, 6), m.socket, .04, .03, .1, head); M(new THREE.SphereGeometry(.012, 6, 5), eyeM, .04, .03, .115, head);
  const jaw = piv(0, -.06, .05, head); M(new THREE.SphereGeometry(.06, 10, 6), m.mouth, 0, 0, .04, jaw).scale.set(.8, 1.4, .5); teeth(jaw, 8, .035, .03, .02, .065, false, m.tooth);
  // a curtain of wet black hair
  const hair = piv(0, .08, 0, head); const strands = [];
  for (let k = 0; k < 18; k++) { const a = (k / 17 - .5) * 2.6; const st = piv(Math.sin(a) * .11, 0, Math.cos(a) * .09, hair); const len = .45 + Math.random() * .25; const pl = M(new THREE.PlaneGeometry(.05, len), m.hair, 0, -len / 2, 0, st); pl.rotation.y = a; strands.push(st); }
  const legs = [];
  [[-1, .3, 1], [1, .3, 1], [-1, -.3, 0], [1, -.3, 0]].forEach(([s, z, front]) => {
    const L = limb(body, s * .17, 0, z, front ? .46 : .44, front ? .5 : .42, .035, .028, skin);
    if (front) hand(L.end, skin, m.nail, .17, .9); else M(new THREE.BoxGeometry(.06, .04, .17), skin, 0, -.02, .05, L.end);
    legs.push({ L, s, front, ph: (s > 0) === !!front ? 0 : Math.PI });
  });
  const V = { head, jaw, face: .65, eyes: [eyeM] };
  V.rig = (sp, mood, dt, t, W) => {
    const mv = sp > .2, hunt = mood !== 'calm', scream = mood === 'scream';
    legs.forEach(({ L, s, front, ph }) => { const p = W * 1.3 + ph; L.a.rotation.z = s * (front ? .45 : .5); L.a.rotation.x = (front ? -.55 : .55) + (mv ? Math.sin(p) * .5 : 0); L.b.rotation.x = (front ? .9 : -1.1) + (mv ? Math.max(0, Math.cos(p)) * (front ? .4 : -.4) : 0); });
    body.position.y = .62 + (mv ? Math.abs(Math.sin(W * 1.3)) * .05 : Math.sin(t * 2) * .01);
    body.rotation.z = mv ? Math.sin(W * 1.3) * .08 : 0;
    neck.rotation.x = scream ? .2 : hunt ? .55 : .9;
    head.rotation.z = scream ? 0 : .5 + Math.sin(t * (hunt ? 11 : 1.3)) * (hunt ? .15 : .05) + (Math.random() < .01 ? .4 : 0);
    jaw.rotation.x = scream ? .9 : hunt ? .3 + Math.abs(Math.sin(t * 9)) * .3 : .05;
    strands.forEach((st, i) => { st.rotation.x = Math.sin(t * 2 + i) * .08 + (mv ? -.25 : 0) + (scream ? -.6 : 0); });
  };
  return V;
}

/* ---------------- The Hollow ---------------- */
function buildHollow(g) {
  const m = mats();
  const body = piv(0, 0, 0, g);
  // a tattered shroud: a cone with ragged, displaced vertices
  const geo = new THREE.ConeGeometry(.55, 2.1, 22, 8, true); const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const r = .06 * Math.sin(i * 1.7) + .04 * Math.cos(i * 3.1); pos.setX(i, pos.getX(i) * (1 + r)); pos.setZ(i, pos.getZ(i) * (1 + r)); if (y < -.9) pos.setY(i, y - Math.abs(Math.sin(i * 2.3)) * .25); }
  geo.computeVertexNormals();
  const robe = M(geo, m.cloth, 0, 1.1, 0, body);
  const strips = []; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const st = piv(Math.sin(a) * .48, .2, Math.cos(a) * .48, body); M(new THREE.PlaneGeometry(.12, .5 + Math.random() * .3), m.cloth, 0, -.25, 0, st).rotation.y = a; strips.push(st); }
  const hood = M(new THREE.SphereGeometry(.24, 16, 12, 0, Math.PI * 2, 0, Math.PI * .62), m.cloth, 0, 2.12, -.02, body); hood.scale.set(1, 1.25, 1.1);
  const head = piv(0, 2.04, .05, body);
  const face = M(new THREE.SphereGeometry(.15, 18, 14), m.porcelain, 0, 0, .04, head); face.scale.set(.85, 1.15, .7);
  // cracks
  for (let k = 0; k < 5; k++) { const c = M(new THREE.BoxGeometry(.004, .07 + Math.random() * .06, .004), m.socket, (Math.random() - .5) * .14, (Math.random() - .3) * .16, .145, head); c.rotation.z = (Math.random() - .5) * 1.2; }
  const eyeM = eyeMat(0xff2a1a);
  [-1, 1].forEach(s => { const so = M(new THREE.SphereGeometry(.03, 10, 8), m.socket, s * .045, .04, .13, head); so.scale.set(1.1, 1.5, .4); M(new THREE.SphereGeometry(.006, 6, 5), eyeM, s * .045, .035, .142, head); });
  const jaw = piv(0, -.05, .1, head);
  const mouth = M(new THREE.SphereGeometry(.04, 10, 8), m.socket, 0, -.02, .04, jaw); mouth.scale.set(.7, 1.4, .3);
  teeth(jaw, 7, .022, .02, .03, .045, true, m.tooth);
  const arms = [-1, 1].map(s => { const sh = piv(s * .3, 1.7, .05, body); M(new THREE.CylinderGeometry(.06, .11, .7, 10, 1, true), m.cloth, 0, -.32, 0, sh); const fore = piv(0, -.62, 0, sh); M(cap(.022, .2), m.pale, 0, -.12, 0, fore); const h = piv(0, -.26, 0, fore); hand(h, m.pale, m.nail, .22, .9); return { sh, fore, s }; });
  const V = { head, jaw, face: 2.04, eyes: [eyeM] };
  V.rig = (sp, mood, dt, t, W) => {
    const mv = sp > .2, hunt = mood !== 'calm', scream = mood === 'scream';
    body.position.y = .12 + Math.sin(t * 1.8) * .05; body.rotation.x = mv ? .12 : 0;
    robe.scale.x = 1 + Math.sin(t * 3) * .02;
    strips.forEach((st, i) => { st.rotation.x = Math.sin(t * 2.5 + i) * .2 + (mv ? -.35 : 0); st.rotation.z = Math.cos(t * 2 + i * 1.3) * .15; });
    arms.forEach(({ sh, fore, s }) => { sh.rotation.x = scream ? -1.6 : hunt ? -1.2 + Math.sin(t * 6 + s) * .1 : -.1 + Math.sin(t * 1.2 + s) * .05; sh.rotation.z = s * (scream ? .5 : .12); fore.rotation.x = hunt ? -.25 : -.1; });
    head.rotation.z = Math.sin(t * .9) * .25 + (hunt ? Math.sin(t * 17) * .06 : 0);
    jaw.rotation.x = 0; jaw.scale.y = scream ? 2.6 : hunt ? 1.4 + Math.sin(t * 8) * .2 : 1;
  };
  return V;
}

const BUILD = { pale: buildPale, crawler: buildCrawler, hollow: buildHollow };
export function makeCreature(parent, kind) {
  const g = new THREE.Group(); parent.add(g);
  const V = BUILD[kind](g);
  return Object.assign(V, { g, kind, rx: null, rz: 0, rf: 0, walk: Math.random() * 6, twitch: 0 });
}
export function poseCreature(V, sp, mood, dt, t) {
  V.walk += dt * (1.6 + sp * 3.2);
  V.rig(sp, mood, dt, t, V.walk);
  // the occasional sharp twitch of the head
  V.twitch -= dt; if (V.twitch <= 0) { V.twitch = .4 + Math.random() * (mood === 'calm' ? 3 : 1); V.tw = (Math.random() - .5) * (mood === 'calm' ? .5 : .9); }
  V.head.rotation.y = V.head.rotation.y * .7 + (V.tw || 0) * .3;
  V.eyes.forEach(e => e.color.copy(e.userData.base).multiplyScalar(mood === 'calm' ? .55 : 1));
}
