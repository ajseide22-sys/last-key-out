// Last Key Out — client. First-person controls, host-authoritative rounds, monsters, money, proximity voice and chat.
import * as THREE from 'three';
import { Net } from './net.js';
import { Voice } from './voice.js';
import { World, collide, wallBetween, clamp, lerp } from './world.js';
import { buildManor, CFG, AREA_NAME } from './areas.js';
import { makeSentry, animSentry, makeCreature, poseCreature, CREATURE_KINDS } from './sentry.js';
import { makeAvatar, lightColor } from './avatar.js';
import { initShop, openShop, getCos, profile, onProfile, bank } from './shop.js';
import { Music } from './music.js';

const $ = id => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem('lko.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('lko.' + k, JSON.stringify(v)); } catch (e) { } } };
const settings = { vol: store.get('vol', 1), music: store.get('music', 1), bright: store.get('bright', 1.3), sens: store.get('sens', 1) };

/* ---------------- renderer ---------------- */
const canvas = $('stage');
function lockMouse() { try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.LinearToneMapping; renderer.toneMappingExposure = settings.bright;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.Fog(0x000000, 8, 30);
const camera = new THREE.PerspectiveCamera(72, 1, .05, 34); camera.rotation.order = 'YXZ'; scene.add(camera);
const hemi = new THREE.HemisphereLight(0x6a5a90, 0x221830, 0); scene.add(hemi);
const flash = new THREE.SpotLight(0xfff1d6, 30, 26, .55, .45, 1.4); flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); flash.shadow.bias = -.0006; flash.shadow.camera.near = .2;
flash.position.set(.25, -.2, 0); camera.add(flash); camera.add(flash.target); flash.target.position.set(0, -.15, -1);
const world = new World(scene);
const remoteLights = Array.from({ length: 7 }, () => { const L = new THREE.SpotLight(0xfff1d6, 0, 24, .5, .5, 1.4); scene.add(L); scene.add(L.target); return L; });
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
function applyFlashColor() { flash.color.setHex(lightColor(getCos())); }
applyFlashColor();

/* ---------------- audio ---------------- */
let AC = null, sfxOut = null, music = null;
const net = new Net(), voice = new Voice(net);
function audioInit() {
  if (AC) { AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); sfxOut = AC.createGain(); sfxOut.gain.value = .45; sfxOut.connect(AC.destination);
    voice.attach(AC); voice.setVolume(settings.vol); creepInit();
    music = new Music(AC, AC.destination); music.setVolume(settings.music); music.start();
  } catch (e) { AC = null; }
}
function tone(f, d, type, v, delay, slide) { if (!AC) return; const t = AC.currentTime + (delay || 0); const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, v || .2), t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(sfxOut); o.start(t); o.stop(t + d + .05); }
function noise(d, v, ff, delay) { if (!AC) return; const t = AC.currentTime + (delay || 0); const len = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, len, AC.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = ff || 800; const g = AC.createGain(); g.gain.setValueAtTime(Math.max(.0001, v || .2), t); g.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(f); f.connect(g); g.connect(sfxOut); s.start(t); }
function click(vol, pan) { if (!AC) return; const t = AC.currentTime; const o = AC.createOscillator(), g = AC.createGain(), pn = AC.createStereoPanner ? AC.createStereoPanner() : null; o.type = 'square'; o.frequency.setValueAtTime(2800 + Math.random() * 1500, t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .03); o.connect(g); if (pn) { pn.pan.value = clamp(pan, -1, 1); g.connect(pn); pn.connect(sfxOut); } else g.connect(sfxOut); o.start(t); o.stop(t + .05); }
const NOTE = [261.6, 311.1, 349.2, 392, 466.2];
const SFX = {
  key() { [660, 880, 1320].forEach((f, i) => tone(f, .2, 'triangle', .22, i * .07)); }, empty() { tone(150, .18, 'sine', .22); noise(.12, .1, 500); },
  cash() { [1200, 1600].forEach((f, i) => tone(f, .12, 'square', .1, i * .06)); noise(.15, .12, 5000, .02); },
  safe() { tone(180, .3, 'square', .14); noise(.4, .2, 1200, .05); [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .25, 'triangle', .16, .3 + i * .06)); },
  solve() { [392, 494, 587, 784].forEach((f, i) => tone(f, .35, 'triangle', .2, i * .09)); },
  door() { noise(2.2, .35, 300); tone(60, 2, 'sawtooth', .18, 0, 35); [392, 523, 659].forEach((f, i) => tone(f, .5, 'triangle', .14, 1.6 + i * .15)); },
  locked() { tone(220, .08, 'square', .12); tone(180, .12, 'square', .12, .09); }, wrong() { tone(190, .4, 'sawtooth', .2, 0, 90); },
  click(v = 1) { tone(1800, .03, 'square', .08 * v); noise(.04, .08 * v, 3000); }, tick(v = 1) { tone(2200, .03, 'square', .07 * v); tone(1600, .03, 'square', .05 * v, .12); },
  gong(v = 1) { [98, 196.5, 294, 415].forEach((f, i) => tone(f, 3.5 - i * .5, 'sine', .3 * v / (i + 1))); noise(.3, .2 * v, 900); },
  note(i, v = 1) { tone(NOTE[i], 1.2, 'triangle', .25 * v); tone(NOTE[i] * 2, .8, 'sine', .08 * v); },
  discord(v = 1) { [233, 247, 349, 370].forEach(f => tone(f, 1.2, 'sawtooth', .07 * v)); },
  step() { noise(.05, .04, 300); }, jump() { tone(300, .1, 'sine', .06, 0, 420); },
  trap() { tone(900, .08, 'square', .14); tone(1250, .08, 'square', .14, .09); noise(.3, .2, 3500, .05); },
  screech() { tone(1400, .7, 'sawtooth', .28, 0, 380); tone(2100, .5, 'square', .12, .05, 700); noise(.8, .45, 5000); },
  scream(v = 1) { tone(900, 1.1, 'sawtooth', .32 * v, 0, 260); tone(1350, .9, 'square', .14 * v, .03, 420); tone(620, 1.2, 'sawtooth', .2 * v, .05, 180); noise(1.1, .5 * v, 4200); },
  growl(v = 1) { tone(70 + Math.random() * 20, .7, 'sawtooth', .18 * v, 0, 45); noise(.6, .12 * v, 300); },
  lockpick() { tone(2400, .03, 'square', .05); }, unlock() { tone(600, .1, 'square', .14); tone(900, .16, 'triangle', .18, .1); noise(.3, .15, 2000, .05); },
  lose() { [440, 392, 330, 262].forEach((f, i) => tone(f, .3, 'sawtooth', .12, i * .12)); },
  win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .4, 'triangle', .2, i * .1)); },
};
// breathing near hidden monsters, a heartbeat when something hunts close by
const creep = { on: false };
function creepInit() {
  if (!AC || creep.on) return; creep.on = true;
  const len = AC.sampleRate * 2, b = AC.createBuffer(1, len, AC.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = b; src.loop = true; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.4; const bg = AC.createGain(); bg.gain.value = 0; src.connect(bp); bp.connect(bg); bg.connect(sfxOut); src.start();
  Object.assign(creep, { bg, beatT: 0, breathPh: 0 });
}
function creepUpdate(dt, intensity, breath) {
  if (!creep.on) return; const t = AC.currentTime;
  creep.breathPh += dt * (1.2 + intensity * 1.6); const inhale = Math.max(0, Math.sin(creep.breathPh));
  creep.bg.gain.setTargetAtTime(Math.max(breath, intensity * .5) * .2 * inhale, t, .08);
  creep.beatT -= dt; const level = Math.max(intensity, breath * .8);
  if (level > .3 && creep.beatT <= 0) { creep.beatT = 1.05 - level * .6; tone(55, .12, 'sine', .35 * level); tone(48, .14, 'sine', .28 * level, .17); }
}

/* ---------------- state ---------------- */
const app = { me: null, room: null, hostId: null, roster: new Map(), view: 'home', round: 0, cfg: null, S: null, A: null, lastEv: 0, lastSnap: 0, lastPos: 0, pending: new Map(), holdT: 0, sentries: [], lurkV: [], jump: null, lurkSeen: {}, scare: null, clickT: 0, growlT: 0, prevSt: [], specIdx: 0, bankedKey: null, shownResults: null, moneyShown: 0 };
const me = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, h: 1.75, stam: 100, stun: 0, fl: true, jailed: false, ground: true, bob: 0, stepT: 0 };
const isHost = () => app.me && app.hostId === app.me.id;
const nameOf = id => id === app.me?.id ? 'You' : (app.roster.get(id)?.name || 'Someone');
const inGame = () => app.view === 'game' && app.A && app.S;
const escaped = id => !!(app.S && app.S.escaped && app.S.escaped[id] !== undefined);
const myOut = () => !!(inGame() && escaped(app.me.id));
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const money = n => '$' + (n || 0).toLocaleString();

/* ---------------- UI helpers ---------------- */
let toastT; function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }
let bannerT; function banner(a, b, red, dur) { $('bn1').textContent = a; $('bn2').textContent = b; $('banner').classList.toggle('red', !!red); $('banner').classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => $('banner').classList.remove('show'), dur || 2600); }
function hurt() { const h = $('hurt'); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 160); }
function show(view) {
  app.view = view;
  $('home').hidden = view !== 'home'; $('lobby').hidden = view !== 'lobby';
  const g = view === 'game'; $('hud').hidden = !g; $('cross').hidden = !g; $('stam').hidden = !g;
  if (!g) ['prompt', 'ring', 'lockhint', 'spec', 'chomp', 'menu', 'keypad', 'results'].forEach(id => $(id).hidden = true);
}
function fadeDo(fn) { $('fade').classList.add('on'); setTimeout(() => { fn(); setTimeout(() => $('fade').classList.remove('on'), 80); }, 360); }
const cache = {}; function setText(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
function walletText() { document.querySelectorAll('.walletTxt').forEach(el => el.textContent = money(profile().wallet)); }
const myMeta = () => ({ mic: voice.micOn, muted: voice.muted, cos: getCos() });
function sendMeta() { if (app.me) net.send({ t: 'meta', meta: myMeta() }); }
onProfile(() => { walletText(); applyFlashColor(); sendMeta(); const r = app.me && app.roster.get(app.me.id); if (r) r.meta = myMeta(); if (app.view === 'lobby') renderLobby(); });
walletText(); initShop();
const myColor = () => (app.me && app.roster.get(app.me.id)?.color) || '#ff6b6b';
['homeShop', 'lobbyShop', 'resShop'].forEach(id => $(id).onclick = () => openShop(myColor()));

/* ---------------- home / lobby ---------------- */
$('nameIn').value = store.get('name', '');
const urlRoom = new URLSearchParams(location.search).get('room'); if (urlRoom) $('codeIn').value = urlRoom.toUpperCase().slice(0, 4);
function homeErr(msg) { $('homeErr').textContent = msg; $('homeErr').hidden = !msg; }
async function joinRoom(create) {
  audioInit();
  const name = $('nameIn').value.trim() || 'Player'; store.set('name', name);
  const code = $('codeIn').value.trim().toUpperCase();
  if (!create && code.length !== 4) return homeErr('Enter the 4-letter room code, or create a new room.');
  homeErr(''); $('createBtn').disabled = $('joinBtn').disabled = true;
  try { if (!net.open) await net.connect(); net.send({ t: 'join', create, room: code, name, meta: myMeta() }); }
  catch (e) { homeErr(e.message + ' Is the server running?'); $('createBtn').disabled = $('joinBtn').disabled = false; }
}
$('createBtn').onclick = () => joinRoom(true);
$('joinBtn').onclick = () => joinRoom(false);
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(false); });
$('copyBtn').onclick = () => { const link = location.origin + location.pathname + '?room=' + app.room; navigator.clipboard?.writeText(link).then(() => toast('Invite link copied.'), () => toast(link)); };
$('leaveLobby').onclick = $('leaveBtn').onclick = () => { net.close(); voice.closeAll(); location.href = location.pathname; };
function renderLobby() {
  setText('roomCode', app.room || '----');
  $('inviteText').textContent = `Friends open ${location.host}/?room=${app.room} or type the code ${app.room}. Up to 8 players.`;
  const list = [...app.roster.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  $('lobbyList').innerHTML = list.map(p => `<div class="pl" id="lp-${p.id}"><span class="dot" style="background:${p.color}"></span><span class="nm">${esc(p.name)}${p.id === app.me.id ? ' (you)' : ''}</span><span class="tag">${p.meta?.mic ? (p.meta.muted ? 'muted' : 'mic on') : 'no mic'}</span>${p.id === app.hostId ? '<span class="tag host">Host</span>' : ''}</div>`).join('');
  $('startBtn').hidden = !isHost();
  $('startNote').textContent = isHost() ? `${list.length} player${list.length === 1 ? '' : 's'} ready. The manor grows with every player who joins.` : 'Waiting for the host to start.';
  micButtons();
}
function micButtons() {
  const t = !voice.micOn ? 'Turn on microphone' : voice.muted ? 'Microphone muted' : 'Microphone on';
  [$('micBtn'), $('menuMic')].forEach(b => { b.textContent = t; b.classList.toggle('on', voice.micOn && !voice.muted); });
  $('menuMute').textContent = voice.muted ? 'Unmute mic (M)' : 'Mute mic (M)';
  setText('micState', !voice.micOn ? 'Mic off' : voice.muted ? 'Muted (M)' : 'Mic on');
}
async function micToggle() {
  audioInit();
  if (!voice.micOn) {
    try { await voice.enableMic(); $('micErr').hidden = true; }
    catch (e) { $('micErr').textContent = e.name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it in the browser address bar and try again.' : e.message; $('micErr').hidden = false; toast($('micErr').textContent); }
  } else voice.setMuted(!voice.muted);
  sendMeta(); if (app.me) { const r = app.roster.get(app.me.id); if (r) r.meta = myMeta(); }
  micButtons(); if (app.view === 'lobby') renderLobby();
}
$('micBtn').onclick = micToggle; $('menuMic').onclick = micToggle;
$('menuMute').onclick = () => { if (voice.micOn) micToggle(); };
$('startBtn').onclick = () => { if (isHost()) { audioInit(); hostStart(); } };

/* ---------------- network ---------------- */
function buildAvatar(r) { if (r.av) scene.remove(r.av.g); r.av = makeAvatar((r.meta && r.meta.cos) || {}, r.color); r.cosKey = JSON.stringify((r.meta && r.meta.cos) || {}); scene.add(r.av.g); }
function addRoster(p) {
  if (app.roster.has(p.id)) return; const r = Object.assign({ pos: null, meta: {}, av: null, tag: null, bubble: null }, p); app.roster.set(p.id, r);
  if (app.me && p.id !== app.me.id) { buildAvatar(r); r.tag = document.createElement('div'); r.tag.className = 'ntag'; $('tags').appendChild(r.tag); voice.addPeer(p.id); }
}
function removeRoster(id) { const r = app.roster.get(id); if (!r) return; if (r.av) scene.remove(r.av.g); if (r.tag) r.tag.remove(); app.roster.delete(id); voice.removePeer(id); }
net.on('welcome', m => {
  app.me = { id: m.id }; app.room = m.room; app.hostId = m.hostId; voice.myId = m.id; voice.ice = m.iceServers || voice.ice;
  history.replaceState(null, '', '?room=' + m.room);
  m.players.forEach(addRoster);
  $('createBtn').disabled = $('joinBtn').disabled = false;
  if (m.screen === 'game' && m.area && m.area.cfg) applyRound(m.area.cfg, m.snap && m.snap.S && m.snap.S.key === m.area.cfg.key ? m.snap.S : null);
  else { show('lobby'); renderLobby(); }
});
net.on('error', m => { homeErr(m.msg); $('createBtn').disabled = $('joinBtn').disabled = false; });
net.on('peer-join', m => { addRoster(m.player); toast(`${m.player.name} joined.`); sendMeta(); if (app.view === 'lobby') renderLobby(); });
net.on('peer-leave', m => {
  const n = app.roster.get(m.id)?.name; removeRoster(m.id); const wasHost = isHost(); app.hostId = m.hostId;
  toast(`${n || 'A player'} left.` + (!wasHost && isHost() ? ' You are the host now.' : ''));
  if (app.view === 'lobby') renderLobby(); resultsButtons();
});
net.on('pos', m => { const r = app.roster.get(m.id); if (r) { r.pos = m.p; r.posAt = performance.now(); } });
net.on('meta', m => { const r = app.roster.get(m.id); if (!r) return; r.meta = m.meta || {}; if (r.av && JSON.stringify(r.meta.cos || {}) !== r.cosKey) buildAvatar(r); if (app.view === 'lobby') renderLobby(); });
net.on('rtc', m => voice.signal(m.from, m.data));
net.on('say', m => showSay(m.id, m.text));
net.on('fromguest', m => { if (isHost() && inGame()) handleRequest(m.from, m.e); });
net.on('bcast', m => {
  const e = m.e; if (!e) return;
  if (e.type === 'area') applyRound(e.cfg, null);
  else if (e.type === 'snap') { if (!isHost() && app.cfg && e.S.key === app.cfg.key) app.S = e.S; }
  else if (e.type === 'screen' && e.screen === 'lobby') goLobby();
});
net.on('close', () => { show('home'); homeErr('Lost connection to the game server.'); app.roster.forEach((r, id) => removeRoster(id)); world.clear(); app.A = app.S = null; });

/* ---------------- rounds ---------------- */
function applyRound(cfg, S) {
  const doIt = () => {
    world.clear(); menu = null; app.scare = null; app.jump = null; app.lurkSeen = {}; app.prevSt = []; app.pending.clear(); app.shownResults = null; app.bankedKey = null;
    app.cfg = cfg; app.round = cfg.round; app.A = buildManor(world, cfg);
    if (S) { app.S = S; app.lastEv = S.evN || 0; } else { app.S = { key: cfg.key, screen: null }; app.A.init(app.S); app.lastEv = 0; }
    app.sentries = Array.from({ length: app.A.sentryCount }, (_, i) => makeSentry(world.root, i));
    app.lurkV = app.A.lurkers.map(l => { const V = makeCreature(world.root, l.kind); V.g.visible = false; V.g.position.set(l.x, 0, l.z); V.g.rotation.y = l.f; return V; });
    const order = [...app.roster.values()].sort((a, b) => a.joinedAt - b.joinedAt).map(r => r.id);
    const sp = app.A.spawn[Math.max(0, order.indexOf(app.me.id)) % app.A.spawn.length];
    Object.assign(me, { x: sp.x, y: 0, z: sp.z, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: -.05, stun: 0, jailed: false, ground: true, stam: 100, fl: true });
    if (app.S.jailed && app.S.jailed[app.me.id]) { const j = app.A.jail.spots[0]; me.x = j.x; me.z = j.z; me.jailed = true; }
    app.moneyShown = (app.S.money || {})[app.me.id] || 0;
    show('game'); $('menu').hidden = $('keypad').hidden = $('results').hidden = true; $('chomp').hidden = true;
    setText('hLevel', `Round ${cfg.round}`); setText('hArea', AREA_NAME);
    banner(`Round ${cfg.round}`, AREA_NAME, false, 2600);
    if (document.pointerLockElement !== canvas) $('lockhint').hidden = false;
  };
  if (app.view === 'game') fadeDo(doIt); else doIt();
}
function hostStart() {
  const cfg = { key: Math.random().toString(36).slice(2, 9), round: (app.round || 0) + 1, n: Math.max(1, app.roster.size), seed: (Math.random() * 2147483647) | 0, startAt: net.now() + 2500 };
  net.send({ t: 'bcast', e: { type: 'area', cfg } }); applyRound(cfg, null);
}
function goLobby() { world.clear(); menu = null; app.A = app.S = app.cfg = null; app.sentries = []; app.lurkV = []; if (document.pointerLockElement) document.exitPointerLock(); show('lobby'); renderLobby(); }
function allPlayers() {
  const S = app.S, J = S.jailed || {}, list = [{ id: app.me.id, x: me.x, y: me.y, z: me.z, yaw: me.yaw, fl: me.fl && !me.jailed, jailed: !!J[app.me.id] }];
  app.roster.forEach(r => { if (r.id !== app.me.id && r.pos) list.push({ id: r.id, x: r.pos.x, y: r.pos.y, z: r.pos.z, yaw: r.pos.yaw, fl: !!r.pos.fl, jailed: !!J[r.id] }); });
  return list;
}
function handleRequest(from, e) { if (!app.S || app.S.screen) return; app.A.request(app.S, from, e, { now: net.now() }); app.lastSnap = 0; }
function sendReq(e) { if (isHost()) handleRequest(app.me.id, e); else net.send({ t: 'tohost', e }); }
function hostTick(dt) {
  const S = app.S, now = net.now();
  if (!S.screen) {
    const ctx = { players: allPlayers(), now };
    if (now >= app.cfg.startAt - 500) app.A.hostUpdate(dt, S, ctx);
    // the round ends when nobody is left free inside: everyone escaped or is locked up
    const present = ctx.players.filter(p => S.escaped[p.id] === undefined);
    if (ctx.players.length && !present.some(p => !S.jailed[p.id])) { if (!S.endAt) S.endAt = now; else if (now - S.endAt > 2500) S.screen = { type: 'results', at: now }; } else S.endAt = 0;
  }
  if (now - app.lastSnap > 100) { app.lastSnap = now; net.send({ t: 'bcast', e: { type: 'snap', S } }); }
}

/* ---------------- events from the shared state ---------------- */
const distVol = (x, z, R = 25) => x === undefined ? 1 : clamp(1 - Math.hypot(x - me.x, z - me.z) / R, 0, 1);
function processEvents() { const S = app.S; if (!S.events) return; for (const ev of S.events) { if (ev.id <= app.lastEv) continue; app.lastEv = ev.id; fx(ev); } }
function fx(e) {
  const mine = e.by === app.me.id, who = nameOf(e.by), v = distVol(e.x, e.z);
  switch (e.type) {
    case 'key': SFX.key(); app.A.keyFx(e.x, e.y, e.z); toast(`${mine ? 'You' : who} found a key! The crew has ${app.S.keys}.`); break;
    case 'cash': if (mine) { SFX.cash(); toast(`+${money(e.amt)} in cash`); } break;
    case 'empty': if (mine) { SFX.empty(); toast('Nothing here.'); } break;
    case 'trap': if (mine) { SFX.trap(); me.stun = 1.6; hurt(); toast('A rat leapt out at you!'); } break;
    case 'lurker': if (mine) startJump(makeCreature(world.root, CREATURE_KINDS[Math.floor(Math.random() * 3)]), true); else if (v > 0) { SFX.scream(v * .7); if (v > .5) toast(`Something jumped out at ${who}!`); } break;
    case 'safe': SFX.safe(); toast(mine ? `You opened a safe: +${money(e.amt)}${e.digit ? '. There\'s a number scratched inside!' : ''}` : `${who} opened a safe and grabbed ${money(e.amt)}${e.digit ? ' and a clue' : ''}.`); break;
    case 'solve': { SFX.solve(); app.A.keyFx(e.x, 1.6, e.z); const st = app.A.stations.find(s => s.kind === e.kind); toast(`${mine ? 'You' : who} solved the ${st ? st.name : 'puzzle'}! The crew gets a key.`); break; }
    case 'click': if (v > 0) SFX.click(v); break;
    case 'tick': if (v > 0) SFX.tick(v); break;
    case 'note': if (v > 0) SFX.note(e.i, v); break;
    case 'discord': if (v > 0) SFX.discord(v); if (mine) toast('Wrong note. Start the tune again.'); break;
    case 'gong': SFX.gong(Math.max(.25, v)); toast(mine ? 'Wrong hour! The chime echoes through the house… something heard it.' : 'A clock chime booms somewhere in the house.'); break;
    case 'door': SFX.door(); banner('A bookshelf slides open', 'The way out', false, 3200); toast(`${mine ? 'You' : who} cracked the combination. Get to the secret passage!`); break;
    case 'comboWrong': if (mine) { SFX.wrong(); toast('The dial won\'t budge. Wrong combination.'); } break;
    case 'freed': SFX.unlock(); toast(`${mine ? 'You' : who} picked the jail lock!`); break;
    case 'caught': if (mine) { app.scare = { at: performance.now(), by: e.s }; SFX.screech(); SFX.lose(); hurt(); $('chomp').hidden = false; toast(e.lost ? `It caught you. You dropped ${money(e.lost)} where it got you.` : 'It caught you.'); } else toast(`A monster dragged ${who} to the jail${e.lost ? `. They dropped ${money(e.lost)}. Grab it before it's gone for good!` : '!'}`); break;
    case 'pickup': SFX.cash(); toast(mine ? `You picked up ${money(e.amt)}${e.from === app.me.id ? ' of your own money' : ` that ${nameOf(e.from)} dropped`}.` : `${who} picked up ${money(e.amt)}${e.from === e.by ? '' : ` dropped by ${nameOf(e.from)}`}.`); break;
    case 'escaped': if (mine) { SFX.win(); banner('You escaped', `with ${money(e.amt)}`, false, 3500); } else toast(`${who} escaped with ${money(e.amt)}!`); break;
  }
}

/* ---------------- avatars ---------------- */
function flicker(d) { if (d > 11) return 1; const p = 1 - d / 11; if (Math.random() < p * p * .6) return Math.random() * .2; return 1 - p * .35 * Math.random(); }
function nearestSentry(x, z) { const ss = app.S && app.S.sentries; if (!ss) return 1e9; let b = 1e9; for (const s of ss) { const d = Math.hypot(s.x - x, s.z - z); if (d < b) b = d; } return b; }
function updateAvatars(dt) {
  const fwd = new THREE.Vector3(); let li = 0;
  app.roster.forEach(r => {
    if (!r.av) return; const p = r.pos, av = r.av;
    const vis = inGame() && p && !escaped(r.id);
    av.g.visible = !!vis;
    if (vis) {
      if (!av.init) { av.rx = p.x; av.rz = p.z; av.ry = p.y; av.init = true; }
      const k = Math.min(1, dt * 14); const moving = Math.hypot(p.x - av.rx, p.z - av.rz) > .02;
      av.rx = lerp(av.rx, p.x, k); av.rz = lerp(av.rz, p.z, k); av.ry = lerp(av.ry, p.y, k);
      av.g.position.set(av.rx, av.ry + (moving ? Math.abs(Math.sin(performance.now() / 90)) * .06 : 0), av.rz);
      av.g.rotation.y = p.yaw + Math.PI; av.head.rotation.x = -p.pitch * .6;
      av.g.scale.y = lerp(av.g.scale.y, (p.h || 1.75) / 1.75, k);
      av.tick(performance.now() / 1000, moving);
      const fk = flicker(nearestSentry(av.rx, av.rz));
      av.beam.visible = !!p.fl && fk > .3; av.beam.material.opacity = .06 * fk;
      av.ring.material.opacity = voice.talking(r.id) ? .9 : 0;
      if (p.fl && li < remoteLights.length) { const L = remoteLights[li++]; L.color.setHex(lightColor(r.meta && r.meta.cos)); L.position.set(av.rx, av.ry + (p.h || 1.75) - .3, av.rz); fwd.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch)); L.target.position.copy(L.position).add(fwd); L.intensity = 26 * fk; }
    }
    if (!r.tag) return;
    let showTag = false;
    if (vis) {
      const hp = new THREE.Vector3(av.rx, av.ry + 2.2 * av.g.scale.y, av.rz); const d = camera.position.distanceTo(hp); const v = hp.clone().project(camera);
      if (v.z < 1 && d < 20 && !wallBetween(camera.position.x, camera.position.z, av.rx, av.rz, world.solids)) {
        showTag = true; r.tag.style.left = (v.x + 1) / 2 * innerWidth + 'px'; r.tag.style.top = (1 - v.y) / 2 * innerHeight + 'px';
        const talk = voice.talking(r.id), bub = r.bubble && r.bubble.until > performance.now() ? r.bubble.text : '';
        const html = `${bub ? `<span class="bub">${esc(bub)}</span>` : ''}${talk ? '<span class="spk">speaking</span>' : ''}<span style="color:${r.color}">${esc(r.name)}</span>`;
        if (r.tag._h !== html) { r.tag._h = html; r.tag.innerHTML = html; }
        r.tag.style.opacity = clamp(1.4 - d / 16, .25, 1);
      }
    }
    r.tag.hidden = !showTag;
  });
  for (; li < remoteLights.length; li++) remoteLights[li].intensity = 0;
}

/* ---------------- proximity text chat ---------------- */
function showSay(id, text) {
  const r = app.roster.get(id); if (!r) return;
  if (inGame()) { const myE = myOut(), theirE = escaped(id); if (theirE && !myE) return; if (id !== app.me.id && !theirE && !myE && r.pos && Math.hypot(r.pos.x - me.x, r.pos.z - me.z) > 16) return; }
  r.bubble = { text, until: performance.now() + 5000 };
  const d = document.createElement('div'); d.innerHTML = `<b style="color:${r.color}">${esc(r.name)}</b>${esc(text)}`; $('chatlog').appendChild(d);
  while ($('chatlog').children.length > 6) $('chatlog').firstChild.remove();
  setTimeout(() => d.remove(), 9000);
}
function openChat() { const c = $('chatbox'); c.hidden = false; c.value = ''; app.chatting = true; if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => c.focus(), 0); }
$('chatbox').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const t = $('chatbox').value.trim(); if (t) net.send({ t: 'say', text: t }); closeChat(); } else if (e.key === 'Escape') closeChat(); });
function closeChat() { $('chatbox').hidden = true; app.chatting = false; $('chatbox').blur(); lockMouse(); }

/* ---------------- combination lock ---------------- */
let padVal = '';
$('padKeys').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'C'].map(k => `<button type="button" data-k="${k}">${k}</button>`).join('');
function openPad() { padVal = ''; renderPad(); $('keypad').hidden = false; app.padOpen = true; if (document.pointerLockElement) document.exitPointerLock(); const c = (app.S.clue || {})[app.me.id] || '____'; $('padHint').textContent = `Behind the red book is a brass dial with four numbers. You know: ${c.split('').join(' ')}. Type all four, then press Enter.`; }
function closePad(resume) { $('keypad').hidden = true; app.padOpen = false; if (resume) lockMouse(); }
function renderPad() { $('padShow').textContent = padVal.padEnd(4, '·'); }
function padKey(k) { if (k === '⌫') padVal = padVal.slice(0, -1); else if (k === 'C') padVal = ''; else if (padVal.length < 4) padVal += k; renderPad(); SFX.click(); }
function padSubmit() { if (padVal.length !== 4) return; sendReq({ type: 'combo', code: padVal }); closePad(true); }
$('padKeys').addEventListener('click', e => { const b = e.target.closest('button'); if (b) padKey(b.dataset.k); });
$('padGo').onclick = padSubmit; $('padClose').onclick = () => closePad(true);

/* ---------------- input ---------------- */
const keys = {};
addEventListener('keydown', e => {
  if (app.chatting) return;
  if (app.padOpen) { if (/^Digit\d$|^Numpad\d$/.test(e.code)) padKey(e.code.slice(-1)); else if (e.code === 'Backspace') padKey('⌫'); else if (e.code === 'Enter' || e.code === 'NumpadEnter') padSubmit(); else if (e.code === 'Escape') closePad(true); e.preventDefault(); return; }
  if (app.view === 'game' && !e.repeat) {
    if (e.code === 'KeyF') { me.fl = !me.fl; SFX.click(.6); }
    if (e.code === 'KeyM') { if (voice.micOn) micToggle(); else toast('Turn your microphone on from the menu (Esc).'); }
    if (e.code === 'KeyT') { e.preventDefault(); openChat(); return; }
    if (e.code === 'KeyE') pressInteract();
    if (e.code === 'Space' && myOut()) app.specIdx++;
  }
  if (app.view === 'game' && ['Space', 'Tab'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('click', () => { audioInit(); if (app.view === 'game' && !app.padOpen && !app.chatting && $('results').hidden) lockMouse(); if (myOut()) app.specIdx++; });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  $('lockhint').hidden = locked || app.view !== 'game';
  if (locked) $('menu').hidden = true;
  else if (app.view === 'game' && !app.padOpen && !app.chatting && $('results').hidden) { $('menu').hidden = false; $('hostLobbyBtn').hidden = !isHost(); micButtons(); }
});
document.addEventListener('mousemove', e => { if (document.pointerLockElement !== canvas || myOut() || app.scare || app.jump) return; const s = .0022 * settings.sens; me.yaw -= e.movementX * s; me.pitch = clamp(me.pitch - e.movementY * s, -1.45, 1.45); });
$('resumeBtn').onclick = () => { $('menu').hidden = true; lockMouse(); };
$('sVol').value = settings.vol; $('sMusic').value = settings.music; $('sBright').value = settings.bright; $('sSens').value = settings.sens;
$('sVol').oninput = e => { settings.vol = +e.target.value; voice.setVolume(settings.vol); store.set('vol', settings.vol); };
$('sMusic').oninput = e => { settings.music = +e.target.value; if (music) music.setVolume(settings.music); store.set('music', settings.music); };
$('sBright').oninput = e => { settings.bright = +e.target.value; renderer.toneMappingExposure = settings.bright; store.set('bright', settings.bright); };
$('sSens').oninput = e => { settings.sens = +e.target.value; store.set('sens', settings.sens); };
$('hostLobbyBtn').onclick = $('resLobbyBtn').onclick = () => { if (!isHost()) return; net.send({ t: 'bcast', e: { type: 'screen', screen: 'lobby' } }); goLobby(); };
$('againBtn').onclick = () => { if (isHost() && app.S && app.S.screen && app.S.screen.type === 'results') { app.S.screen = { type: 'restarting' }; hostStart(); } };
function resultsButtons() { const h = isHost(); $('againBtn').hidden = !h; $('resLobbyBtn').hidden = !h; $('resWait').hidden = h; }

/* ---------------- interaction ---------------- */
const ray = new THREE.Raycaster(); ray.far = 2.8; const center = new THREE.Vector2(0, 0);
let focus = null;
function findFocus() {
  focus = null; if (!inGame() || myOut() || me.jailed || app.scare || app.jump || app.S.screen) return;
  ray.setFromCamera(center, camera);
  const near = world.root.children.filter(o => { const dx = o.position.x - me.x, dz = o.position.z - me.z; if (dx * dx + dz * dz < 30) return true; const g = o.geometry; if (!g) return false; if (!g.boundingSphere) g.computeBoundingSphere(); return g.boundingSphere.radius > 3; });
  const hits = ray.intersectObjects(near, true);
  for (const h of hits) { if (!h.object.visible) continue; const pid = h.object.userData.pid; if (pid) { const info = app.A.info(pid, app.S); if (info) focus = { pid, info }; } break; }
}
function pressInteract() {
  if (!focus || me.stun > 0) return; const { pid, info } = focus;
  if (info.done || info.hold) return;
  if (info.combo) return openPad();
  if (info.locked) { SFX.locked(); toast(info.label); return; }
  if (pid.startsWith('scrawl:')) { toast('The wall says: ' + app.A.clueText(app.A.scrawlClue(pid))); sendReq({ type: 'read', pid }); return; }
  sendReq({ type: 'station', pid });
}
function updateInteract(dt) {
  findFocus();
  const pr = $('prompt'), ring = $('ring');
  $('cross').classList.toggle('hot', !!focus && !focus.info.done);
  if (!focus) { pr.hidden = true; ring.hidden = true; app.holdT = 0; return; }
  const { pid, info } = focus; const pending = app.pending.has(pid) && performance.now() - app.pending.get(pid) < 2500;
  pr.hidden = false; pr.classList.toggle('dim', !!info.done);
  const html = info.done ? esc(info.label) : pending ? 'Working…' : `<b>${info.hold ? 'Hold E' : 'E'}</b>${esc(info.label)}`;
  if (pr._h !== html) { pr._h = html; pr.innerHTML = html; }
  if (info.hold && !info.done && !pending && keys.KeyE && me.stun <= 0) {
    app.holdT += dt; const need = info.holdTime || CFG.search; ring.hidden = false;
    $('ringC').setAttribute('stroke-dashoffset', 138.2 * (1 - Math.min(1, app.holdT / need)));
    if (pid === 'jail' && Math.random() < .08) SFX.lockpick();
    if (app.holdT >= need) {
      app.holdT = 0; app.pending.set(pid, performance.now());
      const isSafe = app.A.props.get(pid)?.isSafe;
      sendReq(pid === 'jail' ? { type: 'free' } : isSafe ? { type: 'safe', pid } : { type: 'search', pid }); noise(.2, .08, 900);
    }
  } else { app.holdT = 0; ring.hidden = true; }
}

/* ---------------- local player ---------------- */
function updateMe(dt) {
  const S = app.S; const frozen = app.padOpen || app.chatting || !!S.screen || document.pointerLockElement !== canvas;
  me.stun = Math.max(0, me.stun - dt);
  let ix = 0, iz = 0;
  if (!frozen) { if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1; }
  const mag = Math.hypot(ix, iz); if (mag > 1) { ix /= mag; iz /= mag; }
  const crouch = !frozen && (keys.KeyC || keys.ControlLeft), moving = mag > 0;
  const sprint = !frozen && (keys.ShiftLeft || keys.ShiftRight) && !crouch && moving && me.stam > 1;
  me.stam = clamp(me.stam + (sprint ? -28 : 16) * dt, 0, 100);
  let speed = crouch ? 2.2 : sprint ? 6.6 : 4.2; if (me.stun > 0) speed *= .25;
  const sn = Math.sin(me.yaw), cs = Math.cos(me.yaw), wx = ix * cs + iz * sn, wz = -ix * sn + iz * cs, ctl = me.ground ? 12 : 3;
  me.vx = lerp(me.vx, wx * speed, Math.min(1, dt * ctl)); me.vz = lerp(me.vz, wz * speed, Math.min(1, dt * ctl));
  me.x += me.vx * dt; me.z += me.vz * dt;
  if (!frozen && keys.Space && me.ground && !crouch && me.stun <= 0) { me.vy = 6.2; me.ground = false; SFX.jump(); }
  me.vy -= 20 * dt; me.y += me.vy * dt; if (me.y <= 0) { if (!me.ground && me.vy < -3) SFX.step(); me.y = 0; me.vy = 0; me.ground = true; }
  collide(me, world.solids, .35);
  app.roster.forEach(r => { if (r.id === app.me.id || !r.pos || escaped(r.id)) return; const dx = me.x - r.pos.x, dz = me.z - r.pos.z, d = Math.hypot(dx, dz); if (d > 0 && d < .7) { me.x += dx / d * (.7 - d); me.z += dz / d * (.7 - d); } });
  me.h = lerp(me.h, crouch ? 1.15 : 1.75, Math.min(1, dt * 12));
  const sp = Math.hypot(me.vx, me.vz);
  if (sp > .5 && me.ground) { me.bob += dt * sp * 2.2; me.stepT -= dt * sp; if (me.stepT <= 0) { me.stepT = 1.9; SFX.step(); } }
  const bob = Math.sin(me.bob) * .045 * Math.min(1, sp / 4), shake = me.stun > 0 ? (Math.random() - .5) * .04 : 0;
  camera.position.set(me.x, me.y + me.h - .12 + bob, me.z); camera.rotation.set(me.pitch + shake, me.yaw + shake, 0);
  flash.visible = me.fl && !me.jailed; flash.intensity = 30 * flicker(nearestSentry(me.x, me.z));
  $('stamI').style.width = me.stam + '%'; $('stam').style.opacity = me.stam < 99 ? 1 : 0;
}
// caught: stare into its face, then wake up in the jail
function scareCam(dt) {
  const sc = app.scare, V = app.sentries[sc.by], since = performance.now() - sc.at;
  if (V) { const px = V.rx + Math.sin(V.rf) * .7, pz = V.rz + Math.cos(V.rf) * .7, fy = Math.max(.5, V.face * .95); camera.position.set(px + (Math.random() - .5) * .05, fy + (Math.random() - .5) * .05, pz); camera.lookAt(V.rx, fy, V.rz); poseCreature(V, 0, 'scream', dt, performance.now() / 1000); flash.visible = true; flash.intensity = 40 * (Math.random() < .5 ? 1 : .1); }
  if (since > 1300) { app.scare = null; $('chomp').hidden = true; const order = [...app.roster.values()].sort((a, b) => a.joinedAt - b.joinedAt).map(r => r.id); const j = app.A.jail.spots[Math.max(0, order.indexOf(app.me.id)) % app.A.jail.spots.length]; me.x = j.x; me.z = j.z; me.y = 0; me.vx = me.vz = 0; me.jailed = true; me.yaw = 0; me.pitch = 0; toast('You are locked in the jail. Your crew can pick the lock, if they want to.'); }
}
// a hidden monster leaps into your face and screams
function startJump(V, temp) {
  if (app.jump || myOut()) { if (temp) world.root.remove(V.g); return; }
  app.jump = { at: performance.now(), V, temp }; V.g.visible = true; SFX.scream(1); hurt(); me.fl = true; app.holdT = 0;
}
function jumpCam(dt, t) {
  const J = app.jump, V = J.V, e = (performance.now() - J.at) / 1000, fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  const dist = e < .16 ? lerp(1.8, .5, e / .16) : e < 1.2 ? .5 + Math.sin(e * 30) * .03 : .5 + (e - 1.2) * 6;
  const camY = me.y + me.h - .12;
  V.g.position.set(me.x + fx * dist, Math.max(0, camY - V.face + .02), me.z + fz * dist); V.g.rotation.y = me.yaw; V.g.scale.setScalar(e < 1.2 ? 1.05 : Math.max(.01, 1.05 - (e - 1.2) * 2));
  poseCreature(V, 0, 'scream', dt, t);
  camera.position.set(me.x + (Math.random() - .5) * .06, camY + (Math.random() - .5) * .06, me.z); camera.rotation.set(me.pitch * .3, me.yaw, (Math.random() - .5) * .08);
  flash.visible = true; flash.intensity = 30 * (Math.random() < .55 ? 1 : .05);
  if (e > 1.7) { if (J.temp) world.root.remove(V.g); else V.g.visible = false; app.jump = null; me.stun = Math.max(me.stun, .8); }
}
function spectate(dt) {
  const S = app.S, living = [...app.roster.values()].filter(r => r.id !== app.me.id && r.pos && !escaped(r.id));
  $('spec').hidden = false; flash.visible = false;
  if (living.length) {
    const r = living[app.specIdx % living.length], p = r.pos; setText('spec', `You escaped with ${money(S.escaped[app.me.id])}. Watching ${r.name} · click to switch · only other escaped players can hear you`);
    camera.position.lerp(new THREE.Vector3(p.x, p.y + (p.h || 1.75) - .12, p.z), Math.min(1, dt * 10)); camera.rotation.set(p.pitch, p.yaw, 0);
  } else { setText('spec', `You escaped with ${money(S.escaped[app.me.id])}.`); const z = app.A.room.exitZone; camera.position.set((z.x0 + z.x1) / 2, 1.6, (z.z0 + z.z1) / 2); }
}

/* ---------------- results ---------------- */
function showResults() {
  const S = app.S; if (document.pointerLockElement) document.exitPointerLock(); $('menu').hidden = true; resultsButtons();
  const list = [...app.roster.values()].sort((a, b) => (S.escaped[b.id] ?? -1) - (S.escaped[a.id] ?? -1));
  const out = list.filter(r => escaped(r.id)).length;
  $('resTitle').textContent = out === list.length ? 'Everyone got out' : out ? `${out} of ${list.length} escaped` : 'Nobody escaped';
  $('resList').innerHTML = list.map(r => { const e = escaped(r.id); return `<div class="res-row${e ? '' : ' lost'}"><span class="dot" style="background:${r.color};width:12px;height:12px;border-radius:50%"></span><span class="nm">${esc(r.name)}${r.id === app.me.id ? ' (you)' : ''}</span><span class="tag">${e ? 'escaped' : 'left in the jail'}</span><b>${e ? money(S.escaped[r.id]) : '$0'}</b></div>`; }).join('');
  const mineE = escaped(app.me.id);
  $('resText').textContent = mineE ? `${money(S.escaped[app.me.id])} went into your wallet. You now have ${money(profile().wallet)} to spend in the shop.` : "You didn't make it out, so you kept nothing this round.";
  walletText(); $('results').hidden = false;
}

/* ---------------- frame ---------------- */
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, clock.getDelta()), t = performance.now() / 1000;
  let intensity = 0;
  if (inGame()) {
    if (isHost()) hostTick(dt);
    const S = app.S, A = app.A, now = net.now();
    processEvents();
    // monsters
    let best = 1e9, bi = -1;
    (S.sentries || []).forEach((s, i) => { const V = app.sentries[i]; if (!V) return; if (!(app.scare && app.scare.by === i)) animSentry(V, s, dt, t); const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < best) { best = d; bi = i; } if (s.st === 'hunt' && app.prevSt[i] !== 'hunt' && d < 12) SFX.screech(); app.prevSt[i] = s.st; });
    if (bi >= 0 && !myOut()) {
      const s = S.sentries[bi]; app.growlT -= dt; app.clickT -= dt;
      if (s.st === 'hunt' && best < 12 && app.growlT <= 0) { app.growlT = 1.6 + Math.random() * 2; SFX.growl(1 - best / 12); }
      if (best < 15 && app.clickT <= 0 && !app.jump) { app.clickT = s.st === 'hunt' ? .14 + Math.random() * .1 : .5 + best * .06 + Math.random() * .4; const ang = Math.atan2(s.x - me.x, s.z - me.z) - (me.yaw + Math.PI); click((1 - best / 15) * .22, -Math.sin(ang)); }
      intensity = clamp(1 - best / 16, 0, 1) * (s.st === 'hunt' ? 1 : .6);
    }
    // hidden monsters
    for (const i in (S.lurk || {})) { if (app.lurkSeen[i]) continue; app.lurkSeen[i] = 1; const L = S.lurk[i], V = app.lurkV[i], l = A.lurkers[i]; if (!V) continue;
      if (L.by === app.me.id) startJump(V, false); else { const v = distVol(l.x, l.z); if (v > 0) SFX.scream(v * .7); V.g.visible = true; V.leap = performance.now(); V.leapTo = (app.roster.get(L.by) || {}).pos; } }
    app.lurkV.forEach(V => { if (!V.leap || app.jump?.V === V) return; const e = (performance.now() - V.leap) / 1000; if (e > 2) { V.g.visible = false; V.leap = 0; return; } if (V.leapTo) { V.g.position.x = lerp(V.g.position.x, V.leapTo.x, Math.min(1, dt * 6)); V.g.position.z = lerp(V.g.position.z, V.leapTo.z, Math.min(1, dt * 6)); } poseCreature(V, 0, 'scream', dt, t); });
    { let dl = 1e9; A.lurkers.forEach((l, i) => { if (!(S.lurk || {})[i]) dl = Math.min(dl, Math.hypot(l.x - me.x, l.z - me.z)); }); creepUpdate(dt, myOut() ? 0 : intensity, myOut() ? 0 : clamp(1 - dl / 7, 0, 1)); }
    // jail
    const J = S.jailed || {};
    if (me.jailed && !J[app.me.id]) { me.jailed = false; const o = A.jail.out; me.x = o.x + (Math.random() - .5) * 2; me.z = o.z + Math.random() * .6; }
    if (myOut()) spectate(dt); else { $('spec').hidden = true; if (app.jump) jumpCam(dt, t); else if (app.scare) scareCam(dt); else updateMe(dt); }
    world.update(dt, t, false);
    A.render(dt, S, { now });
    if (!myOut()) updateInteract(dt); else { $('prompt').hidden = true; $('ring').hidden = true; }
    // banking
    if (escaped(app.me.id) && app.bankedKey !== app.cfg.key) { app.bankedKey = app.cfg.key; bank(S.escaped[app.me.id]); }
    // HUD
    const m = (S.money || {})[app.me.id] || 0; setText('hMoney', money(myOut() ? S.escaped[app.me.id] : m));
    if (m < app.moneyShown) { const el = $('hMoney').parentElement; el.classList.add('lost'); setTimeout(() => el.classList.remove('lost'), 1500); } app.moneyShown = m;
    setText('hKeys', `Keys ${S.keys || 0} · Safes ${Object.keys(S.safesOpen || {}).length}/${A.safes.length}`);
    setText('hClue', ((S.clue || {})[app.me.id] || '____').split('').join(' '));
    setText('hObj', now < app.cfg.startAt ? `Get ready… ${Math.ceil((app.cfg.startAt - now) / 1000)}` : me.jailed ? 'You are in the jail. A teammate can pick the lock from outside.' : A.objective(S, app.me.id));
    if (S.screen && S.screen.type === 'results' && app.shownResults !== app.cfg.key) { app.shownResults = app.cfg.key; showResults(); }
    if (!S.screen) $('results').hidden = true;
    if (performance.now() - app.lastPos > 66) { app.lastPos = performance.now(); if (!myOut() && !app.scare) net.send({ t: 'pos', p: { x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), h: +me.h.toFixed(2), fl: me.fl && !me.jailed } }); }
    renderRoster();
  } else if (app.view === 'home' || app.view === 'lobby') {
    menuScene(dt, t); intensity = .15;
  }
  if (music) music.setIntensity(intensity);
  updateAvatars(dt);
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  voice.update({ x: camera.position.x, y: camera.position.y, z: camera.position.z, fx: fwd.x, fy: fwd.y, fz: fwd.z }, myOut(), id => {
    const r = app.roster.get(id); if (!r || !r.pos || !inGame()) return null;
    return { x: r.pos.x, y: r.pos.y + (r.pos.h || 1.75) - .2, z: r.pos.z, eaten: escaped(id), blocked: wallBetween(me.x, me.z, r.pos.x, r.pos.z, world.solids) };
  }, !inGame());
  const lvl = Math.min(100, voice.micLevel() * 600); $('hudMeter').style.width = lvl + '%'; $('lobbyMeter').style.width = lvl + '%';
  if (app.view === 'lobby') app.roster.forEach(r => { const el = $('lp-' + r.id); if (el) el.classList.toggle('talk', r.id === app.me.id ? lvl > 12 : voice.talking(r.id)); });
  renderer.render(scene, camera);
}
let rosterHtml = '';
function renderRoster() {
  const S = app.S; const html = [...app.roster.values()].sort((a, b) => a.joinedAt - b.joinedAt).map(r => {
    const out = escaped(r.id), jailed = (S.jailed || {})[r.id], talk = r.id === app.me.id ? voice.micLevel() > .02 : voice.talking(r.id);
    return `<div class="rp${out ? ' out' : ''}${talk ? ' talk' : ''}"><span class="dot" style="background:${r.color}"></span>${esc(r.id === app.me.id ? r.name + ' (you)' : r.name)}${r.id === app.hostId ? ' · host' : ''}${jailed ? ' · in jail' : ''}${out ? ` · escaped ${money(S.escaped[r.id])}` : ''}</div>`;
  }).join('');
  if (html !== rosterHtml) { rosterHtml = html; $('roster').innerHTML = html; }
}

// The title screen: three of them, half lit by a dying lamp.
let menu = null;
function menuScene(dt, t) {
  if (!menu) {
    world.clear();
    const f = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x1a1620, roughness: .9 })); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; world.root.add(f);
    const lamp = new THREE.SpotLight(0xffd8a0, 40, 14, .7, .6, 1.3); lamp.position.set(1.5, 4.5, 3); lamp.target.position.set(0, .8, 0); lamp.castShadow = true; world.root.add(lamp); world.root.add(lamp.target);
    const crew = CREATURE_KINDS.map((k, i) => { const V = makeCreature(world.root, k); V.g.position.set(-1.6 + i * 1.6, 0, -(i % 2) * .8); V.g.rotation.y = .25 - i * .25; return V; });
    menu = { lamp, crew };
  }
  flash.visible = false;
  camera.position.set(Math.sin(t * .08) * 1.2 + 1.2, 1.5, 5.2); camera.lookAt(0, 1.1, 0);
  menu.lamp.intensity = 40 * (Math.random() < .04 ? .1 : 1);
  menu.crew.forEach((V, i) => poseCreature(V, 0, Math.sin(t * .5 + i * 2) > .7 ? 'hunt' : 'calm', dt, t));
}
show('home'); frame();
