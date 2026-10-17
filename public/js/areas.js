// The two rooms of a level. Every client builds the same layout from cfg.seed; the host runs the rules.
// Shared state S is owned by the host and mirrored to everyone in snapshots.
import * as THREE from 'three';
import { PROPS, WALL_TYPES, FLOOR_TYPES, makeKey, toon, P, outline } from './props.js';
import { mulberry, shuffle, clamp, lerp, TEX } from './world.js';
import { buildNav, stepSentries } from './sentry.js';

export const DIFF = {
  easy: { label: 'Easy', time: 600, blurb: 'Slow sentries, short course', search: .5, fakes: 0, trap: 0, digits: 3, sentries: 2, sSpeed: 2.7, sense: 7, beam: 16, pick: 2, course: 16, cMul: 1, blink: false },
  hard: { label: 'Hard', time: 300, blurb: 'More sentries, fake keys', search: .9, fakes: 2, trap: .15, digits: 4, sentries: 4, sSpeed: 3.3, sense: 10, beam: 19, pick: 3, course: 22, cMul: 1.3, blink: true },
  impossible: { label: 'Impossible', time: 120, blurb: 'Two minutes. Good luck.', search: 1.3, fakes: 4, trap: .25, digits: 4, sentries: 6, sSpeed: 3.9, sense: 13, beam: 22, pick: 4, course: 28, cMul: 1.6, blink: true },
};
export const AREA_NAMES = ['The Locked Study', 'The Grinder'];
export const ROOMS = 2;

function placeProp(world, A, type, rng, x, z, rotY, searchable = true, wallN) {
  const pr = PROPS[type](rng);
  if (wallN) { const dd = pr.d / 2 + .02; x += wallN[0] * dd; z += wallN[1] * dd; }
  pr.g.position.set(x, 0, z); pr.g.rotation.y = rotY; world.root.add(pr.g);
  const odd = Math.round(rotY / (Math.PI / 2)) % 2 !== 0;
  if (!pr.wallHung) { const hx = (odd ? pr.d : pr.w) / 2 + .03, hz = (odd ? pr.w : pr.d) / 2 + .03; world.solid(x - hx, x + hx, z - hz, z + hz); }
  if (pr.tick) world.tickers.push({ tick: pr.tick });
  if (!searchable) return pr;
  const pid = 'q' + A.props.size; pr.pid = pid; pr.x = x; pr.z = z; pr.type = type;
  pr.g.traverse(o => { if (o.isMesh && !o.userData.ink) o.userData.pid = pid; });
  A.props.set(pid, pr); return pr;
}
function spawns(D, n, y = 0, z0) { const a = []; for (let i = 0; i < n; i++) { const r = Math.floor(i / 4), c = i % 4; a.push({ x: (c - (Math.min(n - r * 4, 4) - 1) / 2) * 1.3, z: (z0 ?? D / 2 - 1.5) - r * 1.3, y }); } return a; }
function tag(mesh, pid) { mesh.traverse(o => { if (o.isMesh && !o.userData.ink) o.userData.pid = pid; }); }
const segDist = (px, pz, a) => { const dx = a.bx - a.ax, dz = a.bz - a.az, L2 = dx * dx + dz * dz || 1; const t = clamp(((px - a.ax) * dx + (pz - a.az) * dz) / L2, 0, 1); return Math.hypot(px - (a.ax + dx * t), pz - (a.az + dz * t)); };

/* =================================================================== ROOM 1: THE LOCKED STUDY */
function buildStudy(world, cfg) {
  const rng = mulberry(cfg.seed), d = DIFF[cfg.diff], n = cfg.n;
  const W = Math.min(36 + 5 * (n - 1), 62), D = Math.min(28 + 3 * (n - 1), 48);
  const theme = [['#4a2232', '#3a1a28', 26], ['#223a4a', '#1a2e3a', 30], ['#2e3a22', '#24301a', 22]][(cfg.level - 1) % 3];
  const room = world.room(W, D, { floor: world.tex(TEX.wood(theme[2]), W / 4, D / 4, rng), wall: TEX.wallpaper(theme[0], theme[1]), height: 3.6 });
  const A = { name: AREA_NAMES[0], W, D, room, props: new Map(), spawn: spawns(D, n), kind: 'study' };
  const wm = new THREE.MeshToonMaterial({ map: world.tex(TEX.wallpaper(theme[0], theme[1]), 2, 1) });

  // wings: a grid of rooms joined by doorways (some walls left open)
  const cols = Math.max(3, Math.round(W / 12)), rows = Math.max(3, Math.round(D / 10)), T = .3, gw = 2.4;
  const xs = Array.from({ length: cols + 1 }, (_, i) => -W / 2 + i * W / cols), zs = Array.from({ length: rows + 1 }, (_, j) => -D / 2 + j * D / rows);
  const pieces = [], gaps = [];
  const wallLine = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), horiz = az === bz; const g = 1.6 + gw / 2 + rng() * (L - 3.2 - gw);
    const parts = [[0, g - gw / 2], [g + gw / 2, L]];
    if (L > 9 && rng() < .5) { const g2 = g < L / 2 ? g + L / 2.2 : g - L / 2.2; if (g2 > 1.6 + gw / 2 && g2 < L - 1.6 - gw / 2) { parts.splice(0, 2, ...[[0, Math.min(g, g2) - gw / 2], [Math.min(g, g2) + gw / 2, Math.max(g, g2) - gw / 2], [Math.max(g, g2) + gw / 2, L]]); gaps.push(horiz ? { x: ax + g2, z: az } : { x: ax, z: az + g2 }); } }
    gaps.push(horiz ? { x: ax + g, z: az } : { x: ax, z: az + g });
    parts.forEach(([s, e]) => { if (e - s < .3) return; if (horiz) { world.box(e - s, 3.6, T, wm, ax + (s + e) / 2, 1.8, az, true, true, true); pieces.push({ ax: ax + s, az, bx: ax + e, bz: az, horiz }); } else { world.box(T, 3.6, e - s, wm, ax, 1.8, az + (s + e) / 2, true, true, true); pieces.push({ ax, az: az + s, bx: ax, bz: az + e, horiz }); } });
  };
  for (let i = 1; i < cols; i++) for (let j = 0; j < rows; j++) { if ((j === 0 || j === rows - 1) && Math.abs(xs[i]) < 3.5) continue; if (rng() < .2) continue; wallLine(xs[i], zs[j], xs[i], zs[j + 1]); }
  for (let j = 1; j < rows; j++) for (let i = 0; i < cols; i++) { if (rng() < .2) continue; wallLine(xs[i], zs[j], xs[i + 1], zs[j]); }

  // the jail: a cage in a wing away from the start
  const cells = []; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2; if (j === rows - 1 && Math.abs(cx) < W / cols) continue; if (j === 0 && Math.abs(cx) < W / cols) continue; cells.push({ cx, cz }); }
  const jc = cells[Math.floor(rng() * cells.length)], JS = 4.4;
  const bar = toon(0x6b6478), frame = toon(0x3a3444);
  for (const [sx, sz, horiz] of [[0, -JS / 2, 1], [0, JS / 2, 1], [-JS / 2, 0, 0], [JS / 2, 0, 0]]) {
    for (let k = -JS / 2; k <= JS / 2 + .01; k += .32) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.6, 6), bar); b.position.set(jc.cx + (horiz ? k : sx), 1.3, jc.cz + (horiz ? sz : k)); b.castShadow = true; world.root.add(b); }
    const f = new THREE.Mesh(new THREE.BoxGeometry(horiz ? JS + .1 : .14, .14, horiz ? .14 : JS + .1), frame); f.position.set(jc.cx + sx, 2.6, jc.cz + sz); world.root.add(f);
    world.solid(jc.cx + sx - (horiz ? JS / 2 : .09), jc.cx + sx + (horiz ? JS / 2 : .09), jc.cz + sz - (horiz ? .09 : JS / 2), jc.cz + sz + (horiz ? .09 : JS / 2), true);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(JS, .08, JS), frame); roof.position.set(jc.cx, 2.65, jc.cz); world.root.add(roof);
  const lockG = new THREE.Group(); lockG.position.set(jc.cx + .9, 1.1, jc.cz + JS / 2 + .12); world.root.add(lockG);
  const lockBox = new THREE.Mesh(new THREE.BoxGeometry(.4, .5, .14), toon(P.brass)); outline(lockBox, .02); lockG.add(lockBox);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(.12, .035, 6, 14, Math.PI), toon(0x9d99ab)); shackle.position.y = .25; lockG.add(shackle);
  tag(lockG, 'jail');
  const bulbM = new THREE.MeshBasicMaterial({ color: 0xff2233 }); const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), bulbM); bulb.position.set(jc.cx, 2.85, jc.cz); world.root.add(bulb);
  const jl = new THREE.PointLight(0xff2233, 5, 8, 1.6); jl.position.set(jc.cx, 2.5, jc.cz); world.root.add(jl);
  A.jail = { x: jc.cx, z: jc.cz, spots: [-1.2, 0, 1.2].flatMap(a => [-1.2, 0, 1.2].map(b => ({ x: jc.cx + a, z: jc.cz + b }))), out: { x: jc.cx, z: jc.cz + JS / 2 + 1.2 }, light: jl, bulbM };

  // wall slots for wall props: outer walls and both faces of every interior piece
  const slots = [];
  const nearGap = (x, z, r) => gaps.some(g => Math.hypot(g.x - x, g.z - z) < r);
  const nearJail = (x, z, r) => Math.abs(x - jc.cx) < JS / 2 + r && Math.abs(z - jc.cz) < JS / 2 + r;
  const run = (ax, az, bx, bz, nx, nz, avoid) => { const L = Math.hypot(bx - ax, bz - az); for (let t = 1.2; t < L - 1; t += 2.4) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L; if (avoid && avoid(x, z)) continue; if (nearGap(x, z, 2.2) || nearJail(x, z, 1.4)) continue; if (xs.slice(1, -1).some(v => Math.abs(x - v) < .9 && Math.abs(nz) > .5) || zs.slice(1, -1).some(v => Math.abs(z - v) < .9 && Math.abs(nx) > .5)) continue; slots.push({ x, z, nx, nz }); } };
  run(-W / 2, -D / 2, W / 2, -D / 2, 0, 1, x => Math.abs(x) < 2.6);
  run(-W / 2, D / 2, W / 2, D / 2, 0, -1, x => Math.abs(x) < 3.4);
  run(-W / 2, -D / 2, -W / 2, D / 2, 1, 0); run(W / 2, -D / 2, W / 2, D / 2, -1, 0);
  pieces.forEach(p => { if (p.horiz) { run(p.ax, p.az - T / 2, p.bx, p.bz - T / 2, 0, -1); run(p.ax, p.az + T / 2, p.bx, p.bz + T / 2, 0, 1); } else { run(p.ax - T / 2, p.az, p.bx - T / 2, p.bz, -1, 0); run(p.ax + T / 2, p.az, p.bx + T / 2, p.bz, 1, 0); } });
  shuffle(slots, rng);
  let safePlaced = false;
  slots.slice(0, Math.round(slots.length * .72)).forEach((s, i) => {
    let type = WALL_TYPES[Math.floor(rng() * WALL_TYPES.length)];
    if (!safePlaced && i === 5) { type = 'safe'; safePlaced = true; }
    const pr = placeProp(world, A, type, rng, s.x, s.z, Math.atan2(s.nx, s.nz), true, [s.nx, s.nz]);
    if (type === 'safe') A.safePid = pr.pid;
  });
  // floor props on a jittered grid
  const blockedSpot = (x, z) => (Math.abs(x) < 3.4 && z > D / 2 - 4.4) || (Math.abs(x) < 3.4 && z < -D / 2 + 3.4) || pieces.some(p => segDist(x, z, p) < 1.9) || nearGap(x, z, 2.6) || nearJail(x, z, 2.4);
  for (let x = -W / 2 + 2.7; x <= W / 2 - 2.7; x += 3.7) for (let z = -D / 2 + 2.7; z <= D / 2 - 2.7; z += 3.7) {
    const px = x + (rng() - .5) * .7, pz = z + (rng() - .5) * .7; if (blockedSpot(px, pz) || rng() < .22) continue;
    placeProp(world, A, FLOOR_TYPES[Math.floor(rng() * FLOOR_TYPES.length)], rng, px, pz, Math.floor(rng() * 4) * Math.PI / 2);
  }
  for (let i = 0; i < 6; i++) { const rug = new THREE.Mesh(new THREE.PlaneGeometry(3 + rng() * 2, 2 + rng() * 1.5), toon([P.red, P.purple, P.teal][i % 3])); rug.rotation.x = -Math.PI / 2; rug.position.set((rng() - .5) * (W - 6), .012, (rng() - .5) * (D - 6)); rug.receiveShadow = true; world.root.add(rug); }

  // hide things
  const searchables = [...A.props.values()].filter(p => p.pid !== A.safePid).map(p => p.pid); shuffle(searchables, rng);
  A.need = Math.min(n + 3 + (cfg.level - 1), 12);
  const contents = {}; let k = 0;
  for (let i = 0; i < A.need - 1; i++) contents[searchables[k++]] = 'key';
  contents[searchables[k++]] = 'note';
  for (let i = 0; i < d.fakes + Math.floor((cfg.level - 1) / 2); i++) if (k < searchables.length) contents[searchables[k++]] = 'fake';
  for (; k < searchables.length; k++) if (rng() < d.trap) contents[searchables[k]] = 'trap';
  A.contents = contents;
  A.code = Array.from({ length: d.digits }, () => Math.floor(rng() * 10)).join('');
  tag(room.door, 'door');

  // sentries
  A.nav = buildNav(world.solids, W, D); A.nav.walls = world.solids.filter(s => s.wall);
  A.sentryCount = Math.min(d.sentries + Math.floor(n / 2) + (cfg.level - 1), 14);
  const sStart = []; for (let i = 0; i < A.sentryCount; i++) { let p; for (let t = 0; t < 200; t++) { p = A.nav.randomFree(rng); if (Math.hypot(p.x, p.z - D / 2) > 14 && !nearJail(p.x, p.z, 2)) break; } sStart.push(p); }
  const brains = []; const srng = mulberry(cfg.seed ^ 0x5eed);

  A.init = S => { S.found = 0; S.need = A.need; S.opened = {}; S.door = false; S.safeOpen = false; S.safeTries = 0; S.noteBy = null; S.jailed = {}; S.freedAt = 0; S.caught = []; S.sentries = sStart.map(p => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), f: 0, st: 'patrol' })); };
  A.info = (pid, S) => {
    if (pid === 'door') return S.door ? null : S.found >= S.need ? { label: 'Unlock the door', hold: false } : { label: `Locked · ${S.need - S.found} more key${S.need - S.found === 1 ? '' : 's'}`, hold: false, locked: true };
    if (pid === 'jail') { const k = Object.keys(S.jailed).length; return k ? { label: `Pick the jail lock (${k} inside)`, hold: true, holdTime: d.pick } : { label: 'The jail is empty', done: true }; }
    if (pid === A.safePid) return S.safeOpen ? { label: 'Empty safe', done: true } : { label: `Enter safe code (${A.code.length} digits)`, hold: false, safe: true };
    const pr = A.props.get(pid); if (!pr) return null;
    if (S.opened[pid]) return { label: 'Already searched', done: true };
    return { label: pr.label, hold: true };
  };
  A.request = (S, from, e, ctx) => {
    if (S.jailed[from] && e.type !== 'free') return;
    if (e.type === 'search') { if (S.opened[e.pid] || !A.props.has(e.pid) || e.pid === A.safePid) return; const c = A.contents[e.pid] || 'empty'; S.opened[e.pid] = { c, by: from }; if (c === 'key') S.found++; if (c === 'note') S.noteBy = from; }
    else if (e.type === 'door') { if (S.found >= S.need && !S.door) S.door = true; }
    else if (e.type === 'safe') { if (S.safeOpen) return; if (String(e.code) === A.code) { S.safeOpen = true; S.found++; S.opened[A.safePid] = { c: 'key', by: from }; } else S.safeTries++; }
    else if (e.type === 'free') { if (!S.jailed[from] && Object.keys(S.jailed).length) { S.jailed = {}; S.freedAt = ctx.now; S.freedBy = from; } }
  };
  A.hostUpdate = (dt, S, ctx) => {
    const ps = ctx.players.map(p => Object.assign({}, p, { jailed: !!S.jailed[p.id] }));
    const caught = stepSentries(S, brains, A.nav, ps, ctx.now, dt, { speed: d.sSpeed, sense: d.sense, beam: d.beam, grace: 8000 }, srng, cfg.startAt);
    caught.forEach(c => { S.jailed[c.id] = true; S.caught = (S.caught || []).slice(-6).concat([{ id: c.id, by: c.by, at: ctx.now }]); });
  };
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
    const k = Object.keys(S.jailed || {}).length; A.jail.light.intensity = (k ? 7 : 3) * (.8 + Math.sin(ctx.now / 180) * .2); shackle.rotation.z = 0;
  };
  A.objective = S => S.door ? 'The door is open. Everyone into the exit!' : S.found >= S.need ? 'All keys found. Unlock the door in the north wall!' : `Find ${S.need} keys in the dark. One is in the safe; its code is on a note. Sentries hunt flashlights.`;
  A.progress = S => `Keys ${S.found}/${S.need}`;
  A.exitOpen = S => S.door;
  A.ground = (p, prev) => p.y <= 0 ? { top: 0 } : null;
  return A;
}

/* =================================================================== ROOM 2: THE GRINDER (platform course over lava) */
function lavaDraw(x, s, rng) { x.fillStyle = '#1a0503'; x.fillRect(0, 0, s, s); for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(${200 + rng() * 55},${40 + rng() * 60},10,${.4 + rng() * .4})`; x.lineWidth = 2 + rng() * 5; x.beginPath(); let px = rng() * s, py = rng() * s; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (rng() - .5) * 60; py += (rng() - .5) * 60; x.lineTo(px, py); } x.stroke(); } }
function buildGrinder(world, cfg) {
  const rng = mulberry(cfg.seed), d = DIFF[cfg.diff], n = cfg.n;
  const mul = d.cMul * (1 + .06 * (cfg.level - 1));
  const W = 30 + 2 * (n - 1);
  const segs = Math.min(d.course + 3 * (cfg.level - 1), 40);
  // lay out the course from south (start) to north (goal), in local coordinates first
  const plats = []; const add = o => { plats.push(o); return o; };
  let prev = add({ type: 'start', x: 0, y: 2, z: 0, w: 7, d: 7 });
  const types = ['static', 'static', 'narrow', 'move', 'lift', 'static', 'move', 'spinner'].concat(d.blink ? ['blink', 'blink'] : []);
  for (let k = 0; k < segs; k++) {
    let type = (k + 1) % 6 === 0 ? 'check' : types[Math.floor(rng() * types.length)];
    if (k < 2 && type !== 'check') type = 'static';
    const size = { static: [2.6 + rng() * 1.6, 2.6 + rng() * 1.6], narrow: [.75, 4.5 + rng() * 2], move: [2.6, 2.6], lift: [2.8, 2.8], blink: [2.6, 2.6], spinner: [7, 7], check: [5, 5] }[type];
    const top = prev.lift ? prev.y + prev.lift : prev.y;
    let dy = (rng() - .45) * 1.6; if (type === 'lift' || type === 'spinner' || type === 'check') dy = Math.min(dy, .2);
    const y = clamp(top + dy, 1.6, 9);
    const rise = Math.max(0, y - top);
    const gapMax = clamp(3.3 - rise * 1.6, 1.3, 3.3), gap = 1.2 + rng() * (gapMax - 1.2) * Math.min(1, .55 + .3 * mul);
    let x = clamp(prev.x + (rng() - .5) * 7, -W / 2 + 4 + size[0] / 2, W / 2 - 4 - size[0] / 2);
    // keep the next edge within jumping reach sideways too
    const side = Math.max(0, Math.abs(x - prev.x) - (prev.w + size[0]) / 2); if (side > .2) x = prev.x + Math.sign(x - prev.x) * ((prev.w + size[0]) / 2 - .4);
    const z = prev.z - prev.d / 2 - gap - size[1] / 2;
    const p = add({ type, x, y, z, w: size[0], d: size[1] });
    if (type === 'move') { p.ax = 2.5 + rng() * 2; p.sp = (.6 + rng() * .3) * mul; p.ph = rng() * 6; p.x = clamp(p.x, -W / 2 + 4 + p.ax, W / 2 - 4 - p.ax); }
    if (type === 'lift') { p.lift = 1.6 + rng() * .6; p.sp = (.7 + rng() * .3) * mul; p.ph = rng() * 6; }
    if (type === 'blink') { p.on = 2.6 / mul + 1; p.off = 1.1; p.ph = rng() * 4; }
    if (type === 'spinner') { p.ws = (1 + rng() * .4) * mul * (rng() < .5 ? 1 : -1); p.ph = rng() * 6; }
    prev = p;
  }
  const goal = add({ type: 'goal', x: clamp(prev.x, -W / 2 + 6, W / 2 - 6), y: prev.lift ? prev.y + prev.lift * .5 : prev.y, z: prev.z - prev.d / 2 - 2 - 4, w: 8, d: 8 });
  const len = -goal.z + 4 + 3.5, D = len + 8;
  const shift = D / 2 - 6; plats.forEach(p => p.z += shift);
  const room = world.room(W, D, { floor: world.tex(lavaDraw, W / 5, D / 5, rng), wall: TEX.brick, height: 14 });
  room.floorMesh.material.emissive = new THREE.Color(0xff3a10); room.floorMesh.material.emissiveMap = room.floorMesh.material.map; room.floorMesh.material.emissiveIntensity = .55;
  const A = { name: AREA_NAMES[1], W, D, room, props: new Map(), kind: 'grinder', plats };
  A.spawn = spawns(D, n, plats[0].y, plats[0].z + 1.5).map(s => Object.assign(s, { x: s.x * .9 }));
  room.exitZone = { x0: goal.x - goal.w / 2, x1: goal.x + goal.w / 2, z0: goal.z - goal.d / 2, z1: goal.z + goal.d / 2, y0: goal.y - .6 };

  const metal = new THREE.MeshToonMaterial({ map: world.tex(TEX.metal, 1, 1) });
  const trimCol = { start: 0x7dffc4, goal: 0xffc94d, check: 0x7dffc4, static: 0x4dd6ff, narrow: 0x4dd6ff, move: 0xc38bff, lift: 0xff9a3c, blink: 0xff4d5e, spinner: 0x4dd6ff };
  const hazM = new THREE.MeshToonMaterial({ map: world.tex(TEX.hazard, 2, 1) });
  plats.forEach(p => {
    const g = new THREE.Group(); world.root.add(g); p.g = g;
    const thick = p.type === 'narrow' ? .3 : .5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(p.w, thick, p.d), p.type === 'blink' ? new THREE.MeshToonMaterial({ map: metal.map, color: 0xffb0b0, transparent: true }) : metal); b.position.y = -thick / 2; b.castShadow = b.receiveShadow = true; outline(b, .03); g.add(b); p.mesh = b;
    const tm = new THREE.MeshBasicMaterial({ color: trimCol[p.type], transparent: true, opacity: .55 }); p.trim = tm;
    [[p.w, .05, .06, 0, -p.d / 2], [p.w, .05, .06, 0, p.d / 2], [.06, .05, p.d, -p.w / 2, 0], [.06, .05, p.d, p.w / 2, 0]].forEach(([w, h, dd, x, z]) => { const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), tm); t.position.set(x, .01, z); g.add(t); });
    if (p.type === 'goal') { const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .75), new THREE.MeshBasicMaterial({ map: world.signTex('EXIT', '#ffc94d'), transparent: true })); s.position.set(0, 2.2, -p.d / 2 + .2); g.add(s); const L = new THREE.PointLight(0xffc94d, 6, 10, 1.5); L.position.y = 2; g.add(L); }
    if (p.type === 'check') { const L = new THREE.PointLight(0x7dffc4, 2.5, 7, 1.6); L.position.y = 1.5; g.add(L); }
    if (p.type === 'spinner') {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .7, 10), toon(0x9d99ab)); post.position.y = .35; g.add(post);
      const pv = new THREE.Group(); pv.position.y = .4; g.add(pv); p.pv = pv; p.L = p.w / 2 - .2;
      const barM = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, p.L * 2, 10), hazM); barM.rotation.z = Math.PI / 2; outline(barM, .02); pv.add(barM);
    }
  });
  const posAt = (p, t) => {
    let x = p.x, y = p.y, z = p.z;
    if (p.type === 'move') x = p.x + Math.sin(p.ph + t * p.sp) * p.ax;
    if (p.type === 'lift') y = p.y + (Math.sin(p.ph + t * p.sp) * .5 + .5) * p.lift;
    return { x, y, z };
  };
  const solidAt = (p, t) => { if (p.type !== 'blink') return true; const c = p.on + p.off, f = ((t + p.ph) % c + c) % c; return f < p.on; };
  plats.forEach(p => { p.pos = t => posAt(p, t); });
  A.checkpoints = plats.filter(p => p.type === 'check' || p.type === 'start');

  A.init = S => { S.door = true; };
  A.info = () => null; A.request = () => { }; A.hostUpdate = () => { };
  A.ground = (pl, prevFeet, t) => {
    let best = null;
    for (const p of plats) {
      if (!solidAt(p, t)) continue; const q = posAt(p, t);
      if (Math.abs(pl.x - q.x) > p.w / 2 + .12 || Math.abs(pl.z - q.z) > p.d / 2 + .12) continue;
      if (prevFeet >= q.y - .35 && pl.y <= q.y + .02 && (!best || q.y > best.top)) best = { top: q.y, plat: p };
    }
    return best;
  };
  A.fallY = -.2;
  A.render = (dt, S, ctx) => {
    const t = (ctx.now - cfg.startAt) / 1000;
    plats.forEach(p => {
      const q = posAt(p, t); p.g.position.set(q.x, q.y, q.z);
      if (p.type === 'blink') { const c = p.on + p.off, f = ((t + p.ph) % c + c) % c; const on = f < p.on, warn = on && f > p.on - .9; p.mesh.material.opacity = on ? (warn ? .4 + .4 * Math.abs(Math.sin(t * 18)) : 1) : .08; p.trim.opacity = on ? .7 : .15; }
      if (p.pv) p.pv.rotation.y = p.ph + p.ws * t;
    });
    const me = ctx.me; if (!me || me.eaten || ctx.phase !== 'play') return;
    if (me.ground && me.plat && (me.plat.type === 'check' || me.plat.type === 'goal') && me.ck.plat !== me.plat) { const q = posAt(me.plat, t); me.ck = { x: q.x, z: q.z, y: q.y, plat: me.plat }; if (me.plat.type === 'check') ctx.fx('checkpoint'); }
    // spinner bars knock you off
    if (me.inv <= 0) for (const p of plats) { if (!p.pv) continue; const a = p.ph + p.ws * t, cx = Math.cos(a), cz = -Math.sin(a); const s = clamp((me.x - p.x) * cx + (me.z - p.z) * cz, -p.L, p.L); if (Math.hypot(me.x - (p.x + s * cx), me.z - (p.z + s * cz)) < .45 && me.y < p.y + .55 && me.y > p.y - .3) { ctx.fx('smack'); break; } }
    if (me.y < A.fallY) ctx.fx('fell');
  };
  A.objective = () => 'Jump across the platforms to the gold exit. Fall in the lava and you go back to your last green checkpoint.';
  A.progress = (S, ctx) => ctx.exitText();
  A.exitOpen = () => true;
  return A;
}

export const BUILDERS = [buildStudy, buildGrinder];
