// Puzzle stations. Each one, once solved, gives the crew a key. Clues are written on the manor's walls.
// Every station: { kind, x, z, init(S), info(pid, S), request(S, from, e, ctx), render(dt, S), clue }
import * as THREE from 'three';
import { toon, P } from './props.js';

const stdM = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .6, metalness: .1 }, o));
function M(geo, mat, x, y, z, p, pid) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = m.receiveShadow = true; if (pid) m.userData.pid = pid; p.add(m); return m; }
function station(world, x, z, ry) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.root.add(g); return g; }
// Collision box for a station footprint (w along local x, d along local z)
function block(world, x, z, ry, w, d) { const odd = Math.round(ry / (Math.PI / 2)) % 2 !== 0; const hx = (odd ? d : w) / 2, hz = (odd ? w : d) / 2; world.solid(x - hx, x + hx, z - hz, z + hz); }
const solveKey = (S, ctx, kind, st, by) => { S.keys++; S.solved[kind] = true; ctx.emit('solve', { kind, x: st.x, z: st.z, by }); };

/* ---------------- symbols (used by the symbol box and its clue) ---------------- */
export const SYMBOLS = ['sun', 'moon', 'star', 'eye', 'skull', 'hand'];
export function drawSymbol(x, kind, cx, cy, s, color) {
  x.save(); x.strokeStyle = color; x.fillStyle = color; x.lineWidth = s * .09; x.lineCap = x.lineJoin = 'round'; x.beginPath();
  if (kind === 'sun') { x.arc(cx, cy, s * .22, 0, 7); x.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(cx + Math.cos(a) * s * .32, cy + Math.sin(a) * s * .32); x.lineTo(cx + Math.cos(a) * s * .45, cy + Math.sin(a) * s * .45); x.stroke(); } }
  else if (kind === 'moon') { x.arc(cx, cy, s * .38, Math.PI * .3, Math.PI * 1.7); x.arc(cx + s * .18, cy, s * .28, Math.PI * 1.6, Math.PI * .4, true); x.closePath(); x.fill(); }
  else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * .17 : s * .42; i ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); x.fill(); }
  else if (kind === 'eye') { x.moveTo(cx - s * .44, cy); x.quadraticCurveTo(cx, cy - s * .4, cx + s * .44, cy); x.quadraticCurveTo(cx, cy + s * .4, cx - s * .44, cy); x.stroke(); x.beginPath(); x.arc(cx, cy, s * .12, 0, 7); x.fill(); }
  else if (kind === 'skull') { x.arc(cx, cy - s * .06, s * .3, Math.PI * .85, Math.PI * 2.15); x.lineTo(cx + s * .18, cy + s * .34); x.lineTo(cx - s * .18, cy + s * .34); x.closePath(); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(cx - s * .11, cy - s * .04, s * .07, 0, 7); x.arc(cx + s * .11, cy - s * .04, s * .07, 0, 7); x.fill(); }
  else { x.moveTo(cx - s * .2, cy + s * .42); x.lineTo(cx - s * .2, cy - s * .05); for (let f = 0; f < 4; f++) { const fx = cx - s * .2 + f * s * .13; x.lineTo(fx, cy - s * .4 + Math.abs(f - 1.5) * s * .06); x.lineTo(fx + s * .1, cy - s * .4 + Math.abs(f - 1.5) * s * .06); x.lineTo(fx + s * .1, cy - s * .05); } x.lineTo(cx + s * .32, cy + s * .02); x.lineTo(cx + s * .22, cy + s * .42); x.closePath(); x.fill(); }
  x.restore();
}
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

/* ---------------- wall writing ---------------- */
export const PIANO_COLORS = [{ n: 'red', c: '#d9343f' }, { n: 'blue', c: '#3a6fd9' }, { n: 'yellow', c: '#e6c032' }, { n: 'green', c: '#3fa04a' }, { n: 'white', c: '#efe9dc' }];
function scrawlTex(clue) {
  return canvasTex(512, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h); const ink = '#7a0b10';
    const drip = (px, py) => { x.fillStyle = ink; x.globalAlpha = .8; x.fillRect(px, py, 3 + Math.random() * 3, 10 + Math.random() * 50); x.globalAlpha = 1; };
    x.fillStyle = ink; x.strokeStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (clue.type === 'text') { x.font = `bold ${clue.text.length > 14 ? 48 : 64}px "Times New Roman", serif`; x.save(); x.translate(w / 2, h / 2); x.rotate(-.05); x.fillText(clue.text, 0, 0); x.restore(); for (let i = 0; i < 6; i++) drip(80 + Math.random() * 350, h / 2 + 18); }
    else if (clue.type === 'dots') { const n = clue.seq.length, sp = Math.min(90, 440 / n); clue.seq.forEach((ci, i) => { x.fillStyle = PIANO_COLORS[ci].c; x.beginPath(); x.arc(w / 2 + (i - (n - 1) / 2) * sp, h / 2 + 10, sp * .34, 0, 7); x.fill(); }); x.fillStyle = ink; x.font = 'bold 34px "Times New Roman", serif'; x.fillText('PLAY ME', w / 2, 46); }
    else if (clue.type === 'symbols') { clue.seq.forEach((k, i) => drawSymbol(x, SYMBOLS[k], w / 2 + (i - 1) * 140, h / 2 + 6, 120, ink)); for (let i = 0; i < 4; i++) drip(120 + Math.random() * 280, h / 2 + 60); }
    else if (clue.type === 'digit') { x.font = 'bold 84px "Times New Roman", serif'; const s = [0, 1, 2, 3].map(i => i === clue.pos ? String(clue.digit) : '_').join(' '); x.fillText(s, w / 2, h / 2); for (let i = 0; i < 5; i++) drip(110 + Math.random() * 300, h / 2 + 30); }
  });
}
export function placeScrawl(world, x, z, ry, clue, pid) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .75), new THREE.MeshStandardMaterial({ map: scrawlTex(clue), transparent: true, roughness: .9, depthWrite: false }));
  m.position.set(x, 1.65, z); m.rotation.y = ry; m.userData.pid = pid; world.root.add(m); return m;
}
export function clueText(c) {
  if (c.type === 'text') return `“${c.text}”`;
  if (c.type === 'dots') return 'Colored dots: ' + c.seq.map(i => PIANO_COLORS[i].n).join(', ');
  if (c.type === 'symbols') return 'Three symbols: ' + c.seq.map(i => SYMBOLS[i]).join(', ');
  if (c.type === 'digit') return `The ${['1st', '2nd', '3rd', '4th'][c.pos]} number is ${c.digit}`;
  return '';
}

/* ---------------- 1. Lever panel (all five lamps must be lit) ---------------- */
export function leverPanel(world, x, z, ry, rng) {
  const N = 5, g = station(world, x, z, ry), pidOf = i => 'lever:' + i;
  const start = Array(N).fill(1); let presses = 0;
  while (presses < 3 || start.every(v => v)) { const i = Math.floor(rng() * N); [i - 1, i, i + 1].forEach(k => { if (k >= 0 && k < N) start[k] ^= 1; }); presses++; }
  M(new THREE.BoxGeometry(.18, 1.1, .18), stdM(0x2a2630), 0, .55, -.05, g);
  M(new THREE.BoxGeometry(2, 1.2, .2), stdM(0x3a3540, { metalness: .5, roughness: .4 }), 0, 1.55, 0, g);
  const plaque = M(new THREE.PlaneGeometry(1.2, .16), new THREE.MeshStandardMaterial({ map: canvasTex(256, 32, (c) => { c.fillStyle = '#b89a52'; c.fillRect(0, 0, 256, 32); c.fillStyle = '#2a1a0a'; c.font = 'bold 20px serif'; c.textAlign = 'center'; c.fillText('LIGHT THEM ALL', 128, 23); }) }), 0, 2.03, .101, g);
  const lamps = [], levers = [];
  for (let i = 0; i < N; i++) {
    const lx = (i - 2) * .36;
    const lm = new THREE.MeshBasicMaterial({ color: 0x330808 }); M(new THREE.SphereGeometry(.07, 12, 8), lm, lx, 1.85, .12, g); lamps.push(lm);
    const pv = new THREE.Group(); pv.position.set(lx, 1.35, .12); g.add(pv);
    M(new THREE.BoxGeometry(.12, .1, .06), stdM(0x1a1820), 0, 0, 0, pv, pidOf(i));
    M(new THREE.CylinderGeometry(.025, .025, .34, 8), stdM(0x9a96a6, { metalness: .8, roughness: .3 }), 0, .17, .04, pv, pidOf(i));
    M(new THREE.SphereGeometry(.05, 10, 8), stdM(0x8a1a1a), 0, .34, .04, pv, pidOf(i));
    levers.push(pv);
  }
  block(world, x, z, ry, 2.1, .5);
  return {
    kind: 'lever', x, z, name: 'lever panel',
    init(S) { S.pz.lever = { on: start.slice(), pulls: Array(N).fill(0) }; },
    info(pid, S) { const st = S.pz.lever; if (!pid.startsWith('lever:')) return null; return S.solved.lever ? { label: 'The lever panel is solved', done: true } : { label: 'Pull lever' }; },
    request(S, from, e, ctx) { if (e.type !== 'lever' || S.solved.lever) return; const st = S.pz.lever, i = e.i; if (!(i >= 0 && i < N)) return; st.pulls[i]++; [i - 1, i, i + 1].forEach(k => { if (k >= 0 && k < N) st.on[k] ^= 1; }); ctx.emit('click', { x, z }); if (st.on.every(v => v)) solveKey(S, ctx, 'lever', this, from); },
    render(dt, S) { const st = S.pz.lever; if (!st) return; st.on.forEach((v, i) => lamps[i].color.setHex(v ? 0x4dff6a : 0x400a0a)); levers.forEach((pv, i) => { const target = st.pulls[i] % 2 ? -.6 : .6; pv.rotation.x += (target - pv.rotation.x) * Math.min(1, dt * 12); }); },
    pid: i => pidOf(i), parsePid: pid => ({ type: 'lever', i: +pid.split(':')[1] }),
  };
}

/* ---------------- 2. Grandfather clock (set the hour, then ring the chime) ---------------- */
export function clockPuzzle(world, x, z, ry, rng) {
  const H = 1 + Math.floor(rng() * 12); let start = 1 + Math.floor(rng() * 12); if (start === H) start = (H % 12) + 1;
  const g = station(world, x, z, ry), wood = stdM(0x4a2a18, { roughness: .7 });
  M(new THREE.BoxGeometry(.8, 2.2, .5), wood, 0, 1.1, 0, g, 'clock:face');
  M(new THREE.BoxGeometry(.95, .3, .6), wood, 0, 2.35, 0, g, 'clock:face');
  const face = M(new THREE.CircleGeometry(.3, 32), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (c) => { c.fillStyle = '#e8dcc0'; c.beginPath(); c.arc(128, 128, 126, 0, 7); c.fill(); c.fillStyle = '#2a1a0a'; c.font = 'bold 30px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; for (let h = 1; h <= 12; h++) { const a = h * Math.PI / 6 - Math.PI / 2; c.fillText(String(h), 128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98); } }), roughness: .5 }), 0, 1.85, .255, g, 'clock:face');
  const hand = new THREE.Group(); hand.position.set(0, 1.85, .27); g.add(hand);
  M(new THREE.BoxGeometry(.025, .22, .01), stdM(0x111111), 0, .1, 0, hand, 'clock:face');
  const pend = new THREE.Group(); pend.position.set(0, 1.45, .2); g.add(pend);
  M(new THREE.BoxGeometry(.02, .7, .02), stdM(0xb8902a, { metalness: .8, roughness: .3 }), 0, -.35, 0, pend);
  M(new THREE.CylinderGeometry(.09, .09, .03, 16), stdM(0xb8902a, { metalness: .8, roughness: .3 }), 0, -.72, 0, pend).rotation.x = Math.PI / 2;
  // the chime pull, hanging off the right side
  const chain = new THREE.Group(); chain.position.set(.5, 1.6, .15); g.add(chain);
  M(new THREE.CylinderGeometry(.008, .008, .7, 6), stdM(0x8a8a8a, { metalness: .9 }), 0, -.35, 0, chain, 'clock:chime');
  M(new THREE.SphereGeometry(.05, 10, 8), stdM(0xb8902a, { metalness: .8, roughness: .3 }), 0, -.72, 0, chain, 'clock:chime');
  block(world, x, z, ry, 1.1, .6);
  let swing = 0;
  return {
    kind: 'clock', x, z, name: 'grandfather clock', clue: { type: 'text', text: `IT STRUCK ${H}` },
    init(S) { S.pz.clock = { h: start, rings: 0 }; },
    info(pid, S) { if (pid === 'clock:face') return S.solved.clock ? { label: 'The clock has stopped', done: true } : { label: `Move the hour hand (shows ${S.pz.clock.h})` }; if (pid === 'clock:chime') return S.solved.clock ? null : { label: 'Pull the chime chain' }; return null; },
    request(S, from, e, ctx) {
      if (S.solved.clock) return; const st = S.pz.clock;
      if (e.type === 'clockHand') { st.h = st.h % 12 + 1; ctx.emit('tick', { x, z }); }
      else if (e.type === 'clockChime') { st.rings++; if (st.h === H) solveKey(S, ctx, 'clock', this, from); else { ctx.emit('gong', { x, z }); ctx.alert(x, z); } }
    },
    render(dt, S) { const st = S.pz.clock; if (!st) return; const target = -st.h * Math.PI / 6; hand.rotation.z += (target - hand.rotation.z) * Math.min(1, dt * 10); swing += dt; pend.rotation.z = S.solved.clock ? 0 : Math.sin(swing * 2.2) * .2; },
    parsePid: pid => pid === 'clock:face' ? { type: 'clockHand' } : { type: 'clockChime' },
  };
}

/* ---------------- 3. Piano (play the colors in order) ---------------- */
export function pianoPuzzle(world, x, z, ry, rng) {
  const L = 5, seq = []; while (seq.length < L) { const v = Math.floor(rng() * 5); if (v !== seq[seq.length - 1]) seq.push(v); }
  const g = station(world, x, z, ry), black = stdM(0x141216, { roughness: .25, metalness: .2 });
  M(new THREE.BoxGeometry(1.7, 1.25, .5), black, 0, .625, -.15, g);
  M(new THREE.BoxGeometry(1.7, .1, .45), black, 0, .75, .3, g);
  [-1, 1].forEach(s => M(new THREE.BoxGeometry(.08, .75, .08), black, s * .78, .375, .45, g));
  const keys = PIANO_COLORS.map((c, i) => { const k = M(new THREE.BoxGeometry(.28, .08, .36), stdM(new THREE.Color(c.c).getHex(), { roughness: .35 }), (i - 2) * .31, .84, .33, g, 'piano:' + i); return k; });
  const sheet = M(new THREE.PlaneGeometry(.5, .32), new THREE.MeshStandardMaterial({ map: canvasTex(128, 80, (c) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, 128, 80); c.strokeStyle = '#3a2a1a'; for (let l = 0; l < 5; l++) { c.beginPath(); c.moveTo(6, 20 + l * 9); c.lineTo(122, 20 + l * 9); c.stroke(); } c.fillStyle = '#3a2a1a'; c.font = 'bold 12px serif'; c.fillText('the wall knows', 18, 14); }) }), 0, 1.15, .11, g);
  sheet.rotation.x = -.2;
  block(world, x, z, ry, 1.8, .9);
  const press = keys.map(() => 0);
  return {
    kind: 'piano', x, z, name: 'piano', clue: { type: 'dots', seq },
    init(S) { S.pz.piano = { prog: 0, n: 0, last: -1 }; },
    info(pid, S) { if (!pid.startsWith('piano:')) return null; if (S.solved.piano) return { label: 'The piano is silent now', done: true }; const i = +pid.split(':')[1]; return { label: `Press the ${PIANO_COLORS[i].n} key` }; },
    request(S, from, e, ctx) {
      if (e.type !== 'piano' || S.solved.piano) return; const st = S.pz.piano, i = e.i; if (!(i >= 0 && i < 5)) return;
      st.n++; st.last = i; ctx.emit('note', { i, x, z });
      if (seq[st.prog] === i) { st.prog++; if (st.prog >= L) solveKey(S, ctx, 'piano', this, from); }
      else { st.prog = seq[0] === i ? 1 : 0; ctx.emit('discord', { x, z }); }
    },
    render(dt, S) { const st = S.pz.piano; if (!st) return; if (st.n !== this._n) { this._n = st.n; if (st.last >= 0) press[st.last] = .25; } keys.forEach((k, i) => { press[i] = Math.max(0, press[i] - dt); k.position.y = .84 - (press[i] > 0 ? .04 : 0); }); },
    parsePid: pid => ({ type: 'piano', i: +pid.split(':')[1] }),
  };
}

/* ---------------- 4. Symbol box (match the three symbols) ---------------- */
export function symbolBox(world, x, z, ry, rng) {
  const target = [0, 1, 2].map(() => Math.floor(rng() * 6)); const start = target.map(t => (t + 1 + Math.floor(rng() * 5)) % 6);
  const g = station(world, x, z, ry), wood = stdM(0x5a3a22, { roughness: .7 }), brass = stdM(0xb8902a, { metalness: .8, roughness: .3 });
  M(new THREE.BoxGeometry(.6, .8, .5), wood, 0, .4, 0, g);
  M(new THREE.BoxGeometry(1.3, .6, .7), wood, 0, 1.1, 0, g);
  const lid = new THREE.Group(); lid.position.set(0, 1.4, -.35); g.add(lid); M(new THREE.BoxGeometry(1.32, .08, .72), wood, 0, .04, .35, lid);
  const texs = SYMBOLS.map(k => canvasTex(128, 128, (c) => { c.fillStyle = '#d8ccb0'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#6a5030'; c.lineWidth = 6; c.strokeRect(4, 4, 120, 120); drawSymbol(c, k, 64, 66, 100, '#3a1a10'); }));
  const tiles = [0, 1, 2].map(i => { M(new THREE.BoxGeometry(.32, .32, .04), brass, (i - 1) * .38, 1.1, .36, g, 'roller:' + i); const t = M(new THREE.PlaneGeometry(.27, .27), new THREE.MeshStandardMaterial({ map: texs[start[i]], roughness: .6 }), (i - 1) * .38, 1.1, .385, g, 'roller:' + i); return t; });
  block(world, x, z, ry, 1.4, .8);
  return {
    kind: 'roller', x, z, name: 'symbol box', clue: { type: 'symbols', seq: target },
    init(S) { S.pz.roller = { v: start.slice() }; },
    info(pid, S) { if (!pid.startsWith('roller:')) return null; if (S.solved.roller) return { label: 'The symbol box is open', done: true }; return { label: `Turn the dial (shows ${SYMBOLS[S.pz.roller.v[+pid.split(':')[1]]]})` }; },
    request(S, from, e, ctx) { if (e.type !== 'roller' || S.solved.roller) return; const st = S.pz.roller, i = e.i; if (!(i >= 0 && i < 3)) return; st.v[i] = (st.v[i] + 1) % 6; ctx.emit('click', { x, z }); if (st.v.every((v, k) => v === target[k])) solveKey(S, ctx, 'roller', this, from); },
    render(dt, S) { const st = S.pz.roller; if (!st) return; tiles.forEach((t, i) => { if (t.material.map !== texs[st.v[i]]) t.material.map = texs[st.v[i]]; }); const open = S.solved.roller ? -1.6 : 0; lid.rotation.x += (open - lid.rotation.x) * Math.min(1, dt * 4); },
    parsePid: pid => ({ type: 'roller', i: +pid.split(':')[1] }),
  };
}

export const STATIONS = [leverPanel, clockPuzzle, pianoPuzzle, symbolBox];
