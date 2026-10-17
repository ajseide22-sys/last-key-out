// Cartoon prop library. Every prop is built from primitives with cel shading and ink outlines.
// A prop's front faces +z. Each returns { g, w, d, h, wall, y, label, open(k) } where open(k) animates k: 0 → 1.
import * as THREE from 'three';

const grad = (() => { const d = new Uint8Array([70, 150, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const matCache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: grad }, opts));
  delete m.unique;
  if (!opts.unique) matCache.set(key, m);
  return m;
}
const INK = new THREE.MeshBasicMaterial({ color: 0x140c18, side: THREE.BackSide });
export const P = { // palette
  wood: 0x9c5f34, woodDark: 0x6b3b1f, woodLight: 0xc98a52, red: 0xd9434f, teal: 0x2fa39a, mustard: 0xe6b532, purple: 0x7a4fb5,
  cream: 0xf3e3c3, iron: 0x4a4352, brass: 0xf0b93a, green: 0x4f9e45, pink: 0xf28fb5, blue: 0x3f7fd9, white: 0xf7f2ea, black: 0x241c2a, stone: 0x8a8296, ash: 0x3b3438
};

function outline(mesh, t = 0.022) {
  const g = mesh.geometry; g.computeBoundingBox(); const s = new THREE.Vector3(); g.boundingBox.getSize(s);
  const o = new THREE.Mesh(g, INK);
  o.scale.set(1 + 2 * t / Math.max(s.x, .01), 1 + 2 * t / Math.max(s.y, .01), 1 + 2 * t / Math.max(s.z, .01));
  o.raycast = () => { }; o.userData.ink = true;
  mesh.add(o); return mesh;
}
function M(geo, mat, x, y, z, parent, ink = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true;
  if (ink) outline(m); parent.add(m); return m;
}
const B = (w, h, d, c, x, y, z, p, ink) => M(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? toon(c) : c, x, y, z, p, ink);
const C = (rt, rb, h, c, x, y, z, p, seg = 16, ink) => M(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'number' ? toon(c) : c, x, y, z, p, ink);
const S = (r, c, x, y, z, p, ink) => M(new THREE.SphereGeometry(r, 16, 12), typeof c === 'number' ? toon(c) : c, x, y, z, p, ink);
const pivot = (x, y, z, p) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
const pick = (rng, a) => a[Math.floor(rng() * a.length)];

export const PROPS = {
  bookshelf(rng) {
    const g = new THREE.Group(), w = 1.8, d = .45, h = 2.3, wc = pick(rng, [P.wood, P.woodDark]);
    B(w, h, .06, wc, 0, h / 2, -d / 2 + .03, g); B(.07, h, d, wc, -w / 2 + .035, h / 2, 0, g); B(.07, h, d, wc, w / 2 - .035, h / 2, 0, g);
    const books = [];
    for (let s = 0; s < 5; s++) {
      const y = .08 + s * .45; B(w, .06, d, wc, 0, y, 0, g);
      let x = -w / 2 + .12;
      while (x < w / 2 - .2) {
        const bw = .06 + rng() * .07, bh = .26 + rng() * .1;
        if (rng() < .1) { x += .12; continue; }
        const b = B(bw, bh, d * .78, pick(rng, [P.red, P.teal, P.mustard, P.purple, P.green, P.blue, P.cream]), x + bw / 2, y + .03 + bh / 2, .02, g, false);
        b.rotation.z = rng() < .08 ? .25 : 0; books.push(b); x += bw + .01;
      }
    }
    B(w + .08, .1, d + .06, wc, 0, h, 0, g);
    const pulled = books.sort(() => rng() - .5).slice(0, 5).map(b => ({ b, z: b.position.z }));
    return { g, w, d, h, wall: true, y: 1.4, label: 'Search bookshelf', open(k) { pulled.forEach((p, i) => { p.b.position.z = p.z + Math.min(1, k * 1.5 - i * .1) * .22; }); } };
  },
  wardrobe(rng) {
    const g = new THREE.Group(), w = 1.4, d = .7, h = 2.2, c = pick(rng, [P.woodDark, P.purple, P.teal]);
    B(w, h, d, c, 0, h / 2, 0, g); B(w + .1, .12, d + .08, P.woodLight, 0, h + .02, 0, g);
    [-1, 1].forEach(s => C(.05, .05, .12, P.ash, s * .5, .06, s * .25, g, 8));
    const doors = [-1, 1].map(s => { const pv = pivot(s * w / 2, h / 2 + .03, d / 2, g); const dm = B(w / 2 - .02, h - .16, .05, P.woodLight, -s * (w / 4), 0, .025, pv); S(.04, P.brass, -s * (w / 2 - .12), 0, .06, pv); B(w / 2 - .2, h - .5, .02, c, -s * (w / 4), 0, .055, pv, false); return { pv, s }; });
    B(w - .1, .04, d - .1, P.iron, 0, h - .25, 0, g, false);
    return { g, w, d, h, wall: true, y: 1.5, label: 'Open wardrobe', open(k) { doors.forEach(o => o.pv.rotation.y = o.s * k * 1.9); } };
  },
  fireplace() {
    const g = new THREE.Group(), w = 1.9, d = .6, h = 1.5;
    B(w, h, d, P.stone, 0, h / 2, 0, g); B(w + .2, .12, d + .15, P.woodDark, 0, h + .06, .03, g);
    B(1.1, .85, .1, P.black, 0, .5, d / 2 - .02, g, false);
    const logs = new THREE.Group(); logs.position.set(0, .12, d / 2 - .05); g.add(logs);
    [[-.15, 0], [.15, 0], [0, .11]].forEach(([x, y]) => { const l = C(.07, .07, .55, P.woodDark, x, y, 0, logs, 8); l.rotation.z = Math.PI / 2; l.rotation.y = x * 2; });
    const ash = B(.8, .05, .3, P.ash, 0, .06, d / 2 - .05, g, false);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(.13, .4, 7), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); fl.position.set(0, .4, 0); logs.add(fl);
    return { g, w, d, h, wall: true, y: .9, label: 'Dig through the ashes', open(k) { logs.position.z = d / 2 - .05 + k * .55; ash.scale.x = 1 + k * .6; fl.scale.setScalar(1 - k * .7); } };
  },
  clock() {
    const g = new THREE.Group(), w = .7, d = .45, h = 2.3;
    B(w, h - .4, d, P.woodDark, 0, (h - .4) / 2, 0, g);
    B(w + .1, .45, d + .05, P.wood, 0, h - .2, 0, g);
    const face = C(.24, .24, .04, P.cream, 0, h - .2, d / 2 + .03, g, 24); face.rotation.x = Math.PI / 2;
    const hand = B(.02, .16, .02, P.black, 0, h - .14, d / 2 + .07, g, false);
    const pend = pivot(0, h - .55, d / 2 - .1, g); B(.02, .7, .02, P.brass, 0, -.35, 0, pend, false); const bob = C(.09, .09, .04, P.brass, 0, -.72, 0, pend, 16, false); bob.rotation.x = Math.PI / 2;
    const dp = pivot(-w / 2 + .04, (h - .4) / 2, d / 2, g); const door = B(w - .12, h - .6, .03, new THREE.MeshToonMaterial({ color: 0x9fd8ff, gradientMap: grad, transparent: true, opacity: .35 }), (w - .12) / 2, 0, .02, dp, false);
    return { g, w, d, h, wall: true, y: 1.2, label: 'Open grandfather clock', tick(t) { pend.rotation.z = Math.sin(t * 3) * .25; hand.rotation.z = -t * .5; hand.position.x = Math.sin(t * .5) * .06; }, open(k) { dp.rotation.y = -k * 1.8; } };
  },
  piano() {
    const g = new THREE.Group(), w = 1.6, d = .65, h = 1.3;
    B(w, h, d * .55, P.black, 0, h / 2, -d * .22, g); B(w, .12, d, P.black, 0, .72, 0, g);
    B(w - .1, .05, .2, P.white, 0, .8, d / 2 - .12, g, false);
    for (let i = 0; i < 14; i++) if (i % 7 !== 2 && i % 7 !== 6) B(.05, .04, .12, P.black, -w / 2 + .13 + i * .105, .84, d / 2 - .16, g, false);
    [-1, 1].forEach(s => B(.08, .7, .08, P.black, s * (w / 2 - .1), .35, d / 2 - .1, g));
    const pv = pivot(0, h, -d * .5, g); B(w, .05, d * .55, P.black, 0, .02, d * .27, pv);
    return { g, w, d, h, wall: true, y: 1.4, label: 'Lift piano lid', open(k) { pv.rotation.x = -k * 1.2; } };
  },
  filing() {
    const g = new THREE.Group(), w = .55, d = .6, h = 1.35;
    B(w, h, d, P.stone, 0, h / 2, 0, g);
    const drawers = [0, 1, 2].map(i => { const dr = B(w - .06, .38, .04, 0xa59db3, 0, .25 + i * .43, d / 2 + .01, g); B(.16, .04, .04, P.iron, 0, .1, .04, dr, false); B(.12, .07, .01, P.cream, 0, .02, .03, dr, false); return dr; });
    const pick2 = drawers[1];
    return { g, w, d, h, wall: true, y: 1.1, label: 'Check filing cabinet', open(k) { pick2.position.z = d / 2 + .01 + k * .4; drawers[2].position.z = d / 2 + .01 + k * .15; } };
  },
  dresser(rng) {
    const g = new THREE.Group(), w = 1.3, d = .55, h = .95, c = pick(rng, [P.pink, P.teal, P.woodLight, P.mustard]);
    B(w, h, d, c, 0, h / 2, 0, g); B(w + .06, .06, d + .04, P.woodDark, 0, h + .03, 0, g);
    const drawers = [];
    for (let r = 0; r < 3; r++) for (let s = 0; s < 2; s++) { const dr = B(w / 2 - .06, .25, .04, P.cream, (s - .5) * w / 2, .17 + r * .29, d / 2 + .01, g); S(.03, P.brass, 0, 0, .04, dr, false); drawers.push(dr); }
    const lamp = new THREE.Group(); lamp.position.set(w / 3, h, 0); g.add(lamp); C(.05, .08, .3, P.brass, 0, .15, 0, lamp, 10); C(.12, .2, .2, P.cream, 0, .38, 0, lamp, 12);
    const op = drawers.sort(() => rng() - .5).slice(0, 2);
    return { g, w, d, h, wall: true, y: 1.1, label: 'Rummage in dresser', open(k) { op.forEach(dr => dr.position.z = d / 2 + .01 + k * .32); } };
  },
  painting(rng) {
    const g = new THREE.Group(), w = 1 + rng() * .5, h = .8 + rng() * .3, d = .08;
    const pv = pivot(0, 1.6, 0, g); B(w + .12, h + .12, .06, P.brass, 0, 0, .03, pv);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96; const x = cv.getContext('2d');
    const kinds = ['portrait', 'land', 'cat']; const kind = pick(rng, kinds);
    x.fillStyle = pick(rng, ['#2b4a6b', '#4a2b3e', '#2e5a3a', '#5b3a1e']); x.fillRect(0, 0, 128, 96);
    if (kind === 'land') { x.fillStyle = '#e6b532'; x.beginPath(); x.arc(96, 26, 12, 0, 7); x.fill(); x.fillStyle = '#4f9e45'; x.beginPath(); x.moveTo(0, 96); x.lineTo(40, 40); x.lineTo(80, 96); x.fill(); x.fillStyle = '#2fa39a'; x.beginPath(); x.moveTo(40, 96); x.lineTo(90, 50); x.lineTo(128, 96); x.fill(); }
    else if (kind === 'cat') { x.fillStyle = '#f0b93a'; x.beginPath(); x.arc(64, 56, 26, 0, 7); x.fill(); x.beginPath(); x.moveTo(42, 40); x.lineTo(48, 18); x.lineTo(58, 34); x.fill(); x.beginPath(); x.moveTo(86, 40); x.lineTo(80, 18); x.lineTo(70, 34); x.fill(); x.fillStyle = '#241c2a'; x.fillRect(52, 50, 6, 8); x.fillRect(70, 50, 6, 8); }
    else { x.fillStyle = '#f3e3c3'; x.beginPath(); x.ellipse(64, 46, 20, 25, 0, 0, 7); x.fill(); x.fillStyle = '#241c2a'; x.fillRect(30, 70, 68, 30); x.fillRect(54, 40, 5, 5); x.fillRect(70, 40, 5, 5); x.fillStyle = '#d9434f'; x.fillRect(58, 56, 12, 3); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    M(new THREE.PlaneGeometry(w, h), new THREE.MeshToonMaterial({ map: tex, gradientMap: grad }), 0, 0, .065, pv, false);
    const hole = B(.5, .4, .02, P.black, 0, 1.6, -.0, g, false); hole.visible = false;
    return { g, w, d: .15, h: 2.2, wall: true, wallHung: true, y: 1.6, label: 'Look behind painting', open(k) { hole.visible = k > .05; pv.rotation.z = k * .9; pv.position.x = k * .35; pv.position.y = 1.6 - k * .25; } };
  },
  desk(rng) {
    const g = new THREE.Group(), w = 1.5, d = .75, h = .8;
    B(w, .07, d, P.woodLight, 0, h, 0, g);
    B(.45, h - .05, d - .05, P.wood, w / 2 - .25, (h - .05) / 2, 0, g);
    [[-1, -1], [-1, 1]].forEach(([a, b]) => B(.07, h, .07, P.wood, a * (w / 2 - .06), h / 2, b * (d / 2 - .06), g));
    const drs = [0, 1].map(i => { const dr = B(.4, .28, .05, P.woodLight, w / 2 - .25, .2 + i * .32, d / 2 + .01, g); S(.03, P.brass, 0, 0, .04, dr, false); return dr; });
    B(.32, .04, .24, P.cream, -.3, h + .05, .05, g, false); C(.02, .02, .14, P.red, .05, h + .1, .12, g, 6, false);
    const lamp = new THREE.Group(); lamp.position.set(-.55, h, -.2); g.add(lamp); C(.1, .1, .03, P.teal, 0, .02, 0, lamp, 12); const arm = C(.02, .02, .4, P.teal, 0, .22, 0, lamp, 6); C(.06, .14, .14, P.teal, .05, .44, .06, lamp, 12);
    return { g, w, d, h, wall: false, y: 1.1, label: 'Search desk drawers', open(k) { drs[1].position.z = d / 2 + .01 + k * .35; drs[0].position.z = d / 2 + .01 + k * .15; } };
  },
  bed(rng) {
    const g = new THREE.Group(), w = 1.3, d = 2.1, h = .9, c = pick(rng, [P.blue, P.red, P.green, P.purple]);
    B(w, .3, d, P.woodDark, 0, .25, 0, g); B(w + .06, 1, .1, P.woodDark, 0, .5, -d / 2, g); B(w + .06, .6, .1, P.woodDark, 0, .3, d / 2, g);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(.1, .1, .1, P.woodDark, a * (w / 2 - .06), .05, b * (d / 2 - .06), g, false));
    const mp = pivot(0, .45, -d / 2 + .05, g);
    B(w - .08, .2, d - .15, P.white, 0, 0, d / 2 - .1, mp);
    const blanket = B(w - .02, .06, d * .6, c, 0, .12, d * .68 - .1, mp, false);
    const pillow = B(w * .6, .14, .35, P.cream, 0, .17, .3, mp); pillow.rotation.x = .1;
    return { g, w, d, h, wall: false, bedLike: true, y: .9, label: 'Look under the mattress', open(k) { mp.rotation.x = -k * .55; } };
  },
  sofa(rng) {
    const g = new THREE.Group(), w = 2, d = .9, h = .9, c = pick(rng, [P.teal, P.red, P.mustard, P.purple]);
    B(w, .4, d, c, 0, .25, 0, g); B(w, .8, .25, c, 0, .5, -d / 2 + .12, g);
    [-1, 1].forEach(s => B(.25, .6, d, c, s * (w / 2 - .12), .4, 0, g));
    const cush = [-1, 1].map(s => B(w / 2 - .27, .18, d - .3, toon(c, { emissive: 0x000000 }), s * (w / 4 - .07), .54, .1, g));
    const lift = cush[Math.floor(rng() * 2)];
    return { g, w, d, h, wall: false, y: .9, label: 'Check under the cushions', open(k) { lift.position.y = .54 + Math.sin(k * Math.PI) * .45 + k * .1; lift.rotation.x = -k * 1.3; lift.position.z = .1 + k * .45; } };
  },
  armchair(rng) {
    const g = new THREE.Group(), w = .95, d = .9, h = 1, c = pick(rng, [P.red, P.green, P.pink, P.blue]);
    B(w, .4, d, c, 0, .25, 0, g); B(w, .9, .22, c, 0, .55, -d / 2 + .11, g);
    [-1, 1].forEach(s => B(.2, .6, d, c, s * (w / 2 - .1), .4, 0, g));
    const cush = B(w - .42, .16, d - .3, P.cream, 0, .53, .08, g);
    return { g, w, d, h, wall: false, y: .85, label: 'Check the armchair', open(k) { cush.position.y = .53 + k * .25; cush.rotation.x = -k * .9; cush.position.z = .08 + k * .3; } };
  },
  crate() {
    const g = new THREE.Group(), w = 1, d = 1, h = .9;
    B(w, h - .12, d, P.woodLight, 0, (h - .12) / 2, 0, g);
    [-1, 1].forEach(a => [-1, 1].forEach(b => B(.08, h - .12, .08, P.wood, a * .47, (h - .12) / 2, b * .47, g, false)));
    const x = B(1.1, .08, .02, P.wood, 0, (h - .12) / 2, d / 2 + .01, g, false); x.rotation.z = .7;
    const lid = B(w + .04, .12, d + .04, P.wood, 0, h - .06, 0, g);
    return { g, w, d, h, wall: false, y: 1.3, label: 'Pry open crate', open(k) { lid.position.set(k * .75, h - .06 + Math.sin(k * Math.PI) * .5, 0); lid.rotation.z = -k * 1.3; } };
  },
  barrel() {
    const g = new THREE.Group(), w = .86, d = .86, h = .95;
    const body = C(.4, .43, h, P.wood, 0, h / 2, 0, g, 16); [.18, h - .18].forEach(y => C(.445, .445, .06, P.iron, 0, y, 0, g, 16, false));
    const lid = C(.39, .39, .06, P.woodLight, 0, h + .02, 0, g, 16);
    return { g, w, d, h, wall: false, y: 1.3, label: 'Look in barrel', open(k) { lid.position.set(k * .55, h + .02 + Math.sin(k * Math.PI) * .45, 0); lid.rotation.z = -k * 1.5; } };
  },
  chest() {
    const g = new THREE.Group(), w = 1.2, d = .75, h = .55;
    B(w, h, d, P.wood, 0, h / 2, 0, g); B(w + .02, .08, d + .02, P.brass, 0, h - .1, 0, g, false);
    const pv = pivot(0, h, -d / 2, g); const lid = M(new THREE.CylinderGeometry(d / 2, d / 2, w, 14, 1, false, 0, Math.PI), toon(P.woodLight), 0, 0, d / 2, pv); lid.rotation.z = Math.PI / 2;
    B(.14, .18, .06, P.brass, 0, h - .06, d / 2 + .02, g, false);
    return { g, w, d, h, wall: false, y: 1.1, label: 'Open chest', open(k) { pv.rotation.x = -k * 1.95; } };
  },
  toybox(rng) {
    const g = new THREE.Group(), w = .9, d = .6, h = .6;
    B(w, h, d, P.mustard, 0, h / 2, 0, g);
    ['#d9434f', '#3f7fd9', '#4f9e45'].forEach((c, i) => B(.18, .18, .02, parseInt(c.slice(1), 16), -.25 + i * .25, .3, d / 2 + .01, g, false));
    const pv = pivot(0, h, -d / 2, g); B(w + .04, .08, d + .02, P.red, 0, .04, d / 2, pv);
    const duck = S(.1, P.mustard, .15, h - .1, 0, g, false); duck.visible = false;
    const ball = S(.14, P.blue, -.2, h - .06, 0, g, false); ball.visible = false;
    return { g, w, d, h, wall: false, y: 1, label: 'Dig in toy box', open(k) { pv.rotation.x = -k * 1.9; duck.visible = ball.visible = k > .3; ball.position.y = h - .06 + Math.sin(k * Math.PI) * .5; } };
  },
  plant(rng) {
    const g = new THREE.Group(), w = .7, d = .7, h = 1.4;
    C(.3, .22, .5, pick(rng, [P.red, P.teal, P.cream]), 0, .25, 0, g, 14); C(.27, .27, .04, P.woodDark, 0, .48, 0, g, 14, false);
    const pl = new THREE.Group(); pl.position.y = .48; g.add(pl);
    C(.04, .05, .6, P.woodDark, 0, .3, 0, pl, 6);
    for (let i = 0; i < 6; i++) { const l = S(.22, P.green, Math.sin(i) * .18, .55 + (i % 3) * .14, Math.cos(i) * .18, pl); l.scale.set(1, .6, 1); }
    return { g, w, d, h, wall: false, y: 1.2, label: 'Dig in the plant pot', open(k) { pl.position.y = .48 + Math.sin(k * Math.PI / 2) * .5; pl.rotation.z = k * .5; pl.position.x = k * .45; } };
  },
  vase(rng) {
    const g = new THREE.Group(), w = .55, d = .55, h = 1.45;
    C(.22, .26, .8, P.white, 0, .4, 0, g, 12); C(.27, .27, .06, P.white, 0, .82, 0, g, 12);
    const vp = pivot(0, .85, 0, g);
    const v = M(new THREE.LatheGeometry([[.0, 0], [.14, 0], [.2, .12], [.17, .32], [.08, .42], [.1, .5]].map(([x, y]) => new THREE.Vector2(x, y)), 18), toon(pick(rng, [P.blue, P.teal, P.purple, P.red])), 0, 0, 0, vp);
    return { g, w, d, h, wall: false, y: 1.4, label: 'Peek inside vase', open(k) { vp.rotation.z = k * 1.1; vp.position.x = k * .1; } };
  },
  trash() {
    const g = new THREE.Group(), w = .55, d = .55, h = .75;
    C(.25, .2, .7, P.stone, 0, .35, 0, g, 14);
    for (let i = 0; i < 6; i++) { const r = B(.02, .66, .02, P.iron, Math.sin(i) * .23, .35, Math.cos(i) * .23, g, false); }
    const lid = C(.27, .27, .05, P.iron, 0, .73, 0, g, 14); C(.04, .04, .06, P.iron, 0, .04, 0, lid, 6, false);
    return { g, w, d, h, wall: false, y: 1, label: 'Dig through the trash', open(k) { lid.position.set(k * .4, .73 + Math.sin(k * Math.PI) * .4, 0); lid.rotation.x = k * 1.4; } };
  },
  boxes(rng) {
    const g = new THREE.Group(), w = 1.1, d = 1, h = 1.5;
    B(1, .6, .9, 0xc79a62, 0, .3, 0, g); B(.85, .5, .75, 0xd4a970, .05, .85, -.02, g);
    const top = B(.6, .4, .55, 0xe0b67c, -.05, 1.3, .03, g); B(.62, .03, .1, 0x8a6a3a, 0, .2, 0, top, false);
    return { g, w, d, h, wall: false, y: 1.6, label: 'Move the boxes', open(k) { top.position.set(-.05 + k * .9, 1.3 - k * 1.1, .03 + k * .3); top.rotation.z = -k * 1.4; } };
  },
  teatable(rng) {
    const g = new THREE.Group(), w = .9, d = .9, h = 1.1;
    C(.45, .45, .05, P.woodLight, 0, .72, 0, g, 18); C(.05, .07, .7, P.wood, 0, .36, 0, g, 8); C(.25, .25, .04, P.wood, 0, .02, 0, g, 12);
    S(.15, P.white, 0, .87, 0, g).scale.set(1, .85, 1);
    const sp = C(.03, .02, .16, P.white, .17, .89, 0, g, 6, false); sp.rotation.z = -.9;
    const lid = S(.07, P.white, 0, 1.0, 0, g); lid.scale.y = .5;
    C(.05, .04, .06, P.white, -.25, .78, .15, g, 10); C(.05, .04, .06, P.white, .2, .78, -.22, g, 10);
    return { g, w, d, h, wall: false, y: 1.2, label: 'Lift the teapot lid', open(k) { lid.position.set(k * .25, 1.0 + Math.sin(k * Math.PI) * .25, 0); } };
  },
  armor() {
    const g = new THREE.Group(), w = .8, d = .6, h = 2.1, st = 0xb8b4c4;
    B(.6, .12, .5, P.woodDark, 0, .06, 0, g);
    [-1, 1].forEach(s => C(.09, .11, .8, st, s * .14, .5, 0, g, 10));
    C(.25, .2, .6, st, 0, 1.2, 0, g, 12); [-1, 1].forEach(s => { S(.13, st, s * .3, 1.45, 0, g); C(.07, .07, .55, st, s * .34, 1.1, 0, g, 8); });
    S(.2, st, 0, 1.75, 0, g);
    const vp = pivot(0, 1.82, .1, g); B(.3, .16, .06, 0x8e8a9a, 0, -.04, .08, vp); const plume = S(.08, P.red, 0, 2.0, -.05, g); plume.scale.set(.6, 1.6, 1.4);
    const spear = C(.02, .02, 2, P.woodDark, .45, 1, .05, g, 6, false); M(new THREE.ConeGeometry(.05, .2, 6), toon(st), .45, 2.05, .05, g);
    return { g, w, d, h, wall: false, y: 1.9, label: 'Lift the knight\'s visor', open(k) { vp.rotation.x = -k * 1.3; } };
  },
  safe() {
    const g = new THREE.Group(), w = .85, d = .7, h = .95;
    B(w, h, d, 0x3d4b5c, 0, h / 2, 0, g);
    const dp = pivot(-w / 2 + .05, h / 2, d / 2, g); B(w - .1, h - .1, .06, 0x56677a, (w - .1) / 2, 0, .03, dp);
    const dial = C(.1, .1, .04, P.brass, (w - .1) / 2 - .1, .1, .08, dp, 16); dial.rotation.x = Math.PI / 2;
    B(.16, .12, .03, 0x111111, (w - .1) / 2 + .14, -.15, .07, dp, false);
    for (let i = 0; i < 9; i++) B(.04, .03, .02, P.cream, (w - .1) / 2 + .09 + (i % 3) * .05, -.06 - Math.floor(i / 3) * .04 - .06, .085, dp, false);
    return { g, w, d, h, wall: true, y: 1.1, label: 'Enter safe code', open(k) { dp.rotation.y = -k * 1.8; } };
  },
};

export const WALL_TYPES = ['bookshelf', 'wardrobe', 'fireplace', 'clock', 'piano', 'filing', 'dresser', 'painting'];
export const FLOOR_TYPES = ['desk', 'bed', 'sofa', 'armchair', 'crate', 'barrel', 'chest', 'toybox', 'plant', 'vase', 'trash', 'boxes', 'teatable', 'armor'];

export function makeKey() {
  const g = new THREE.Group(); const m = new THREE.MeshToonMaterial({ color: 0xffc94d, emissive: 0x8a5200, emissiveIntensity: .8, gradientMap: grad });
  M(new THREE.TorusGeometry(.12, .04, 8, 18), m, 0, .14, 0, g); M(new THREE.BoxGeometry(.05, .34, .05), m, 0, -.08, 0, g);
  M(new THREE.BoxGeometry(.11, .05, .05), m, .05, -.21, 0, g); M(new THREE.BoxGeometry(.08, .05, .05), m, .03, -.11, 0, g);
  return g;
}
export function makeNote() {
  const g = new THREE.Group(); const p = B(.22, .02, .28, P.cream, 0, 0, 0, g); p.rotation.y = .3; return g;
}
export { outline, B as box, C as cyl, S as sphere, M as mesh };
