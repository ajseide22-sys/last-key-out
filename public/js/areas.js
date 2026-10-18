// The manor. Every client builds the same layout from cfg.seed; the host runs the rules.
// Shared state S is owned by the host and mirrored to everyone in snapshots.
import * as THREE from 'three';
import { PROPS, WALL_TYPES, FLOOR_TYPES, makeKey, toon, P } from './props.js';
import { mulberry, shuffle, clamp, TEX } from './world.js';
import { buildNav, stepSentries } from './sentry.js';
import { STATIONS, placeScrawl, clueText } from './puzzles.js';

export const CFG = { search: .7, pick: 2.5, sSpeed: 3.1, sense: 9, beam: 18, grace: 8000 };
export const AREA_NAME = 'The Manor';
const CREEPY = ['HELP ME', "DON'T TURN AROUND", 'IT SEES THE LIGHT', 'LIGHTS OFF', 'NO WAY OUT', 'THEY HEAR YOU', 'BEHIND YOU', 'STAY TOGETHER'];

function placeProp(world, A, type, rng, x, z, rotY, searchable = true, wallN) {
  const pr = PROPS[type](rng);
  if (wallN) { const dd = pr.d / 2 + .02; x += wallN[0] * dd; z += wallN[1] * dd; }
  pr.g.position.set(x, 0, z); pr.g.rotation.y = rotY; world.root.add(pr.g);
  const odd = Math.round(rotY / (Math.PI / 2)) % 2 !== 0;
  if (!pr.wallHung) { const hx = (odd ? pr.d : pr.w) / 2 + .03, hz = (odd ? pr.w : pr.d) / 2 + .03; world.solid(x - hx, x + hx, z - hz, z + hz); }
  if (pr.tick) world.tickers.push({ tick: pr.tick });
  if (!searchable) return pr;
  const pid = 'q' + A.props.size; pr.pid = pid; pr.x = x; pr.z = z; pr.type = type;
  pr.g.traverse(o => { if (o.isMesh) o.userData.pid = pid; });
  A.props.set(pid, pr); return pr;
}
function spawns(D, n) { const a = []; for (let i = 0; i < n; i++) { const r = Math.floor(i / 4), c = i % 4; a.push({ x: (c - (Math.min(n - r * 4, 4) - 1) / 2) * 1.3, z: D / 2 - 1.5 - r * 1.3, y: 0 }); } return a; }
function tag(mesh, pid) { mesh.traverse(o => { if (o.isMesh) o.userData.pid = pid; }); }
const segDist = (px, pz, a) => { const dx = a.bx - a.ax, dz = a.bz - a.az, L2 = dx * dx + dz * dz || 1; const t = clamp(((px - a.ax) * dx + (pz - a.az) * dz) / L2, 0, 1); return Math.hypot(px - (a.ax + dx * t), pz - (a.az + dz * t)); };

export function buildManor(world, cfg) {
  const rng = mulberry(cfg.seed), n = cfg.n;
  const W = Math.min(48 + 6 * (n - 1), 84), D = Math.min(36 + 4 * (n - 1), 62);
  const theme = [['#4a2232', '#3a1a28', 26], ['#223a4a', '#1a2e3a', 30], ['#2e3a22', '#24301a', 22]][cfg.round % 3];
  const cols = Math.max(3, Math.round(W / 12)), rows = Math.max(3, Math.round(D / 10)), T = .3, gw = 2.4;
  const xs = Array.from({ length: cols + 1 }, (_, i) => -W / 2 + i * W / cols), zs = Array.from({ length: rows + 1 }, (_, j) => -D / 2 + j * D / rows);
  // the secret chamber hides behind the east or west wall, in the middle of a row (never where an inner wall meets it), away from the start
  const side = rng() < .5 ? -1 : 1, sj = Math.floor(rng() * Math.max(1, rows - 1)), sz = (zs[sj] + zs[sj + 1]) / 2;
  const room = world.manor(W, D, { floor: world.tex(TEX.wood(theme[2]), W / 4, D / 4, rng), wall: TEX.wallpaper(theme[0], theme[1]), height: 3.6, side, sz });
  const A = { name: AREA_NAME, W, D, room, props: new Map(), spawn: spawns(D, n) };
  const wm = new THREE.MeshToonMaterial({ map: world.tex(TEX.wallpaper(theme[0], theme[1]), 2, 1) });

  // wings joined by doorways
  const pieces = [], gaps = [];
  const wallLine = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), horiz = az === bz; const g = 1.6 + gw / 2 + rng() * (L - 3.2 - gw);
    let parts = [[0, g - gw / 2], [g + gw / 2, L]];
    if (L > 9 && rng() < .5) { const g2 = g < L / 2 ? g + L / 2.2 : g - L / 2.2; if (g2 > 1.6 + gw / 2 && g2 < L - 1.6 - gw / 2) { parts = [[0, Math.min(g, g2) - gw / 2], [Math.min(g, g2) + gw / 2, Math.max(g, g2) - gw / 2], [Math.max(g, g2) + gw / 2, L]]; gaps.push(horiz ? { x: ax + g2, z: az } : { x: ax, z: az + g2 }); } }
    gaps.push(horiz ? { x: ax + g, z: az } : { x: ax, z: az + g });
    parts.forEach(([s, e]) => { if (e - s < .3) return; if (horiz) { world.box(e - s, 3.6, T, wm, ax + (s + e) / 2, 1.8, az, true, false, true); pieces.push({ ax: ax + s, az, bx: ax + e, bz: az, horiz }); } else { world.box(T, 3.6, e - s, wm, ax, 1.8, az + (s + e) / 2, true, false, true); pieces.push({ ax, az: az + s, bx: ax, bz: az + e, horiz }); } });
  };
  for (let i = 1; i < cols; i++) for (let j = 0; j < rows; j++) { if ((j === 0 || j === rows - 1) && Math.abs(xs[i]) < 3.5) continue; if (rng() < .2) continue; wallLine(xs[i], zs[j], xs[i], zs[j + 1]); }
  for (let j = 1; j < rows; j++) for (let i = 0; i < cols; i++) { if (rng() < .2) continue; wallLine(xs[i], zs[j], xs[i + 1], zs[j]); }

  // cells for the jail and puzzle stations
  const cells = []; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2; cells.push({ i, j, cx, cz, start: j === rows - 1 && Math.abs(cx) < W / cols }); }
  const usable = cells.filter(c => !c.start);
  const jc = usable[Math.floor(rng() * usable.length)], JS = 4.4;
  const far = (list, k, avoid) => { const out = []; const pool = list.filter(c => c !== jc); while (out.length < k && pool.length) { let best = null, bd = -1; for (const c of pool) { const d = Math.min(...out.concat(avoid).map(o => Math.hypot(o.cx - c.cx, o.cz - c.cz)), 1e9) + rng() * 3; if (d > bd) { bd = d; best = c; } } out.push(best); pool.splice(pool.indexOf(best), 1); } return out; };
  const stCells = far(usable, STATIONS.length, [{ cx: 0, cz: D / 2 }, jc]);

  // the jail cage
  const bar = toon(0x6b6478), frame = toon(0x3a3444);
  for (const [sx, sz2, horiz] of [[0, -JS / 2, 1], [0, JS / 2, 1], [-JS / 2, 0, 0], [JS / 2, 0, 0]]) {
    for (let k = -JS / 2; k <= JS / 2 + .01; k += .32) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.6, 6), bar); b.position.set(jc.cx + (horiz ? k : sx), 1.3, jc.cz + (horiz ? sz2 : k)); b.castShadow = true; world.root.add(b); }
    const f = new THREE.Mesh(new THREE.BoxGeometry(horiz ? JS + .1 : .14, .14, horiz ? .14 : JS + .1), frame); f.position.set(jc.cx + sx, 2.6, jc.cz + sz2); world.root.add(f);
    world.solid(jc.cx + sx - (horiz ? JS / 2 : .09), jc.cx + sx + (horiz ? JS / 2 : .09), jc.cz + sz2 - (horiz ? .09 : JS / 2), jc.cz + sz2 + (horiz ? .09 : JS / 2), true);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(JS, .08, JS), frame); roof.position.set(jc.cx, 2.65, jc.cz); world.root.add(roof);
  const lockG = new THREE.Group(); lockG.position.set(jc.cx + .9, 1.1, jc.cz + JS / 2 + .12); world.root.add(lockG);
  lockG.add(new THREE.Mesh(new THREE.BoxGeometry(.4, .5, .14), toon(P.brass)));
  tag(lockG, 'jail');
  const jl = new THREE.PointLight(0xff2233, 4, 8, 1.6); jl.position.set(jc.cx, 2.5, jc.cz); world.root.add(jl);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2233 })); bulb.position.set(jc.cx, 2.85, jc.cz); world.root.add(bulb);
  A.jail = { x: jc.cx, z: jc.cz, spots: [-1.2, 0, 1.2].flatMap(a => [-1.2, 0, 1.2].map(b => ({ x: jc.cx + a, z: jc.cz + b }))), out: { x: jc.cx, z: jc.cz + JS / 2 + 1.2 }, light: jl };
  const nearJail = (x, z, r) => Math.abs(x - jc.cx) < JS / 2 + r && Math.abs(z - jc.cz) < JS / 2 + r;
  const nearSecret = (x, z, r) => Math.hypot(x - room.secret.x, z - room.secret.z) < r;

  // puzzle stations
  A.stations = stCells.map((c, k) => { const ry = Math.floor(rng() * 4) * Math.PI / 2; return STATIONS[k](world, c.cx + (rng() - .5) * 1.5, c.cz + (rng() - .5) * 1.2, ry, rng); });
  const nearStation = (x, z, r) => A.stations.some(s => Math.hypot(s.x - x, s.z - z) < r);

  // wall slots
  const slots = [];
  const nearGap = (x, z, r) => gaps.some(g => Math.hypot(g.x - x, g.z - z) < r);
  const run = (ax, az, bx, bz, nx, nz, avoid) => { const L = Math.hypot(bx - ax, bz - az); for (let t = 1.2; t < L - 1; t += 2.4) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L; if (avoid && avoid(x, z)) continue; if (nearGap(x, z, 2.2) || nearJail(x, z, 1.4) || nearSecret(x, z, 2.6) || nearStation(x, z, 2.4)) continue; if (xs.slice(1, -1).some(v => Math.abs(x - v) < .9 && Math.abs(nz) > .5) || zs.slice(1, -1).some(v => Math.abs(z - v) < .9 && Math.abs(nx) > .5)) continue; slots.push({ x, z, nx, nz }); } };
  run(-W / 2, -D / 2, W / 2, -D / 2, 0, 1); run(-W / 2, D / 2, W / 2, D / 2, 0, -1, x => Math.abs(x) < 3.4);
  run(-W / 2, -D / 2, -W / 2, D / 2, 1, 0); run(W / 2, -D / 2, W / 2, D / 2, -1, 0);
  pieces.forEach(p => { if (p.horiz) { run(p.ax, p.az - T / 2, p.bx, p.bz - T / 2, 0, -1); run(p.ax, p.az + T / 2, p.bx, p.bz + T / 2, 0, 1); } else { run(p.ax - T / 2, p.az, p.bx - T / 2, p.bz, -1, 0); run(p.ax + T / 2, p.az, p.bx + T / 2, p.bz, 1, 0); } });
  shuffle(slots, rng);
  const take = (pred) => { const i = slots.findIndex(pred); return i < 0 ? null : slots.splice(i, 1)[0]; };

  // safes, spread out
  const safeN = Math.min(5 + Math.floor((n - 1) / 2), 8); A.safes = [];
  for (let k = 0; k < safeN; k++) { const s = take(s => A.safes.every(o => Math.hypot(o.x - s.x, o.z - s.z) > 9) && Math.hypot(s.x, s.z - D / 2) > 8) || take(() => true); if (!s) break; const pr = placeProp(world, A, 'safe', rng, s.x, s.z, Math.atan2(s.nx, s.nz), true, [s.nx, s.nz]); pr.isSafe = true; A.safes.push(pr); }
  // writing on the walls: puzzle clues, two of the escape digits, and some nastier messages
  A.code = Array.from({ length: 4 }, () => Math.floor(rng() * 10)).join('');
  const digitPos = shuffle([0, 1, 2, 3], rng); A.wallDigits = digitPos.slice(0, 2); A.safeDigits = digitPos.slice(2);
  const clues = A.stations.filter(s => s.clue).map(s => s.clue).concat(A.wallDigits.map(pos => ({ type: 'digit', pos, digit: +A.code[pos] })));
  for (let k = 0; k < 4; k++) clues.push({ type: 'text', text: CREEPY[Math.floor(rng() * CREEPY.length)] });
  A.scrawls = [];
  clues.forEach((c, k) => { const s = take(s => A.scrawls.every(o => Math.hypot(o.x - s.x, o.z - s.z) > 7)) || take(() => true); if (!s) return; const pid = 'scrawl:' + k; placeScrawl(world, s.x + s.nx * .03, s.z + s.nz * .03, Math.atan2(s.nx, s.nz), c, pid); A.scrawls.push({ x: s.x, z: s.z, clue: c, pid }); });
  // other wall furniture
  const used = Math.round(slots.length * .6);
  slots.slice(0, used).forEach(s => placeProp(world, A, WALL_TYPES[Math.floor(rng() * WALL_TYPES.length)], rng, s.x, s.z, Math.atan2(s.nx, s.nz), true, [s.nx, s.nz]));
  const freeSlots = slots.slice(used);
  // floor furniture
  const blockedSpot = (x, z) => (Math.abs(x) < 3.4 && z > D / 2 - 4.4) || pieces.some(p => segDist(x, z, p) < 1.9) || nearGap(x, z, 2.6) || nearJail(x, z, 2.4) || nearSecret(x, z, 3) || nearStation(x, z, 3.2);
  const BUDGET = 430;
  for (let x = -W / 2 + 2.7; x <= W / 2 - 2.7; x += 4.1) for (let z = -D / 2 + 2.7; z <= D / 2 - 2.7; z += 4.1) {
    const px = x + (rng() - .5) * .7, pz = z + (rng() - .5) * .7; if (blockedSpot(px, pz) || rng() < .25 || A.props.size >= BUDGET) continue;
    placeProp(world, A, FLOOR_TYPES[Math.floor(rng() * FLOOR_TYPES.length)], rng, px, pz, Math.floor(rng() * 4) * Math.PI / 2);
  }
  for (let i = 0; i < 6; i++) { const rug = new THREE.Mesh(new THREE.PlaneGeometry(3 + rng() * 2, 2 + rng() * 1.5), toon([P.red, P.purple, P.teal][i % 3])); rug.rotation.x = -Math.PI / 2; rug.position.set((rng() - .5) * (W - 6), .012, (rng() - .5) * (D - 6)); rug.receiveShadow = true; world.root.add(rug); }

  // what's hidden where
  const searchables = [...A.props.values()].filter(p => !p.isSafe).map(p => p.pid); shuffle(searchables, rng);
  const contents = {}; let k = 0;
  A.hiddenKeys = Math.max(1, A.safes.length - A.stations.length);
  for (let i = 0; i < A.hiddenKeys; i++) contents[searchables[k++]] = { c: 'key' };
  for (let i = 0; i < 3; i++) contents[searchables[k++]] = { c: 'lurker' };
  for (; k < searchables.length; k++) { const r = rng(); contents[searchables[k]] = r < .24 ? { c: 'cash', amt: 5 + Math.floor(rng() * 6) * 5 } : r < .32 ? { c: 'trap' } : { c: 'empty' }; }
  A.contents = contents;
  A.safeLoot = A.safes.map((s, i) => ({ amt: 150 + Math.floor(rng() * 11) * 25, digit: i < 2 ? { pos: A.safeDigits[i], digit: +A.code[A.safeDigits[i]] } : null }));
  shuffle(A.safeLoot, rng);
  A.safeIndex = new Map(A.safes.map((s, i) => [s.pid, i]));
  tag(room.door, 'secret');

  // monsters
  A.nav = buildNav(world.solids, W, D); A.nav.walls = world.solids.filter(s => s.wall);
  A.sentryCount = Math.min(2 + Math.floor(n / 3) + Math.min(cfg.round - 1, 2), 6);
  const sStart = []; for (let i = 0; i < A.sentryCount; i++) { let p; for (let t = 0; t < 200; t++) { p = A.nav.randomFree(rng); if (Math.hypot(p.x, p.z - D / 2) > 14 && !nearJail(p.x, p.z, 2)) break; } sStart.push(p); }
  const KINDS = ['pale', 'crawler', 'hollow'];
  A.lurkers = []; const lurkN = 3 + Math.floor(n / 3);
  for (const s of freeSlots) { if (A.lurkers.length >= lurkN) break; const x = s.x + s.nx * .7, z = s.z + s.nz * .7; if (Math.hypot(x, z - D / 2) < 11 || nearJail(x, z, 3) || nearSecret(x, z, 3) || !A.nav.free(A.nav.idx(x, z)) || A.lurkers.some(l => Math.hypot(l.x - x, l.z - z) < 12)) continue; A.lurkers.push({ x, z, f: Math.atan2(s.nx, s.nz), kind: KINDS[A.lurkers.length % 3] }); }
  const brains = []; const srng = mulberry(cfg.seed ^ 0x5eed);
  const pidMap = new Map(); A.stations.forEach(st => { if (st.kind === 'lever') for (let i = 0; i < 5; i++) pidMap.set('lever:' + i, st); if (st.kind === 'clock') { pidMap.set('clock:face', st); pidMap.set('clock:chime', st); } if (st.kind === 'piano') for (let i = 0; i < 5; i++) pidMap.set('piano:' + i, st); if (st.kind === 'roller') for (let i = 0; i < 3; i++) pidMap.set('roller:' + i, st); });
  const scrawlByPid = new Map(A.scrawls.map(s => [s.pid, s]));

  /* ---------------- rules ---------------- */
  A.init = S => {
    Object.assign(S, { keys: 0, money: {}, opened: {}, safesOpen: {}, solved: {}, pz: {}, clue: {}, door: false, escaped: {}, jailed: {}, caught: [], lurk: {}, drops: [], dropN: 0, alert: null, events: [], evN: 0, freedAt: 0 });
    A.stations.forEach(st => st.init(S));
    S.sentries = sStart.map(p => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), f: 0, st: 'patrol' }));
  };
  const emitter = S => (type, data = {}) => { S.evN++; S.events = S.events.slice(-14).concat([Object.assign({ id: S.evN, type }, data)]); };
  const addClue = (S, id, pos, digit) => { const c = (S.clue[id] || '____').split(''); c[pos] = String(digit); S.clue[id] = c.join(''); };

  A.info = (pid, S) => {
    if (pid === 'secret') return S.door ? null : { label: 'Examine the book that sticks out', combo: true };
    if (pid === 'jail') { const k = Object.keys(S.jailed).length; return k ? { label: `Pick the jail lock (${k} inside)`, hold: true, holdTime: CFG.pick } : { label: 'The jail is empty', done: true }; }
    if (scrawlByPid.has(pid)) return { label: 'Read the writing on the wall' };
    if (pidMap.has(pid)) return pidMap.get(pid).info(pid, S);
    const pr = A.props.get(pid); if (!pr) return null;
    if (pr.isSafe) { if (S.safesOpen[pid]) return { label: 'Empty safe', done: true }; return S.keys > 0 ? { label: `Unlock the safe (uses 1 of ${S.keys} key${S.keys === 1 ? '' : 's'})`, hold: true, holdTime: 1 } : { label: 'Locked safe · needs a key', locked: true }; }
    if (S.opened[pid]) return { label: 'Already searched', done: true };
    return { label: pr.label, hold: true };
  };
  A.request = (S, from, e, ctx) => {
    if (S.escaped[from] !== undefined) return;
    if (S.jailed[from] && e.type !== 'free') return;
    const emit = emitter(S), c2 = Object.assign({}, ctx, { emit, alert: (x, z) => { S.alert = { x, z, at: ctx.now }; } });
    if (e.type === 'search') {
      const pr = A.props.get(e.pid); if (!pr || pr.isSafe || S.opened[e.pid]) return; const c = A.contents[e.pid] || { c: 'empty' };
      S.opened[e.pid] = { c: c.c, by: from };
      if (c.c === 'key') { S.keys++; emit('key', { by: from, x: pr.x, z: pr.z, y: pr.y }); }
      else if (c.c === 'cash') { S.money[from] = (S.money[from] || 0) + c.amt; emit('cash', { by: from, amt: c.amt, x: pr.x, z: pr.z, y: pr.y }); }
      else emit(c.c, { by: from, x: pr.x, z: pr.z, y: pr.y });
    } else if (e.type === 'safe') {
      const pr = A.props.get(e.pid); if (!pr || !pr.isSafe || S.safesOpen[e.pid] || S.keys <= 0) return;
      const loot = A.safeLoot[A.safeIndex.get(e.pid)]; S.keys--; S.safesOpen[e.pid] = { by: from };
      S.money[from] = (S.money[from] || 0) + loot.amt;
      if (loot.digit) addClue(S, from, loot.digit.pos, loot.digit.digit);
      emit('safe', { by: from, amt: loot.amt, digit: loot.digit, x: pr.x, z: pr.z, y: pr.y });
    } else if (e.type === 'read') {
      const s = scrawlByPid.get(e.pid); if (!s) return; if (s.clue.type === 'digit') addClue(S, from, s.clue.pos, s.clue.digit);
    } else if (e.type === 'combo') {
      if (S.door) return; if (String(e.code) === A.code) { S.door = true; emit('door', { by: from }); } else emit('comboWrong', { by: from });
    } else if (e.type === 'free') {
      if (!S.jailed[from] && Object.keys(S.jailed).length) { S.jailed = {}; S.freedAt = ctx.now; S.freedBy = from; emit('freed', { by: from }); }
    } else if (e.pid && pidMap.has(e.pid)) {
      const st = pidMap.get(e.pid); st.request(S, from, Object.assign({}, e, st.parsePid(e.pid)), c2);
    }
  };
  A.hostUpdate = (dt, S, ctx) => {
    const ps = ctx.players.filter(p => S.escaped[p.id] === undefined).map(p => Object.assign({}, p, { jailed: !!S.jailed[p.id] }));
    const alert = S.alert && ctx.now - S.alert.at < 6000 ? S.alert : null;
    const caught = stepSentries(S, brains, A.nav, ps, ctx.now, dt, { speed: CFG.sSpeed, sense: CFG.sense, beam: CFG.beam, grace: CFG.grace, alert }, srng, cfg.startAt);
    const emit = emitter(S);
    caught.forEach(c => { const lost = S.money[c.id] || 0; S.money[c.id] = 0; const cp = ps.find(p => p.id === c.id); if (lost > 0 && cp) { const dp = A.nav.nearestFree(cp.x, cp.z), q = dp >= 0 ? A.nav.center(dp) : cp; S.drops.push({ id: ++S.dropN, x: +q.x.toFixed(2), z: +q.z.toFixed(2), amt: lost, by: c.id }); } S.jailed[c.id] = true; S.caught = (S.caught || []).slice(-6).concat([{ id: c.id, by: c.by, at: ctx.now, lost }]); emit('caught', { by: c.id, lost, s: c.by }); });
    if (ctx.now > cfg.startAt + 3000) A.lurkers.forEach((l, i) => { if (S.lurk[i]) return; const p = ps.find(p => !p.jailed && Math.hypot(p.x - l.x, p.z - l.z) < 2.3); if (p) S.lurk[i] = { by: p.id, at: ctx.now }; });
    // dropped money: walk over a bag to grab it
    if (S.drops.length) for (const p of ps) { if (p.jailed || S.jailed[p.id]) continue; for (let i = S.drops.length - 1; i >= 0; i--) { const d = S.drops[i]; if (Math.hypot(p.x - d.x, p.z - d.z) < 1.1) { S.drops.splice(i, 1); S.money[p.id] = (S.money[p.id] || 0) + d.amt; emit('pickup', { by: p.id, amt: d.amt, from: d.by, x: d.x, z: d.z }); } } }
    // escaping: walk into the chamber once the bookshelf is open
    if (S.door) ps.forEach(p => { if (!p.jailed && inZone(p, room.exitZone)) { S.escaped[p.id] = S.money[p.id] || 0; emit('escaped', { by: p.id, amt: S.escaped[p.id] }); } });
  };
  const inZone = (p, z) => p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1;
  A.inExit = p => inZone(p, room.exitZone);

  const shown = new Set(), shownSafe = new Set(), bags = new Map();
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: .85 }), billMat = new THREE.MeshStandardMaterial({ color: 0x5aa860, roughness: .7, emissive: 0x1a4a20, emissiveIntensity: .35 });
  function makeBag(d) {
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); world.root.add(g);
    const sack = new THREE.Mesh(new THREE.SphereGeometry(.26, 14, 10), bagMat); sack.scale.set(1, .85, 1); sack.position.y = .22; sack.castShadow = true; g.add(sack);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.06, .11, .12, 10), bagMat); neck.position.y = .46; g.add(neck);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(.07, .015, 6, 12), new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: .7, roughness: .3 })); tie.rotation.x = Math.PI / 2; tie.position.y = .44; g.add(tie);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(.22, .22), new THREE.MeshBasicMaterial({ map: dollarTex(), transparent: true, depthWrite: false })); sign.position.set(0, .24, .265); g.add(sign);
    for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.24, .01, .12), billMat); b.position.set(Math.cos(k * 2.1) * (.35 + k * .05), .01 + k * .003, Math.sin(k * 2.1) * (.35 + k * .05)); b.rotation.y = k * 1.3; g.add(b); }
    const glow = new THREE.PointLight(0x7dff9a, .9, 2.4, 2); glow.position.y = .5; g.add(glow); // a faint shimmer so the crew can find it
    return { g, glow };
  }
  let dTex = null; function dollarTex() { if (dTex) return dTex; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#e8d8a0'; x.font = 'bold 50px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 32, 36); dTex = new THREE.CanvasTexture(c); return dTex; }
  A.render = (dt, S, ctx) => {
    for (const pid in S.opened) { if (shown.has(pid)) continue; shown.add(pid); const pr = A.props.get(pid); if (pr) world.anim(.5, pr.open); }
    for (const pid in S.safesOpen) { if (shownSafe.has(pid)) continue; shownSafe.add(pid); const pr = A.props.get(pid); if (pr) world.anim(.8, pr.open); }
    A.stations.forEach(st => st.render(dt, S));
    const live = new Set((S.drops || []).map(d => d.id));
    for (const d of S.drops || []) if (!bags.has(d.id)) bags.set(d.id, makeBag(d));
    for (const [id, b] of bags) { if (!live.has(id)) { world.root.remove(b.g); bags.delete(id); } else { b.glow.intensity = .7 + Math.sin(ctx.now / 300 + id) * .3; b.g.rotation.y += dt * .3; } }
    if (S.door && !room.opened) room.open();
    const jk = Object.keys(S.jailed || {}).length; A.jail.light.intensity = (jk ? 6 : 2.5) * (.8 + Math.sin(ctx.now / 180) * .2);
  };
  A.keyFx = (x, y, z) => { const key = makeKey(); key.position.set(x, y - .2, z); world.root.add(key); world.anim(1.1, t => { key.position.y = y - .2 + t * .9; key.rotation.y = t * 9; key.scale.setScalar(t < .8 ? 1 : 1 - (t - .8) * 5); }, () => world.root.remove(key)); };
  A.scrawlClue = pid => scrawlByPid.get(pid)?.clue;
  A.clueText = clueText;
  A.objective = (S, id) => {
    if (S.door) return 'The secret passage is open. Get to it with your money to escape!';
    const left = A.safes.length - Object.keys(S.safesOpen).length;
    return `Solve puzzles for keys (${S.keys} held), open safes for money (${left} left), and find the four numbers that open the hidden way out.`;
  };
  return A;
}
