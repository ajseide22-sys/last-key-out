// Shared world helpers: seeded randomness, textures, collision boxes, rooms with doors, lights.
import * as THREE from 'three';
import { toon, P, outline } from './props.js';

export function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function canvasTex(size, draw, rx, ry, rng) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size, rng);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const R = (rng, a, b) => a + rng() * (b - a);
export const TEX = {
  wood: hue => (x, s, rng) => { const rows = 6, h = s / rows; for (let r = 0; r < rows; r++) { const off = (r % 2) * s / 3; for (let k = -1; k < 3; k++) { const l = s / 2; x.fillStyle = `hsl(${hue + R(rng, -4, 4)},${R(rng, 38, 50)}%,${R(rng, 30, 40)}%)`; x.fillRect(k * l + off, r * h, l, h); x.fillStyle = 'rgba(20,10,10,.6)'; x.fillRect(k * l + off, r * h, 3, h); } x.fillStyle = 'rgba(20,10,10,.65)'; x.fillRect(0, r * h, s, 4); } },
  checker: (a, b) => (x, s) => { const n = 4, c = s / n; for (let i = 0; i < n; i++)for (let j = 0; j < n; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * c, j * c, c, c); } x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * c, 0); x.lineTo(i * c, s); x.moveTo(0, i * c); x.lineTo(s, i * c); x.stroke(); } },
  stone: (h, l) => (x, s, rng) => { x.fillStyle = `hsl(${h},14%,${l - 10}%)`; x.fillRect(0, 0, s, s); const n = 4, c = s / n; for (let i = 0; i < n; i++)for (let j = 0; j < n; j++) { x.fillStyle = `hsl(${h + R(rng, -8, 8)},16%,${l + R(rng, -5, 5)}%)`; x.fillRect(i * c + 4, j * c + 4, c - 8, c - 8); } },
  wallpaper: (a, b) => (x, s) => { x.fillStyle = a; x.fillRect(0, 0, s, s); x.fillStyle = b; for (let i = 0; i < 4; i++) x.fillRect(i * s / 4 + s / 16, 0, s / 10, s); x.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 4; i++)for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(i * s / 4 + s / 8 + s / 40, j * s / 4 + s / 8, s / 28, 0, 7); x.fill(); } x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, s * .78, s, s * .22); x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, s * .76, s, s * .03); },
  brick: (x, s, rng) => { x.fillStyle = '#2a2030'; x.fillRect(0, 0, s, s); const rows = 8, h = s / rows, w = s / 4; for (let r = 0; r < rows; r++) { const off = (r % 2) * w / 2; for (let k = -1; k < 5; k++) { x.fillStyle = `hsl(${R(rng, 255, 280)},${R(rng, 12, 20)}%,${R(rng, 30, 38)}%)`; x.fillRect(k * w + off + 3, r * h + 3, w - 6, h - 6); } } },
  metal: (x, s) => { x.fillStyle = '#3b3946'; x.fillRect(0, 0, s, s); for (let i = 0; i < 2; i++)for (let j = 0; j < 2; j++) { x.fillStyle = '#4a4756'; x.fillRect(i * s / 2 + 4, j * s / 2 + 4, s / 2 - 8, s / 2 - 8); x.fillStyle = '#6b6878';[[10, 10], [s / 2 - 14, 10], [10, s / 2 - 14], [s / 2 - 14, s / 2 - 14]].forEach(([a, b]) => { x.beginPath(); x.arc(i * s / 2 + a + 2, j * s / 2 + b + 2, 4, 0, 7); x.fill(); }); } },
  hazard: (x, s) => { x.fillStyle = '#ffc93c'; x.fillRect(0, 0, s, s); x.fillStyle = '#1a1410'; for (let i = -s; i < s * 2; i += s / 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + s / 8, 0); x.lineTo(i + s / 8 - s, s); x.lineTo(i - s, s); x.fill(); } },
};

export class World {
  constructor(scene) { this.scene = scene; this.root = new THREE.Group(); scene.add(this.root); this.solids = []; this.flickers = []; this.tickers = []; this.hit = []; }
  clear() {
    this.root.traverse(o => { if (o.userData.ink) return; if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m.map) m.map.dispose(); if (!m.gradientMap) m.dispose(); }); });
    this.scene.remove(this.root); this.root = new THREE.Group(); this.scene.add(this.root);
    this.solids = []; this.flickers = []; this.tickers = []; this.hit = [];
  }
  solid(x0, x1, z0, z1, wall = false) { const s = { x0, x1, z0, z1, on: true, wall }; this.solids.push(s); return s; }
  box(w, h, d, mat, x, y, z, solid, ink = false, wall = false) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; if (ink) outline(m, .03); this.root.add(m);
    if (solid) m.userData.solid = this.solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, wall); return m;
  }
  floor(W, D, tex, x = 0, z = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshToonMaterial({ map: tex })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); m.receiveShadow = true; this.root.add(m); return m; }
  tex(draw, rx, ry, rng) { return canvasTex(256, draw, rx, ry, rng || Math.random); }

  torch(x, z, ry, intensity = 7, y = 2.1) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; this.root.add(g);
    const br = new THREE.Mesh(new THREE.BoxGeometry(.12, .4, .14), toon(P.iron)); br.position.z = .1; g.add(br);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.12, .07, .22, 8), toon(P.woodDark)); cup.position.set(0, .25, .25); g.add(cup);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(.12, .36, 8), new THREE.MeshBasicMaterial({ color: 0xffa640 })); fl.position.set(0, .52, .25); g.add(fl);
    const L = new THREE.PointLight(0xff9a3c, intensity, 13, 1.6); L.position.set(0, .6, .6); g.add(L);
    this.flickers.push({ L, fl, base: intensity, s: Math.random() * 100 });
  }
  chandelier(x, z, h, intensity = 14) {
    const g = new THREE.Group(); g.position.set(x, h - .9, z); this.root.add(g);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .9, 6), toon(P.iron)); rod.position.y = .45; g.add(rod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.6, .05, 6, 20), toon(P.brass)); ring.rotation.x = Math.PI / 2; g.add(ring);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const c = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .18, 6), toon(P.cream)); c.position.set(Math.cos(a) * .6, .12, Math.sin(a) * .6); g.add(c); const f = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd27a })); f.position.set(Math.cos(a) * .6, .26, Math.sin(a) * .6); g.add(f); }
    const L = new THREE.PointLight(0xffc27a, intensity, 18, 1.4); L.position.y = -.2; L.castShadow = false; g.add(L);
    this.flickers.push({ L, fl: ring, base: intensity, s: Math.random() * 100, soft: true });
  }

  // A rectangular room: entry gap in the south wall (+z), locked door in the north wall (−z) leading to an exit corridor.
  room(W, D, o) {
    const T = .4, H = o.height || 3.6, gap = 2.6;
    const floorMesh = this.floor(W, D, o.floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + 1, D + 1), new THREE.MeshToonMaterial({ color: o.ceil || 0x1d1626 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; this.root.add(ceil);
    const wm = new THREE.MeshToonMaterial({ map: this.tex(o.wall, W / 3.5, 1) }), wmS = new THREE.MeshToonMaterial({ map: this.tex(o.wall, D / 3.5, 1) });
    const trim = toon(o.trim || P.woodDark);
    const seg = (W - gap) / 2;
    [-1, 1].forEach(s => { this.box(seg, H, T, wm, s * (gap / 2 + seg / 2), H / 2, -D / 2 - T / 2, true, false, true); this.box(seg, H, T, wm, s * (gap / 2 + seg / 2), H / 2, D / 2 + T / 2, true, false, true); });
    this.box(gap, H - 2.6, T, wm, 0, 2.6 + (H - 2.6) / 2, -D / 2 - T / 2);
    const board = this.box(gap, H, T, new THREE.MeshToonMaterial({ map: this.tex(TEX.wood(30), 1, 1.4) }), 0, H / 2, D / 2 + T / 2 + .01, true, true, true); // south entry is boarded up — the monster comes through here
    this.box(T, H, D + 2 * T, wmS, -W / 2 - T / 2, H / 2, 0, true, false, true); this.box(T, H, D + 2 * T, wmS, W / 2 + T / 2, H / 2, 0, true, false, true);
    // skirting trim
    [[W, .18, .06, 0, .09, -D / 2 + .03], [W, .18, .06, 0, .09, D / 2 - .03], [.06, .18, D, -W / 2 + .03, .09, 0], [.06, .18, D, W / 2 - .03, .09, 0]].forEach(a => this.box(a[0], a[1], a[2], trim, a[3], a[4], a[5]));
    // exit corridor
    const CD = 4, cz = -D / 2 - T - CD / 2;
    this.floor(gap + .2, CD, this.tex(TEX.stone(160, 30), 1, 1.5), 0, cz);
    this.box(T, H, CD, wm, -gap / 2 - T / 2, H / 2, cz, true, false, true); this.box(T, H, CD, wm, gap / 2 + T / 2, H / 2, cz, true, false, true);
    this.box(gap + 2 * T, H, T, wm, 0, H / 2, -D / 2 - T - CD - T / 2, true, false, true);
    const sign = this.signTex('EXIT', '#7dffc4');
    const pm = new THREE.MeshBasicMaterial({ map: sign, transparent: true }); const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .5), pm); panel.position.set(0, 2.9, -D / 2 - T - CD + .02); this.root.add(panel);
    const cl = new THREE.PointLight(0x7dffc4, 0, 9, 1.5); cl.position.set(0, 2.4, cz); this.root.add(cl);
    // door
    const doorMat = new THREE.MeshToonMaterial({ map: this.tex(TEX.wood(22), 1, 1) });
    const door = this.box(gap - .06, 2.6, .24, doorMat, 0, 1.3, -D / 2 - T / 2, true, true);
    [.45, 2.1].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(gap - .04, .14, .3), toon(P.iron)); b.position.y = y - 1.3; door.add(b); });
    const lockM = new THREE.MeshBasicMaterial({ color: 0xff3344 }); const lock = new THREE.Mesh(new THREE.BoxGeometry(.3, .4, .12), lockM); lock.position.set(.6, 0, .17); door.add(lock);
    const lampM = new THREE.MeshBasicMaterial({ color: 0xff3344 }); const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 8), lampM); lamp.position.set(0, 2.85, -D / 2 + .05); this.root.add(lamp);
    const room = {
      W, D, H, door, floorMesh, opened: false, exitZone: { x0: -gap / 2, x1: gap / 2, z0: -D / 2 - T - CD, z1: -D / 2 - T - .3 },
      smash: () => { board.visible = false; },
      open: () => { if (room.opened) return; room.opened = true; door.userData.solid.on = false; lampM.color.set(0x7dffc4); lockM.color.set(0x7dffc4); this.anim(.9, k => { door.position.y = 1.3 + k * 2.9; cl.intensity = k * 8; }); }
    };
    return room;
  }
  signTex(text, color) { const c = document.createElement('canvas'); c.width = 256; c.height = 80; const x = c.getContext('2d'); x.fillStyle = 'rgba(10,20,16,.9)'; x.fillRect(0, 0, 256, 80); x.strokeStyle = color; x.lineWidth = 6; x.strokeRect(4, 4, 248, 72); x.fillStyle = color; x.font = 'bold 48px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 42); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  anim(d, fn, done) { const a = { t: 0, d, fn, done }; this.tickers.push(a); return a; }
  update(dt, t, danger) {
    for (let i = this.tickers.length - 1; i >= 0; i--) { const a = this.tickers[i]; if (a.tick) { a.tick(t); continue; } a.t += dt; const k = Math.min(1, a.t / a.d); a.fn(k); if (k >= 1) { this.tickers.splice(i, 1); a.done && a.done(); } }
    this.flickers.forEach(f => { const v = f.soft ? 1 + Math.sin(t * 2 + f.s) * .04 : .82 + Math.sin(t * 11 + f.s) * .1 + Math.sin(t * 23 + f.s * 2) * .08; f.L.intensity = f.base * v * (danger ? (Math.random() < .12 ? .1 : .7) : 1); if (!f.soft) f.fl.scale.y = .9 + v * .25; });
  }
}

export function collide(p, solids, R) {
  for (const s of solids) {
    if (!s.on) continue; const cx = clamp(p.x, s.x0, s.x1), cz = clamp(p.z, s.z0, s.z1); const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < R * R) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += dx / d * (R - d); p.z += dz / d * (R - d); }
      else { const l = p.x - s.x0, r = s.x1 - p.x, t = p.z - s.z0, b = s.z1 - p.z, mn = Math.min(l, r, t, b); if (mn === l) p.x = s.x0 - R; else if (mn === r) p.x = s.x1 + R; else if (mn === t) p.z = s.z0 - R; else p.z = s.z1 + R; }
    }
  }
}
// Does the segment a→b cross any wall? Used to muffle voices through walls.
export function wallBetween(ax, az, bx, bz, solids) {
  for (const s of solids) {
    if (!s.on || !s.wall) continue;
    let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az; let ok = true;
    for (const [p, q, lo, hi] of [[-dx, ax - s.x0], [dx, s.x1 - ax], [-dz, az - s.z0], [dz, s.z1 - az]].map(v => v)) {
      if (Math.abs(p) < 1e-9) { if (q < 0) { ok = false; break; } } else { const r = q / p; if (p < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; } else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; } }
    }
    if (ok && t0 <= t1) return true;
  }
  return false;
}
