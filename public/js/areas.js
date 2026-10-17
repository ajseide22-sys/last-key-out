// The four areas of a level. Every client builds the same layout from cfg.seed; the host runs the rules.
// Shared state S is owned by the host and mirrored to everyone in snapshots.
import * as THREE from 'three';
import { PROPS, WALL_TYPES, FLOOR_TYPES, makeKey, toon, P, outline } from './props.js';
import { mulberry, shuffle, clamp, lerp, TEX } from './world.js';

export const DIFF = {
  easy: { label: 'Easy', time: 600, blurb: 'Plenty of time to search', search: .5, fakes: 0, trap: 0, linger: 6, speed: 1, seq: 4, step: .9, runes: 6, torches: 1, replayPen: 0, digits: 3 },
  hard: { label: 'Hard', time: 300, blurb: 'Fake keys, darker rooms', search: .9, fakes: 2, trap: .15, linger: 3.8, speed: 1.35, seq: 6, step: .7, runes: 7, torches: .65, replayPen: 5, digits: 4 },
  impossible: { label: 'Impossible', time: 120, blurb: 'Two minutes. Good luck.', search: 1.3, fakes: 4, trap: .25, linger: 2.8, speed: 1.7, seq: 7, step: .55, runes: 8, torches: .4, replayPen: 10, digits: 4 },
};
export const AREA_NAMES = ['The Locked Manor', 'The Pressure Hall', 'The Grinder', 'The Rune Vault'];

function placeProp(world, A, type, rng, x, z, rotY, searchable = true, wallN) {
  const pr = PROPS[type](rng);
  if (wallN) { const dd = pr.d / 2 + .02; x += wallN[0] * dd; z += wallN[1] * dd; }
  pr.g.position.set(x, 0, z); pr.g.rotation.y = rotY; world.root.add(pr.g);
  const odd = Math.round(rotY / (Math.PI / 2)) % 2 !== 0;
  if (!pr.wallHung) { const hx = (odd ? pr.d : pr.w) / 2 + .03, hz = (odd ? pr.w : pr.d) / 2 + .03; world.solid(x - hx, x + hx, z - hz, z + hz); }
  if (pr.tick) world.tickers.push({ tick: pr.tick });
  if (!searchable) return pr;
  const pid = 'q' + A.props.size; pr.pid = pid; pr.x = x; pr.z = z; pr.type = type;
  pr.g.traverse(o => { if (o.isMesh && !o.userData.ink) { o.userData.pid = pid; world.hit.push(o); } });
  A.props.set(pid, pr); return pr;
}
function spawns(D, n) { const a = []; const cols = Math.min(n, 4); for (let i = 0; i < n; i++) { const r = Math.floor(i / 4), c = i % 4; a.push({ x: (c - (Math.min(n - r * 4, 4) - 1) / 2) * 1.3, z: D / 2 - 1.5 - r * 1.3 }); } return a; }
function tag(world, mesh, pid) { mesh.traverse(o => { if (o.isMesh && !o.userData.ink) { o.userData.pid = pid; world.hit.push(o); } }); }

/* =================================================================== AREA 1: THE LOCKED MANOR */
function buildManor(world, cfg) {
  const rng = mulberry(cfg.seed), d = DIFF[cfg.diff], n = cfg.n;
  const W = Math.min(22 + 4 * (n - 1), 44), D = Math.min(16 + 3 * (n - 1), 34);
  const theme = [['#5b2a3a', '#4a2030', 26], ['#2a4a5b', '#203c4a', 30], ['#3a4a2a', '#2e3c20', 22]][(cfg.level - 1) % 3];
  const room = world.room(W, D, { floor: world.tex(TEX.wood(theme[2]), W / 4, D / 4, rng), wall: TEX.wallpaper(theme[0], theme[1]), height: 3.6 });
  const A = { name: AREA_NAMES[0], W, D, room, props: new Map(), spawn: spawns(D, n) };
  // interior walls split the manor into wings, so you lose sight (and earshot) of each other
  const wm = new THREE.MeshToonMaterial({ map: world.tex(TEX.wallpaper(theme[0], theme[1]), 2, 1) });
  const zD = -D / 2 + D * .42, T = .3, gaps = W >= 30 ? [-W * .3, 0, W * .3] : [-W * .28, W * .28], gw = 2.4;
  const segs = []; let x0 = -W / 2;
  gaps.concat([W / 2 + gw / 2]).forEach(g => { const a = x0, b = g - gw / 2; if (b - a > .2) { world.box(b - a, 3.6, T, wm, (a + b) / 2, 1.8, zD, true, true, true); segs.push({ a, b }); } x0 = g + gw / 2; });
  const vdiv = []; if (W >= 26) [-1, 1].forEach(s => { const x = s * W / 4, z0 = zD + T / 2, z1 = zD + (D / 2 - zD) * .5; world.box(T, 3.6, z1 - z0, wm, x, 1.8, (z0 + z1) / 2, true, true, true); vdiv.push({ x, z0, z1 }); });
  // wall slots for wall props
  const slots = [];
  const run = (ax, az, bx, bz, nx, nz, avoid) => { const L = Math.hypot(bx - ax, bz - az); for (let t = 1.3; t < L - 1.1; t += 2.3) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L; if (avoid && avoid(x, z)) continue; slots.push({ x, z, nx, nz }); } };
  run(-W / 2, -D / 2, W / 2, -D / 2, 0, 1, (x) => Math.abs(x) < 2.5);
  run(-W / 2, D / 2, W / 2, D / 2, 0, -1, (x) => Math.abs(x) < 3.2);
  run(-W / 2, -D / 2, -W / 2, D / 2, 1, 0, (x, z) => Math.abs(z - zD) < 1);
  run(W / 2, -D / 2, W / 2, D / 2, -1, 0, (x, z) => Math.abs(z - zD) < 1);
  segs.forEach(s => { run(s.a, zD - T / 2, s.b, zD - T / 2, 0, -1); run(s.a, zD + T / 2, s.b, zD + T / 2, 0, 1); });
  vdiv.forEach(v => { run(v.x - T / 2, v.z0, v.x - T / 2, v.z1, -1, 0); run(v.x + T / 2, v.z0, v.x + T / 2, v.z1, 1, 0); });
  shuffle(slots, rng);
  const torchN = Math.max(3, Math.round(slots.length * .25 * d.torches));
  slots.slice(0, torchN).forEach(s => world.torch(s.x + s.nx * .02, s.z + s.nz * .02, Math.atan2(s.nx, s.nz), 6, 2.75));
  const usable = slots;
  const wallCount = Math.round(usable.length * .78);
  let safePlaced = false;
  usable.slice(0, wallCount).forEach((s, i) => {
    let type = WALL_TYPES[Math.floor(rng() * WALL_TYPES.length)];
    if (!safePlaced && i === 3) { type = 'safe'; safePlaced = true; }
    const pr = placeProp(world, A, type, rng, s.x, s.z, Math.atan2(s.nx, s.nz), true, [s.nx, s.nz]);
    if (type === 'safe') A.safePid = pr.pid;
  });
  // floor props on a jittered grid
  const near = (x, z) => (Math.abs(x) < 3.2 && z > D / 2 - 4.2) || (Math.abs(x) < 3.2 && z < -D / 2 + 3.2) || Math.abs(z - zD) < 1.9 || gaps.some(g => Math.abs(x - g) < 2.2 && Math.abs(z - zD) < 3.2) || vdiv.some(v => Math.abs(x - v.x) < 1.8 && z > v.z0 - 1 && z < v.z1 + 1.4);
  for (let x = -W / 2 + 2.7; x <= W / 2 - 2.7; x += 3.3) for (let z = -D / 2 + 2.7; z <= D / 2 - 2.7; z += 3.3) {
    const px = x + (rng() - .5) * .6, pz = z + (rng() - .5) * .6; if (near(px, pz) || rng() < .12) continue;
    const type = FLOOR_TYPES[Math.floor(rng() * FLOOR_TYPES.length)];
    const rot = Math.floor(rng() * 4) * Math.PI / 2;
    placeProp(world, A, type, rng, px, pz, rot);
  }
  // rugs and chandeliers for life
  for (let i = 0; i < 3; i++) { const rug = new THREE.Mesh(new THREE.PlaneGeometry(3 + rng() * 2, 2 + rng() * 1.5), toon([P.red, P.purple, P.teal][i])); rug.rotation.x = -Math.PI / 2; rug.position.set((rng() - .5) * (W - 6), .012, (rng() - .5) * (D - 6)); rug.receiveShadow = true; world.root.add(rug); }
  const chN = Math.max(1, Math.round((W * D / 220) * d.torches)); for (let i = 0; i < chN; i++) world.chandelier((rng() - .5) * (W - 6), (rng() - .5) * (D - 6), 3.6, 10);
  // hide things
  const searchables = [...A.props.values()].filter(p => p.pid !== A.safePid).map(p => p.pid); shuffle(searchables, rng);
  A.need = Math.min(n + 2 + (cfg.level - 1), 10);
  const contents = {}; let k = 0;
  for (let i = 0; i < A.need - 1; i++) contents[searchables[k++]] = 'key';
  contents[searchables[k++]] = 'note';
  for (let i = 0; i < d.fakes + Math.floor((cfg.level - 1) / 2); i++) if (k < searchables.length) contents[searchables[k++]] = 'fake';
  for (; k < searchables.length; k++) if (rng() < d.trap) contents[searchables[k]] = 'trap';
  A.contents = contents;
  A.code = Array.from({ length: d.digits }, () => Math.floor(rng() * 10)).join('');
  tag(world, room.door, 'door');

  A.init = S => { S.found = 0; S.need = A.need; S.opened = {}; S.door = false; S.safeOpen = false; S.safeTries = 0; S.noteBy = null; };
  A.info = (pid, S) => {
    if (pid === 'door') return S.door ? null : S.found >= S.need ? { label: 'Unlock the door', hold: false } : { label: `Locked · ${S.need - S.found} more key${S.need - S.found === 1 ? '' : 's'}`, hold: false, locked: true };
    if (pid === A.safePid) return S.safeOpen ? { label: 'Empty safe', done: true } : { label: `Enter safe code (${A.code.length} digits)`, hold: false, safe: true };
    const pr = A.props.get(pid); if (!pr) return null;
    if (S.opened[pid]) return { label: 'Already searched', done: true };
    return { label: pr.label, hold: true };
  };
  A.request = (S, from, e) => {
    if (e.type === 'search') { if (S.opened[e.pid] || !A.props.has(e.pid) || e.pid === A.safePid) return; const c = A.contents[e.pid] || 'empty'; S.opened[e.pid] = { c, by: from }; if (c === 'key') S.found++; if (c === 'note') S.noteBy = from; }
    else if (e.type === 'door') { if (S.found >= S.need && !S.door) S.door = true; }
    else if (e.type === 'safe') { if (S.safeOpen) return; if (String(e.code) === A.code) { S.safeOpen = true; S.found++; S.opened[A.safePid] = { c: 'key', by: from }; } else S.safeTries++; }
  };
  A.hostUpdate = () => { };
  const shown = new Set(); let lastTries = 0;
  A.render = (dt, S, ctx) => {
    for (const pid in S.opened) {
      if (shown.has(pid)) continue; shown.add(pid); const pr = A.props.get(pid); if (!pr) continue; const o = S.opened[pid];
      world.anim(.5, pr.open);
      if (ctx.fresh) ctx.fx(o.c, { by: o.by, x: pr.x, z: pr.z, y: pr.y, pid, code: A.code });
      if (o.c === 'key') { const key = makeKey(); key.position.set(pr.x, pr.y - .2, pr.z); world.root.add(key); world.anim(1.1, t => { key.position.y = pr.y - .2 + t * .9; key.rotation.y = t * 9; key.scale.setScalar(t < .8 ? 1 : 1 - (t - .8) * 5); }, () => world.root.remove(key)); }
    }
    if (S.door && !room.opened) { room.open(); if (ctx.fresh) ctx.fx('door'); }
    if (S.safeTries !== lastTries) { if (ctx.fresh && S.safeTries > lastTries) ctx.fx('safeWrong'); lastTries = S.safeTries; }
  };
  A.objective = S => S.door ? 'The door is open. Everyone into the exit!' : S.found >= S.need ? 'All keys found. Unlock the door in the north wall!' : `Search the manor for ${S.need} keys. One is in the safe; its code is on a note somewhere.`;
  A.progress = S => `Keys ${S.found}/${S.need}`;
  A.exitOpen = S => S.door;
  return A;
}

/* =================================================================== AREA 2: THE PRESSURE HALL */
function buildPlates(world, cfg) {
  const rng = mulberry(cfg.seed), d = DIFF[cfg.diff], n = cfg.n;
  const W = Math.min(24 + 3 * (n - 1), 44), D = Math.min(18 + 2 * (n - 1), 30);
  const room = world.room(W, D, { floor: world.tex(TEX.checker('#3a3346', '#2a2434'), W / 4, D / 4), wall: TEX.brick, height: 4.2 });
  const A = { name: AREA_NAMES[1], W, D, room, props: new Map(), spawn: spawns(D, n) };
  const count = Math.min(n + 2 + Math.floor((cfg.level - 1) / 2), 9);
  const linger = +(d.linger + Math.max(0, count - n) * .9).toFixed(1); // fewer players than plates means more running
  const avoid = [{ x: 0, z: D / 2 - 1.5, r: 3.5 }, { x: 0, z: -D / 2 + .5, r: 3.5 }];
  const pts = []; let tries = 0; const minD = Math.min(7, W / 3.2);
  while (pts.length < count && tries++ < 5000) { const x = (rng() - .5) * (W - 3), z = (rng() - .5) * (D - 3); if (avoid.some(a => Math.hypot(a.x - x, a.z - z) < a.r)) continue; if (pts.some(p => Math.hypot(p.x - x, p.z - z) < minD)) continue; pts.push({ x, z }); }
  A.plates = pts.map(p => {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, .14, 32), toon(0x2c2638)); base.position.set(p.x, .07, p.z); world.root.add(base);
    const gm = new THREE.MeshToonMaterial({ color: 0x3a2a14, emissive: 0xffb347, emissiveIntensity: .05 }); const top = new THREE.Mesh(new THREE.CylinderGeometry(.85, .85, .1, 32), gm); top.position.set(p.x, .18, p.z); outline(top, .03); world.root.add(top);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.8, .8, 4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); beam.position.set(p.x, 2.1, p.z); world.root.add(beam);
    return { x: p.x, z: p.z, top, gm, beam };
  });
  for (let i = 0; i < Math.min(4 + n, 10); i++) { const x = (rng() - .5) * (W - 4), z = (rng() - .5) * (D - 4); if (avoid.some(a => Math.hypot(a.x - x, a.z - z) < a.r) || pts.some(p => Math.hypot(p.x - x, p.z - z) < 2.8)) continue; const pm = new THREE.MeshToonMaterial({ map: world.tex(TEX.brick, 1, 2) }); world.box(1.2, 4.2, 1.2, pm, x, 2.1, z, true, true, true); }
  for (let i = 0; i < 8; i++) { const x = (rng() - .5) * (W - 3), z = (rng() - .5) * (D - 3); if (avoid.some(a => Math.hypot(a.x - x, a.z - z) < a.r) || pts.some(p => Math.hypot(p.x - x, p.z - z) < 2.6)) continue; placeProp(world, A, ['crate', 'barrel', 'boxes', 'armor'][i % 4], rng, x, z, Math.floor(rng() * 4) * Math.PI / 2, false); }
  [-1, 1].forEach(s => [-.25, .25].forEach(f => world.torch(s * W / 2, f * D, -s * Math.PI / 2, 7)));
  world.torch(-2.6, -D / 2, 0, 6); world.torch(2.6, -D / 2, 0, 6);
  A.init = S => { S.plates = A.plates.map(() => 0); S.occ = A.plates.map(() => 0); S.door = false; };
  A.info = () => null; A.request = () => { };
  A.hostUpdate = (dt, S, ctx) => {
    A.plates.forEach((pl, i) => {
      const occ = ctx.players.some(p => !p.eaten && Math.hypot(p.x - pl.x, p.z - pl.z) < .95 && p.y < .6);
      S.occ[i] = occ ? 1 : 0;
      if (S.door || occ) S.plates[i] = linger; else S.plates[i] = Math.max(0, S.plates[i] - dt);
    });
    if (!S.door && S.plates.every(t => t > 0)) S.door = true;
  };
  const lastOcc = [];
  A.render = (dt, S, ctx) => {
    A.plates.forEach((pl, i) => {
      const t = S.plates[i] || 0, f = t / linger, occ = S.occ[i];
      pl.gm.emissiveIntensity = occ || S.door ? 2 : (t > 0 ? .3 + 1.3 * f : .05);
      pl.top.position.y = occ ? .14 : .18;
      pl.beam.material.opacity = S.door ? .12 : t > 0 ? .08 + .14 * f : 0; pl.beam.scale.y = t > 0 ? .3 + .7 * f : .01;
      if (occ && !lastOcc[i] && ctx.fresh) ctx.fx('plate'); lastOcc[i] = occ;
    });
    if (S.door && !room.opened) { room.open(); if (ctx.fresh) ctx.fx('door'); }
  };
  A.objective = S => S.door ? 'The gate is open. Everyone into the exit!' : `Light all ${A.plates.length} plates at once. A plate stays lit for ${linger} s after you step off.`;
  A.progress = S => `Plates ${(S.plates || []).filter(t => t > 0).length}/${A.plates.length}`;
  A.exitOpen = S => S.door;
  return A;
}

/* =================================================================== AREA 3: THE GRINDER */
function buildGrinder(world, cfg) {
  const rng = mulberry(cfg.seed), d = DIFF[cfg.diff], n = cfg.n;
  const W = Math.min(10 + 2 * (n - 1), 18), D = 56 + (W - 10) * 2;
  const room = world.room(W, D, { floor: world.tex(TEX.metal, W / 3, D / 3), wall: TEX.brick, height: 4 });
  room.open();
  const A = { name: AREA_NAMES[2], W, D, room, props: new Map(), spawn: spawns(D, n) };
  const mul = d.speed * (1 + .08 * (cfg.level - 1));
  const rows = Math.min(6 + (cfg.level - 1), 11), z0 = D / 2 - 3.5 - W / 2, z1 = -D / 2 + 3.5 + W / 2, step = (z0 - z1) / (rows - 1);
  const pool = []; while (pool.length < rows) pool.push(...shuffle(['low', 'high', 'slide', 'spikes', 'pendulum'], rng)); const order = pool.slice(0, rows);
  const hazM = new THREE.MeshToonMaterial({ map: world.tex(TEX.hazard, 2, 1) }), steel = toon(0x9d99ab), red = new THREE.MeshToonMaterial({ color: 0xff3344, emissive: 0xff2233, emissiveIntensity: .7 });
  const hz = [];
  order.forEach((type, k) => {
    const z = z0 - k * step, ph = rng() * 10;
    if (type === 'low' || type === 'high') {
      const y = type === 'low' ? .42 : 1.45, L = W / 2 - .25;
      const post = world.box(.45, y + .2, .45, steel, 0, (y + .2) / 2, z, true, true);
      const pv = new THREE.Group(); pv.position.set(0, y, z); world.root.add(pv);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, L * 2, 10), hazM); bar.rotation.z = Math.PI / 2; bar.castShadow = true; outline(bar, .025); pv.add(bar);
      [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), red); e.position.x = s * L; pv.add(e); });
      const w = (.9 + rng() * .35) * mul * (rng() < .5 ? 1 : -1);
      hz.push({ type, set(t) { pv.rotation.y = ph + w * t; }, hit(p, t) { const a = ph + w * t, cx = Math.cos(a), cz = -Math.sin(a); const s = clamp(p.x * cx + (p.z - z) * cz, -L, L); const dd = Math.hypot(p.x - s * cx, p.z - (z + s * cz)); if (dd > .48) return false; return type === 'low' ? p.y < .55 : (p.y + p.h > 1.32 && p.y < 1.6); } });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .45), new THREE.MeshBasicMaterial({ map: world.signTex(type === 'low' ? 'JUMP' : 'DUCK', '#ffc93c'), transparent: true })); sign.position.set(-W / 2 + .03, 2.4, z); sign.rotation.y = Math.PI / 2; world.root.add(sign);
    } else if (type === 'slide') {
      const nb = cfg.diff === 'easy' && cfg.level === 1 ? 1 : 2, range = W / 2 - 1.1, w = (1 + rng() * .4) * mul;
      const blocks = Array.from({ length: nb }, (_, b) => ({ m: world.box(1.8, 1.7, 1.2, hazM, 0, .85, z, false, true), ph: b * Math.PI, x: 0 }));
      hz.push({ type, set(t) { blocks.forEach(b => { b.x = Math.sin(ph + t * w + b.ph) * range; b.m.position.x = b.x; }); }, hit(p) { return blocks.some(b => { const cx = clamp(p.x, b.x - .9, b.x + .9), cz = clamp(p.z, z - .6, z + .6); return Math.hypot(p.x - cx, p.z - cz) < .36; }); } });
    } else if (type === 'spikes') {
      const g = new THREE.Group(); g.position.set(0, 0, z); world.root.add(g); const cone = new THREE.ConeGeometry(.14, .6, 6);
      for (let x = -W / 2 + .3; x < W / 2; x += .45) for (let r = -1; r <= 1; r++) { const c = new THREE.Mesh(cone, steel); c.position.set(x + (r % 2 ? .22 : 0), .3, r * .5); c.castShadow = true; g.add(c); }
      const warnM = new THREE.MeshBasicMaterial({ color: 0xff2233, transparent: true, opacity: 0 }); const warn = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.7), warnM); warn.rotation.x = -Math.PI / 2; warn.position.set(0, .02, z); world.root.add(warn);
      const Pd = 3.2 / mul; let up = false;
      hz.push({ type, set(t) { const f = ((t + ph) % Pd) / Pd; let y = -.75; warnM.opacity = 0; up = false; if (f > .5 && f < .7) { warnM.opacity = .25 + .25 * Math.sin(t * 40); y = -.62; } else if (f >= .7) { y = lerp(-.62, 0, Math.min(1, (f - .7) * 12)); up = y > -.25; } g.position.y = y; }, hit(p) { return up && Math.abs(p.z - z) < .95 && p.y < .5; } });
    } else {
      const top = 3.9, Lr = 3.2, amp = Math.asin(Math.min(.95, (W / 2 - .6) / Lr)), w = (1.5 + rng() * .4) * Math.sqrt(mul);
      const pv = new THREE.Group(); pv.position.set(0, top, z); world.root.add(pv);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, Lr, 6), steel); rod.position.y = -Lr / 2; pv.add(rod);
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .12, 24, 1, false, Math.PI, Math.PI), steel); blade.rotation.x = Math.PI / 2; blade.position.y = -Lr; outline(blade, .02); pv.add(blade);
      world.box(W, .2, .3, steel, 0, top + .05, z);
      hz.push({ type, set(t) { pv.rotation.z = Math.sin(ph + t * w) * amp; }, hit(p, t) { const a = Math.sin(ph + t * w) * amp; const bx = Math.sin(a) * Lr, by = top - Math.cos(a) * Lr; return Math.abs(p.z - z) < .4 && Math.abs(p.x - bx) < .75 && by - .75 < p.y + p.h && by > p.y - .1; } });
    }
  });
  A.checkpoints = []; for (let k = 2; k < rows; k += 2) { const cz = z0 - k * step + step / 2; A.checkpoints.push(cz); const m = new THREE.Mesh(new THREE.PlaneGeometry(W, .5), new THREE.MeshBasicMaterial({ color: 0x7dffc4, transparent: true, opacity: .35 })); m.rotation.x = -Math.PI / 2; m.position.set(0, .025, cz); world.root.add(m); }
  for (let z = D / 2 - 4; z > -D / 2 + 2; z -= 7) { world.torch(-W / 2, z, Math.PI / 2, 6); world.torch(W / 2, z - 3.5, -Math.PI / 2, 6); }
  A.hazards = hz;
  A.init = S => { S.door = true; };
  A.info = () => null; A.request = () => { }; A.hostUpdate = () => { };
  A.render = (dt, S, ctx) => {
    const t = (ctx.now - cfg.startAt) / 1000; hz.forEach(h => h.set(t));
    const me = ctx.me; if (!me || me.eaten || ctx.phase !== 'play') return;
    A.checkpoints.forEach(cz => { if (me.z < cz && me.ck.z > cz) { me.ck = { x: clamp(me.x, -W / 2 + .6, W / 2 - .6), z: cz - .2 }; ctx.fx('checkpoint'); } });
    if (me.inv <= 0 && hz.some(h => h.hit(me, t))) ctx.fx('smack');
  };
  A.objective = () => 'Get everyone past the traps. Jump the low bars, crouch under the high ones.';
  A.progress = (S, ctx) => ctx.exitText();
  A.exitOpen = () => true;
  return A;
}

/* =================================================================== AREA 4: THE RUNE VAULT */
const RUNES = [{ c: '#ffb347', d: 'sun' }, { c: '#4de1c9', d: 'wave' }, { c: '#ff5d73', d: 'tri' }, { c: '#b388ff', d: 'moon' }, { c: '#9cff57', d: 'eye' }, { c: '#f4f1ff', d: 'star' }, { c: '#4d9bff', d: 'drop' }, { c: '#ff8ae0', d: 'heart' }];
function runeTex(r) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const m = 128;
  x.fillStyle = '#120e1c'; x.fillRect(0, 0, 256, 256); x.strokeStyle = r.c; x.fillStyle = r.c; x.lineWidth = 16; x.lineCap = x.lineJoin = 'round';
  x.save(); x.globalAlpha = .35; x.lineWidth = 6; x.beginPath(); x.arc(m, m, 112, 0, 7); x.stroke(); x.restore();
  const d = r.d; x.beginPath();
  if (d === 'sun') { x.arc(m, m, 34, 0, 7); x.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(m + Math.cos(a) * 56, m + Math.sin(a) * 56); x.lineTo(m + Math.cos(a) * 82, m + Math.sin(a) * 82); x.stroke(); } }
  else if (d === 'wave') { for (let k = -1; k <= 1; k++) { x.beginPath(); for (let i = 0; i <= 40; i++) { const px = m - 75 + i * 3.75, py = m + k * 36 + Math.sin(i / 40 * Math.PI * 3) * 14; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); } }
  else if (d === 'tri') { x.moveTo(m, m - 72); x.lineTo(m + 68, m + 50); x.lineTo(m - 68, m + 50); x.closePath(); x.stroke(); }
  else if (d === 'moon') { x.arc(m, m, 64, Math.PI * .3, Math.PI * 1.7); x.arc(m + 30, m, 48, Math.PI * 1.6, Math.PI * .4, true); x.closePath(); x.fill(); }
  else if (d === 'eye') { x.moveTo(m - 80, m); x.quadraticCurveTo(m, m - 70, m + 80, m); x.quadraticCurveTo(m, m + 70, m - 80, m); x.stroke(); x.beginPath(); x.arc(m, m, 20, 0, 7); x.fill(); }
  else if (d === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 32 : 78; i ? x.lineTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr) : x.moveTo(m + Math.cos(a) * rr, m + Math.sin(a) * rr); } x.closePath(); x.stroke(); }
  else if (d === 'drop') { x.moveTo(m, m - 80); x.bezierCurveTo(m + 70, m, m + 50, m + 70, m, m + 70); x.bezierCurveTo(m - 50, m + 70, m - 70, m, m, m - 80); x.stroke(); }
  else { x.moveTo(m, m + 66); x.bezierCurveTo(m - 100, m, m - 50, m - 80, m, m - 30); x.bezierCurveTo(m + 50, m - 80, m + 100, m, m, m + 66); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function buildRunes(world, cfg) {
  const rng = mulberry(cfg.seed), d = DIFF[cfg.diff], n = cfg.n;
  const W = Math.min(20 + 2 * (n - 1), 36), D = 18;
  const room = world.room(W, D, { floor: world.tex(TEX.stone(240, 26), W / 4, D / 4, rng), wall: TEX.brick, height: 5 });
  const A = { name: AREA_NAMES[3], W, D, room, props: new Map(), spawn: spawns(D, n) };
  const N = d.runes, rad = 6;
  A.tiles = []; for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / N + Math.PI / N, x = Math.cos(a) * rad * 1.15, z = Math.sin(a) * rad * .85;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, .12, 32), toon(0x231c30)); base.position.set(x, .06, z); world.root.add(base);
    const tx = runeTex(RUNES[i]); const m = new THREE.MeshToonMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: .15 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .06, 32), m); top.position.set(x, .15, z); top.rotation.y = -Math.PI / 2; world.root.add(top);
    A.tiles.push({ x, z, m, glow: 0, col: new THREE.Color(RUNES[i].c) });
  }
  world.box(1.4, .8, 1.4, toon(0x2a2236), 0, .4, 0, true, true);
  const cm = new THREE.MeshToonMaterial({ color: 0x2a2340, emissive: 0x6b5aff, emissiveIntensity: .5 });
  const cry = new THREE.Mesh(new THREE.OctahedronGeometry(.9, 0), cm); cry.scale.set(1, 1.6, 1); cry.position.y = 2.2; outline(cry, .04); world.root.add(cry);
  const cl = new THREE.PointLight(0x6b5aff, 16, 16, 1.4); cl.position.set(0, 3, 0); world.root.add(cl);
  const L = Math.min(d.seq + (cfg.level - 1), 12); const seq = []; while (seq.length < L) { const v = Math.floor(rng() * N); if (v !== seq[seq.length - 1]) seq.push(v); }
  A.seq = seq;
  const lx = -W / 2 + 1.6, lz = D / 2 - 2.4;
  const lect = new THREE.Group(); lect.position.set(lx, 0, lz); world.root.add(lect);
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, 1, 8), toon(P.woodDark)); b1.position.y = .5; outline(b1); lect.add(b1);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(.8, .08, .6), new THREE.MeshToonMaterial({ color: P.woodLight, emissive: 0x6b5aff, emissiveIntensity: .4 })); b2.position.y = 1.05; b2.rotation.x = -.3; outline(b2); lect.add(b2);
  world.solid(lx - .4, lx + .4, lz - .4, lz + .4); tag(world, lect, 'lectern');
  [-1, 1].forEach(s => [-.25, .25].forEach(f => world.torch(s * W / 2, f * D, -s * Math.PI / 2, 6)));
  for (let i = 0; i < 10; i++) { const a = rng() * 7, r = 7.5 + rng() * 2; const x = Math.cos(a) * r * 1.2, z = Math.sin(a) * r * .7; if (Math.abs(x) > W / 2 - 1 || Math.abs(z) > D / 2 - 1.2 || (Math.abs(x) < 3 && Math.abs(z) > D / 2 - 4)) continue; const c = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .3 + rng() * .3, 8), toon(P.cream)); c.position.set(x, .2, z); world.root.add(c); }
  const stepD = d.step;
  A.init = S => { S.rune = { st: 'wait', at: 0, prog: 0, wrongAt: 0, okAt: 0, okTile: -1 }; S.door = false; S.waitUntil = 0; };
  A.info = (pid, S) => pid === 'lectern' && !S.door && S.rune.st === 'input' ? { label: d.replayPen ? `Replay pattern (costs ${d.replayPen} s)` : 'Replay pattern', hold: false } : null;
  A.request = (S, from, e, ctx) => { if (e.type === 'replay' && S.rune.st === 'input' && !S.door) { S.rune = { st: 'wait', at: ctx.now, prog: 0, wrongAt: 0, okAt: 0, okTile: -1 }; S.penalty = (S.penalty || 0) + d.replayPen; } };
  const hostTile = {};
  A.hostUpdate = (dt, S, ctx) => {
    const R = S.rune, now = ctx.now;
    if (R.st === 'wait') { if (!R.at) R.at = now; if (now - R.at > 1500) { R.st = 'show'; R.at = now; } }
    else if (R.st === 'show') { if (now - R.at > L * stepD * 1000 + 200) { R.st = 'input'; R.at = now; } }
    ctx.players.forEach(p => {
      if (p.eaten) return; let on = -1; A.tiles.forEach((t, i) => { if (Math.hypot(p.x - t.x, p.z - t.z) < .95) on = i; });
      const prev = hostTile[p.id] ?? -1;
      if (on >= 0 && prev !== on) { hostTile[p.id] = on; if (R.st === 'input' && !S.door) { if (seq[R.prog] === on) { R.prog++; R.okAt = now; R.okTile = on; if (R.prog >= L) { S.door = true; R.st = 'done'; } } else { S.rune = { st: 'wait', at: now, prog: 0, wrongAt: now, okAt: 0, okTile: -1 }; } } }
      else if (on < 0 && prev >= 0) { const t = A.tiles[prev]; if (Math.hypot(p.x - t.x, p.z - t.z) > 1.2) hostTile[p.id] = -1; }
    });
  };
  let lastStep = -1, lastOk = 0, lastWrong = 0;
  A.render = (dt, S, ctx) => {
    const R = S.rune || {}; cry.rotation.y += dt * .8; cry.position.y = 2.2 + Math.sin(ctx.now / 500) * .12;
    let lit = -1;
    if (R.st === 'show') { const e = (ctx.now - R.at) / 1000, s = Math.floor(e / stepD), f = (e % stepD) / stepD; if (s < L && f < .72) { lit = seq[s]; if (s !== lastStep) { lastStep = s; ctx.fx('rune', { i: lit }); } } } else lastStep = -1;
    if (R.okAt && R.okAt !== lastOk) { lastOk = R.okAt; A.tiles[R.okTile].glow = 1; if (ctx.fresh) ctx.fx('rune', { i: R.okTile }); }
    if (R.wrongAt && R.wrongAt !== lastWrong) { lastWrong = R.wrongAt; if (ctx.fresh) ctx.fx('wrong'); }
    A.tiles.forEach((t, i) => { if (i === lit) t.glow = 1; t.glow = Math.max(0, t.glow - dt * 2.4); t.m.emissiveIntensity = .15 + t.glow * 2.2; });
    const wrongNow = R.wrongAt && ctx.now - R.wrongAt < 1000;
    const target = wrongNow ? new THREE.Color(0xff2233) : lit >= 0 ? A.tiles[lit].col : S.door ? new THREE.Color(0x7dffc4) : new THREE.Color(0x6b5aff);
    cm.emissive.lerp(target, Math.min(1, dt * (lit >= 0 ? 20 : 4))); cl.color.copy(cm.emissive); cm.emissiveIntensity = lit >= 0 ? 2 : 1;
    if (S.door && !room.opened) { room.open(); if (ctx.fresh) ctx.fx('door'); }
  };
  A.objective = S => S.door ? 'The vault is open. Everyone into the exit!' : (S.rune || {}).st === 'input' ? 'Step on the runes in the order the crystal showed. Anyone can step.' : 'Watch the crystal. Remember the order of the colors.';
  A.progress = S => `Pattern ${(S.rune || {}).prog || 0}/${L}`;
  A.exitOpen = S => S.door;
  return A;
}

export const BUILDERS = [buildManor, buildPlates, buildGrinder, buildRunes];
