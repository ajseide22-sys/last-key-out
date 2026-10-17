// Last Key Out — client. First-person controls, host-authoritative game loop, avatars, proximity voice and chat.
import * as THREE from 'three';
import { Net } from './net.js';
import { Voice } from './voice.js';
import { World, collide, wallBetween, clamp, lerp } from './world.js';
import { BUILDERS, DIFF, AREA_NAMES, ROOMS } from './areas.js';
import { makeSentry, animSentry, makeCreature, poseCreature, CREATURE_KINDS } from './sentry.js';
import { makeMonster, animMonster, stepMonster } from './monster.js';
import { toon, outline } from './props.js';

const $ = id => document.getElementById(id);
function lockMouse() { try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
const store = { get(k, d) { try { const v = localStorage.getItem('lko.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('lko.' + k, JSON.stringify(v)); } catch (e) { } } };
const settings = { vol: store.get('vol', 1), bright: store.get('bright', 1.3), sens: store.get('sens', 1) };

/* ---------------- renderer ---------------- */
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.LinearToneMapping; renderer.toneMappingExposure = settings.bright;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.Fog(0x000000, 16, 46);
const camera = new THREE.PerspectiveCamera(72, 1, .05, 140); camera.rotation.order = 'YXZ'; scene.add(camera);
const hemi = new THREE.HemisphereLight(0x9a88c8, 0x221830, .7); scene.add(hemi);
const flash = new THREE.SpotLight(0xfff1d6, 30, 26, .55, .45, 1.4); flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); flash.shadow.bias = -.0006; flash.shadow.camera.near = .2;
flash.position.set(.25, -.2, 0); camera.add(flash); camera.add(flash.target); flash.target.position.set(0, -.15, -1);
const world = new World(scene);
// Teammates' flashlights are real lights too: a fixed pool so shaders never recompile mid-game.
const remoteLights = Array.from({ length: 7 }, () => { const L = new THREE.SpotLight(0xfff1d6, 0, 24, .5, .5, 1.4); scene.add(L); scene.add(L.target); return L; });
function darkness(on) {
  if (on) { hemi.color.set(0x6a5a90); hemi.intensity = 0; scene.fog.near = 8; scene.fog.far = 30; camera.far = 34; }
  else { hemi.color.set(0x9a88c8); hemi.intensity = .7; scene.fog.near = 16; scene.fog.far = 46; camera.far = 140; }
  camera.updateProjectionMatrix();
}
// Flashlights stutter when a sentry is close. Returns a brightness multiplier.
function flicker(d) { if (d > 11) return 1; const p = 1 - d / 11; if (Math.random() < p * p * .6) return Math.random() * .2; return 1 - p * .35 * Math.random(); }
function nearestSentry(x, z) { const ss = app.S && app.S.sentries; if (!ss) return 1e9; let b = 1e9; for (const s of ss) { const d = Math.hypot(s.x - x, s.z - z); if (d < b) b = d; } return b; }
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ---------------- audio ---------------- */
let AC = null, sfxOut = null;
const net = new Net(), voice = new Voice(net);
function audioInit() {
  if (AC) { AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); sfxOut = AC.createGain(); sfxOut.gain.value = .45; sfxOut.connect(AC.destination); voice.attach(AC); voice.setVolume(settings.vol); creepInit(); } catch (e) { AC = null; }
}
function tone(f, d, type, v, delay, slide) { if (!AC) return; const t = AC.currentTime + (delay || 0); const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v || .2, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(sfxOut); o.start(t); o.stop(t + d + .05); }
// Creepy bed that swells as monsters get close: a low drone, ragged breathing and a heartbeat.
const creep = { on: false };
function creepInit() {
  if (!AC || creep.on) return; creep.on = true;
  const out = AC.createGain(); out.gain.value = 1; out.connect(sfxOut);
  const dg = AC.createGain(); dg.gain.value = 0; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.connect(dg); dg.connect(out);
  [43, 45.5, 61].forEach(f => { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); });
  const len = AC.sampleRate * 2, b = AC.createBuffer(1, len, AC.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = b; src.loop = true; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.4; const bg = AC.createGain(); bg.gain.value = 0; src.connect(bp); bp.connect(bg); bg.connect(out); src.start();
  Object.assign(creep, { dg, bg, beatT: 0, breathPh: 0 });
}
function creepUpdate(dt, intensity, breath) {
  if (!creep.on) return; const t = AC.currentTime;
  creep.dg.gain.setTargetAtTime(.22 * intensity, t, .3);
  creep.breathPh += dt * (1.2 + intensity * 1.6); const inhale = Math.max(0, Math.sin(creep.breathPh));
  creep.bg.gain.setTargetAtTime(Math.max(breath, intensity * .6) * .22 * inhale, t, .08);
  creep.beatT -= dt; const level = Math.max(intensity, breath * .8);
  if (level > .3 && creep.beatT <= 0) { creep.beatT = 1.05 - level * .6; tone(55, .12, 'sine', .35 * level); tone(48, .14, 'sine', .28 * level, .17); }
}
function click(vol, pan) { if (!AC) return; const t = AC.currentTime; const o = AC.createOscillator(), g = AC.createGain(), pn = AC.createStereoPanner ? AC.createStereoPanner() : null; o.type = 'square'; o.frequency.setValueAtTime(2800 + Math.random() * 1500, t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .03); o.connect(g); if (pn) { pn.pan.value = clamp(pan, -1, 1); g.connect(pn); pn.connect(sfxOut); } else g.connect(sfxOut); o.start(t); o.stop(t + .05); }
function noise(d, v, ff, delay) { if (!AC) return; const t = AC.currentTime + (delay || 0); const len = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, len, AC.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = ff || 800; const g = AC.createGain(); g.gain.setValueAtTime(v || .2, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(f); f.connect(g); g.connect(sfxOut); s.start(t); }
const SFX = {
  key() { [660, 880, 1320].forEach((f, i) => tone(f, .2, 'triangle', .22, i * .07)); }, empty() { tone(150, .18, 'sine', .22); noise(.12, .1, 500); },
  door() { noise(1, .22, 500); tone(95, .9, 'sawtooth', .1, 0, 55); [392, 523].forEach((f, i) => tone(f, .3, 'triangle', .15, .5 + i * .12)); }, locked() { tone(220, .08, 'square', .12); tone(180, .12, 'square', .12, .09); },
  tick() { tone(1800, .04, 'square', .07); }, wrong() { tone(190, .4, 'sawtooth', .2, 0, 90); }, good(i) { tone(392 * Math.pow(1.122, i), .25, 'triangle', .22); }, plate() { tone(440, .08, 'sine', .12); },
  hit() { noise(.22, .35, 1400); tone(220, .2, 'square', .13, 0, 70); }, roar() { tone(65, 1.8, 'sawtooth', .35, 0, 32); tone(98, 1.5, 'sawtooth', .22, .06, 40); noise(1.6, .35, 450); },
  chomp() { noise(.18, .55, 2200); tone(130, .2, 'square', .3, 0, 45); }, win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .32, 'triangle', .22, i * .11)); },
  trap() { tone(900, .08, 'square', .14); tone(1250, .08, 'square', .14, .09); noise(.3, .2, 3500, .05); }, step() { noise(.05, .04, 300); }, jump() { tone(300, .1, 'sine', .06, 0, 420); },
  screech() { tone(1400, .7, 'sawtooth', .28, 0, 380); tone(2100, .5, 'square', .12, .05, 700); noise(.8, .45, 5000); },
  lockpick() { tone(2400, .03, 'square', .05); }, unlock() { tone(600, .1, 'square', .14); tone(900, .16, 'triangle', .18, .1); noise(.3, .15, 2000, .05); },
  lava() { noise(.5, .3, 600); tone(120, .5, 'sawtooth', .15, 0, 50); },
  scream(v = 1) { tone(900, 1.1, 'sawtooth', .32 * v, 0, 260); tone(1350, .9, 'square', .14 * v, .03, 420); tone(620, 1.2, 'sawtooth', .2 * v, .05, 180); noise(1.1, .5 * v, 4200); },
  growl(v = 1) { tone(70 + Math.random() * 20, .7, 'sawtooth', .18 * v, 0, 45); noise(.6, .12 * v, 300); },
  burn() { noise(.6, .4, 2500); tone(300, .3, 'sawtooth', .12, 0, 120); }, zap() { tone(1800, .25, 'square', .16, 0, 300); noise(.15, .3, 6000); }
};

/* ---------------- app state ---------------- */
const app = { me: null, room: null, hostId: null, roster: new Map(), view: 'home', diff: 'easy', cfg: null, S: null, A: null, fresh: false, M: null, monsterShown: false, eatenAt: 0, specIdx: 0, noteCode: null, lastSnap: 0, lastPos: 0, lastTick: -1, shownScreen: null, pending: new Map(), holdT: 0, mic: { on: false, muted: false }, sentries: [], lurkV: [], jump: null, lurkSeen: {}, growlT: 0, scare: null, lastCaught: 0, lastFreed: 0, clickT: 0, prevSt: [] };
const me = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, h: 1.75, stam: 100, stun: 0, inv: 0, ck: { x: 0, z: 0, y: 0 }, fl: true, eaten: false, jailed: false, ground: true, plat: null, bob: 0, stepT: 0 };
const isHost = () => app.me && app.hostId === app.me.id;
const nameOf = id => id === app.me?.id ? 'You' : (app.roster.get(id)?.name || 'Someone');
const colorOf = id => app.roster.get(id)?.color || '#f1e8da';
const inGame = () => app.view === 'game' && app.A && app.S;
function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ---------------- UI helpers ---------------- */
let toastT; function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); }
let bannerT; function banner(a, b, red, dur) { $('bn1').textContent = a; $('bn2').textContent = b; $('banner').classList.toggle('red', !!red); $('banner').classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => $('banner').classList.remove('show'), dur || 2400); }
function hurt() { const h = $('hurt'); h.style.opacity = 1; setTimeout(() => h.style.opacity = 0, 160); }
function show(view) {
  app.view = view;
  $('home').hidden = view !== 'home'; $('lobby').hidden = view !== 'lobby';
  const g = view === 'game'; $('hud').hidden = !g; $('cross').hidden = !g; $('stam').hidden = !g;
  if (!g) { ['prompt', 'ring', 'lockhint', 'spec', 'notecard', 'chomp', 'menu', 'keypad', 'over', 'done'].forEach(id => $(id).hidden = true); $('redwash').classList.remove('on'); }
}
function fadeDo(fn) { $('fade').classList.add('on'); setTimeout(() => { fn(); setTimeout(() => $('fade').classList.remove('on'), 80); }, 360); }
const cache = {}; function setText(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }

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
  try { if (!net.open) await net.connect(); net.send({ t: 'join', create, room: code, name }); }
  catch (e) { homeErr(e.message + ' Is the server running?'); $('createBtn').disabled = $('joinBtn').disabled = false; }
}
$('createBtn').onclick = () => joinRoom(true);
$('joinBtn').onclick = () => joinRoom(false);
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(false); });
$('copyBtn').onclick = () => { const link = location.origin + location.pathname + '?room=' + app.room; navigator.clipboard?.writeText(link).then(() => toast('Invite link copied.'), () => toast(link)); };
$('leaveLobby').onclick = $('leaveBtn').onclick = () => { net.close(); voice.closeAll(); location.href = location.pathname; };
function renderDiffs() {
  $('diffs').innerHTML = Object.entries(DIFF).map(([k, d]) => `<button type="button" id="df-${k}" data-d="${k}" aria-pressed="${app.diff === k}" ${isHost() ? '' : 'disabled'}><span class="dn">${d.label}</span><span class="dt">${fmt(d.time)}</span><span class="db">${d.blurb}</span></button>`).join('');
}
$('diffs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !isHost()) return; app.diff = b.dataset.d; renderDiffs(); net.send({ t: 'bcast', e: { type: 'lobby', diff: app.diff } }); });
function renderLobby() {
  setText('roomCode', app.room || '----');
  $('inviteText').textContent = `Friends open ${location.host}/?room=${app.room} or type the code ${app.room}. Up to 8 players.`;
  const list = [...app.roster.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  $('lobbyList').innerHTML = list.map(p => `<div class="pl" id="lp-${p.id}"><span class="dot" style="background:${p.color}"></span><span class="nm">${esc(p.name)}${p.id === app.me.id ? ' (you)' : ''}</span><span class="tag">${p.meta?.mic ? (p.meta.muted ? 'muted' : 'mic on') : 'no mic'}</span>${p.id === app.hostId ? '<span class="tag host">Host</span>' : ''}</div>`).join('');
  renderDiffs();
  $('startBtn').hidden = !isHost(); $('startBtn').textContent = 'Start level 1';
  $('startNote').textContent = isHost() ? `${list.length} player${list.length === 1 ? '' : 's'} ready. Rooms grow with every player who joins.` : 'Waiting for the host to start the game.';
  $('diffLabel').textContent = 'Difficulty · time per room' + (isHost() ? '' : ' (host picks)');
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
  net.send({ t: 'meta', meta: { mic: voice.micOn, muted: voice.muted } });
  if (app.me) { const r = app.roster.get(app.me.id); if (r) r.meta = { mic: voice.micOn, muted: voice.muted }; }
  micButtons(); if (app.view === 'lobby') renderLobby();
}
$('micBtn').onclick = micToggle; $('menuMic').onclick = () => { if (!voice.micOn) micToggle(); else micToggle(); };
$('menuMute').onclick = () => { if (voice.micOn) micToggle(); };
$('startBtn').onclick = () => { if (isHost()) { audioInit(); hostStart(1, 0); } };

/* ---------------- network handlers ---------------- */
function addRoster(p) {
  if (app.roster.has(p.id)) return; const r = Object.assign({ pos: null, meta: {}, av: null, tag: null, bubble: null }, p); app.roster.set(p.id, r);
  if (app.me && p.id !== app.me.id) { r.av = makeAvatar(r.color); scene.add(r.av.g); r.tag = document.createElement('div'); r.tag.className = 'ntag'; $('tags').appendChild(r.tag); voice.addPeer(p.id); }
}
function removeRoster(id) { const r = app.roster.get(id); if (!r) return; if (r.av) scene.remove(r.av.g); if (r.tag) r.tag.remove(); app.roster.delete(id); voice.removePeer(id); }
net.on('welcome', m => {
  app.me = { id: m.id }; app.room = m.room; app.hostId = m.hostId; voice.myId = m.id; voice.ice = m.iceServers || voice.ice;
  history.replaceState(null, '', '?room=' + m.room);
  m.players.forEach(addRoster);
  $('createBtn').disabled = $('joinBtn').disabled = false;
  if (m.screen === 'game' && m.area) { applyArea(m.area.cfg, m.snap && m.snap.S && m.snap.S.key === m.area.cfg.key ? m.snap.S : null); }
  else { show('lobby'); renderLobby(); }
});
net.on('error', m => { homeErr(m.msg); $('createBtn').disabled = $('joinBtn').disabled = false; });
net.on('peer-join', m => {
  addRoster(m.player); toast(`${m.player.name} joined.`);
  if (isHost()) net.send({ t: 'bcast', e: { type: 'lobby', diff: app.diff } });
  if (voice.micOn) net.send({ t: 'meta', meta: { mic: true, muted: voice.muted } });
  if (app.view === 'lobby') renderLobby();
});
net.on('peer-leave', m => {
  const n = app.roster.get(m.id)?.name; removeRoster(m.id); const wasHost = isHost(); app.hostId = m.hostId;
  toast(`${n || 'A player'} left.` + (!wasHost && isHost() ? ' You are the host now.' : ''));
  if (app.view === 'lobby') renderLobby(); if (isHost()) showEndButtons();
});
net.on('pos', m => { const r = app.roster.get(m.id); if (r) { r.pos = m.p; r.posAt = performance.now(); } });
net.on('meta', m => { const r = app.roster.get(m.id); if (r) { r.meta = m.meta || {}; if (app.view === 'lobby') renderLobby(); } });
net.on('rtc', m => voice.signal(m.from, m.data));
net.on('say', m => showSay(m.id, m.text));
net.on('fromguest', m => { if (isHost() && inGame()) handleRequest(m.from, m.e); });
net.on('bcast', m => {
  const e = m.e; if (!e) return;
  if (e.type === 'area') applyArea(e.cfg, null);
  else if (e.type === 'snap') { if (!isHost() && app.cfg && e.S.key === app.cfg.key) app.S = e.S; }
  else if (e.type === 'lobby') { app.diff = e.diff; if (app.view === 'lobby') renderDiffs(); }
  else if (e.type === 'screen' && e.screen === 'lobby') goLobby();
});
net.on('close', () => { show('home'); homeErr('Lost connection to the game server.'); app.roster.forEach((r, id) => removeRoster(id)); world.clear(); app.A = app.S = null; });

/* ---------------- areas ---------------- */
function initS(cfg) { const S = { key: cfg.key, phase: 'play', penalty: 0, eaten: {}, lost: {}, monster: null, screen: null, clearAt: 0 }; (cfg.lost || []).forEach(id => { S.eaten[id] = true; S.lost[id] = true; }); app.A.init(S); return S; }
function applyArea(cfg, S) {
  const doIt = () => {
    world.clear(); app.M = null; app.monsterShown = false; app.shownScreen = null; app.noteCode = null; app.pending.clear(); app.lastTick = -1;
    darkness(true); app.scare = null; app.lastCaught = 0; app.lastFreed = 0; app.prevSt = [];
    app.cfg = cfg; app.A = BUILDERS[cfg.idx](world, cfg); app.S = S || initS(cfg); app.fresh = false;
    app.sentries = Array.from({ length: app.A.sentryCount || 0 }, (_, i) => makeSentry(world.root, i)); app.jump = null; app.lurkSeen = {};
    app.lurkV = (app.A.lurkers || []).map(l => { const V = makeCreature(world.root, l.kind); V.g.visible = false; V.g.position.set(l.x, 0, l.z); V.g.rotation.y = l.f; return V; });
    const order = [...app.roster.values()].sort((a, b) => a.joinedAt - b.joinedAt).map(r => r.id);
    const sp = app.A.spawn[Math.max(0, order.indexOf(app.me.id)) % app.A.spawn.length];
    Object.assign(me, { x: sp.x, y: sp.y || 0, z: sp.z, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: -.05, stun: 0, inv: 0, ck: { x: sp.x, z: sp.z, y: sp.y || 0 }, eaten: !!app.S.eaten[app.me.id], jailed: false, plat: null, ground: true, stam: 100, fl: true });
    if (app.S.jailed && app.S.jailed[app.me.id]) { const j = app.A.jail.spots[0]; me.x = j.x; me.z = j.z; me.jailed = true; }
    show('game'); $('over').hidden = $('done').hidden = $('menu').hidden = $('keypad').hidden = true; $('notecard').hidden = true; $('chomp').hidden = true;
    setText('hLevel', `Level ${cfg.level} · Room ${cfg.idx + 1} of ${ROOMS} · ${DIFF[cfg.diff].label}`); setText('hArea', app.A.name);
    banner(`Level ${cfg.level} · Room ${cfg.idx + 1} of ${ROOMS}`, app.A.name, false, 2600);
    if (app.S.lost[app.me.id]) toast('Your crew left you in the jail. You can watch, and you are back next level.');
    if (document.pointerLockElement !== canvas) $('lockhint').hidden = false;
  };
  if (app.view === 'game') fadeDo(doIt); else doIt();
}
function hostStart(level, idx, lost = []) {
  const cfg = { key: Math.random().toString(36).slice(2, 9), level, idx, diff: app.diff, lost, n: Math.max(1, app.roster.size), seed: (Math.random() * 2147483647) | 0, startAt: net.now() + 2800, dur: DIFF[app.diff].time };
  net.send({ t: 'bcast', e: { type: 'area', cfg } }); applyArea(cfg, null);
}
function goLobby() { if (creep.on) creepUpdate(0, 0, 0); world.clear(); darkness(false); app.A = app.S = app.cfg = null; app.M = null; app.sentries = []; if (document.pointerLockElement) document.exitPointerLock(); show('lobby'); renderLobby(); }
function timeLeft() { if (!app.cfg || !app.S) return 0; const el = Math.max(0, (net.now() - app.cfg.startAt) / 1000); return app.cfg.dur - el - (app.S.penalty || 0); }
function inZone(p, z) { return p.x > z.x0 && p.x < z.x1 && p.z > z.z0 && p.z < z.z1 && (z.y0 === undefined || p.y > z.y0); }
function allPlayers() {
  const S = app.S, J = S.jailed || {}, list = [{ id: app.me.id, x: me.x, y: me.y, z: me.z, yaw: me.yaw, fl: me.fl && !me.jailed, eaten: !!S.eaten[app.me.id], jailed: !!J[app.me.id] }];
  app.roster.forEach(r => { if (r.id !== app.me.id && r.pos) list.push({ id: r.id, x: r.pos.x, y: r.pos.y, z: r.pos.z, yaw: r.pos.yaw, fl: !!r.pos.fl, eaten: !!S.eaten[r.id], jailed: !!J[r.id] }); });
  return list;
}
function exitText() { if (!app.S) return ''; const ps = allPlayers().filter(p => !p.eaten && !p.jailed); return `At exit ${ps.filter(p => inZone(p, app.A.room.exitZone)).length}/${ps.length}`; }
function handleRequest(from, e) { if (!app.S || app.S.phase !== 'play') return; app.A.request(app.S, from, e, { now: net.now() }); app.lastSnap = 0; }
function sendReq(e) { if (isHost()) handleRequest(app.me.id, e); else net.send({ t: 'tohost', e }); }

function hostTick(dt) {
  const S = app.S, A = app.A, now = net.now();
  if (!S.screen) {
    const ctx = { players: allPlayers(), now };
    if (S.phase === 'play') {
      if (now >= app.cfg.startAt - 500) A.hostUpdate(dt, S, ctx);
      if (timeLeft() <= 0) { S.phase = 'monster'; S.monster = { x: 0, z: A.D / 2 + 2.5, face: Math.PI, open: .6, chew: 0, wait: 1.4, moving: false, at: now }; }
      else {
        const free = ctx.players.filter(p => !p.eaten && !p.jailed);
        if (!free.length && ctx.players.some(p => p.jailed)) { S.screen = { type: 'over', reason: 'jail' }; }
        else if (A.exitOpen(S) && free.length && free.every(p => inZone(p, A.room.exitZone))) { S.phase = 'clear'; S.clearAt = now; S.leftBehind = ctx.players.filter(p => p.jailed).map(p => p.id); }
      }
    } else if (S.phase === 'clear') {
      if (now - S.clearAt > 1000) { if (app.cfg.idx < ROOMS - 1) { S.phase = 'switching'; hostStart(app.cfg.level, app.cfg.idx + 1, [...new Set([...(app.cfg.lost || []), ...(S.leftBehind || [])])]); return; } S.screen = { type: 'done', level: app.cfg.level }; }
    } else if (S.phase === 'monster') {
      const ate = stepMonster(S.monster, dt, ctx.players, (now - S.monster.at) / 1000);
      if (ate) S.eaten[ate] = true;
      if (!ctx.players.some(p => !p.eaten && !S.eaten[p.id])) { if (!S.allEatenAt) S.allEatenAt = now; else if (now - S.allEatenAt > 2200) S.screen = { type: 'over', reason: 'monster' }; }
    }
  }
  const rate = S.phase === 'monster' ? 50 : 100;
  if (now - app.lastSnap > rate) { app.lastSnap = now; net.send({ t: 'bcast', e: { type: 'snap', S } }); }
}

/* ---------------- effects from shared state ---------------- */
function fx(type, d = {}) {
  const mine = d.by === app.me.id;
  switch (type) {
    case 'key': SFX.key(); toast(`${nameOf(d.by)} found a key! ${app.S.found}/${app.S.need}`); break;
    case 'empty': if (mine) { SFX.empty(); toast('Nothing here.'); } break;
    case 'fake': if (mine) { SFX.empty(); toast('A rusty fake key. It crumbles to dust.'); } break;
    case 'trap': if (mine) { SFX.trap(); me.stun = 1.6; hurt(); toast('A rat jumped out! You are stunned.'); } break;
    case 'note': if (mine) { SFX.key(); app.noteCode = d.code; $('noteCode').textContent = d.code; $('notecard').hidden = false; toast('You found the safe code. Only you can see it!'); } else toast(`${nameOf(d.by)} found a note. Ask them for the code!`); break;
    case 'door': SFX.door(); toast('A door opened. Everyone into the exit!'); break;
    case 'safeWrong': SFX.wrong(); toast('Wrong safe code.'); break;
    case 'plate': SFX.plate(); break;
    case 'rune': SFX.good(d.i); break;
    case 'wrong': SFX.wrong(); toast('Wrong rune. Watch the crystal again.'); break;
    case 'checkpoint': SFX.good(4); toast('Checkpoint reached.'); break;
    case 'smack': SFX.hit(); hurt(); respawn(); toast('Smacked off! Back to your checkpoint.'); break;
    case 'fell': SFX.lava(); hurt(); respawn(); toast('Into the lava. Back to your last checkpoint.'); break;
    case 'burn': SFX.burn(); hurt(); respawn(); toast('Toasted by a fire jet. Back to your checkpoint.'); break;
    case 'zap': SFX.zap(); hurt(); respawn(); toast('Zapped by a laser. Back to your checkpoint.'); break;
    case 'lurker': { const kind = CREATURE_KINDS[Math.floor(Math.random() * 3)]; if (mine) startJump(makeCreature(world.root, kind), true); else { const dd = Math.hypot(d.x - me.x, d.z - me.z); if (dd < 25) SFX.scream(Math.max(.15, 1 - dd / 25) * .7); if (dd < 12) toast(`Something jumped out at ${nameOf(d.by)}!`); } break; }
  }
}

// A hidden monster leaps into your face and screams.
function startJump(V, temp) {
  if (app.jump || me.eaten) { if (temp) world.root.remove(V.g); return; }
  app.jump = { at: performance.now(), V, temp }; V.g.visible = true; SFX.scream(1); hurt(); me.fl = true; if (app.holdT) app.holdT = 0;
}
function jumpCam(dt, t) {
  const J = app.jump, V = J.V, e = (performance.now() - J.at) / 1000;
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw);
  const dist = e < .18 ? lerp(1.8, .55, e / .18) : e < 1.2 ? .55 + Math.sin(e * 30) * .03 : .55 + (e - 1.2) * 6;
  const camY = me.y + me.h - .12;
  V.g.position.set(me.x + fx * dist, Math.max(0, camY - V.face + .05), me.z + fz * dist); V.g.rotation.y = me.yaw; V.g.scale.setScalar(e < 1.2 ? 1.1 : Math.max(.01, 1.1 - (e - 1.2) * 2));
  poseCreature(V, 0, 'scream', dt, t);
  camera.position.set(me.x + (Math.random() - .5) * .06, camY + (Math.random() - .5) * .06, me.z); camera.rotation.set(me.pitch * .3, me.yaw, (Math.random() - .5) * .08);
  flash.visible = true; flash.intensity = 30 * (Math.random() < .55 ? 1 : .05);
  if (e > 1.7) { if (J.temp) world.root.remove(V.g); else V.g.visible = false; app.jump = null; me.stun = Math.max(me.stun, .8); }
}
function respawn() { me.x = me.ck.x; me.z = me.ck.z; me.y = (me.ck.y || 0) + .05; me.vx = me.vz = me.vy = 0; me.inv = 1.4; me.stun = .3; me.plat = null; }

/* ---------------- avatars ---------------- */
function makeAvatar(color) {
  const g = new THREE.Group(); const c = new THREE.Color(color).getHex();
  const m = toon(c), white = toon(0xffffff), black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(.42, 20, 14), m); body.scale.set(1, 1.15, 1); body.position.y = .55; body.castShadow = true; outline(body, .025); g.add(body);
  const head = new THREE.Group(); head.position.y = 1.2; g.add(head);
  const hm = new THREE.Mesh(new THREE.SphereGeometry(.34, 20, 14), m); hm.castShadow = true; outline(hm, .025); head.add(hm);
  [-1, 1].forEach(s => { const e = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), white); e.position.set(s * .13, .06, .27); head.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), black); p.position.set(s * .13, .06, .35); head.add(p); });
  const hat = new THREE.Mesh(new THREE.ConeGeometry(.17, .42, 14), toon(0xf6f0ff)); hat.position.y = .45; hat.rotation.z = .12; outline(hat, .02); head.add(hat);
  const torch = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .26, 8), toon(0x3a3346)); torch.rotation.x = Math.PI / 2; torch.position.set(.38, -.45, .25); head.add(torch);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: .06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(.38, -.45, 3.25); head.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .04, 6, 28), new THREE.MeshBasicMaterial({ color: 0x7dffc4, transparent: true, opacity: 0 })); ring.rotation.x = Math.PI / 2; ring.position.y = 1.85; g.add(ring);
  return { g, head, beam, ring, body, rx: 0, rz: 0, ry: 0, init: false };
}
function updateAvatars(dt) {
  const tags = app.view === 'game';
  let li = 0; const fwd = new THREE.Vector3();
  app.roster.forEach(r => { if (!r.av || !r.av.g.visible || !r.pos || !r.pos.fl || li >= remoteLights.length || !inGame()) return; const L = remoteLights[li++], p = r.pos, av = r.av;
    L.position.set(av.rx, av.ry + (p.h || 1.75) - .3, av.rz); fwd.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
    L.target.position.copy(L.position).add(fwd); L.intensity = 26 * (av.flk ?? 1); });
  for (; li < remoteLights.length; li++) remoteLights[li].intensity = 0;
  app.roster.forEach(r => {
    if (!r.av) return; const p = r.pos, av = r.av;
    const eaten = app.S && app.S.eaten[r.id];
    const vis = inGame() && p && !eaten && !(app.S.phase === 'monster' && false);
    av.g.visible = !!vis;
    if (vis) {
      if (!av.init) { av.rx = p.x; av.rz = p.z; av.ry = p.y; av.init = true; }
      const k = Math.min(1, dt * 14); const moving = Math.hypot(p.x - av.rx, p.z - av.rz) > .02;
      av.rx = lerp(av.rx, p.x, k); av.rz = lerp(av.rz, p.z, k); av.ry = lerp(av.ry, p.y, k);
      av.g.position.set(av.rx, av.ry + (moving ? Math.abs(Math.sin(performance.now() / 90)) * .06 : 0), av.rz);
      av.g.rotation.y = p.yaw + Math.PI; av.head.rotation.x = -p.pitch * .6;
      av.g.scale.y = lerp(av.g.scale.y, (p.h || 1.75) / 1.75, k);
      const fk = flicker(nearestSentry(av.rx, av.rz)); av.flk = fk;
      av.beam.visible = !!p.fl && fk > .3; av.beam.material.opacity = .06 * fk;
      av.ring.material.opacity = voice.talking(r.id) ? .9 : 0;
    }
    // name tag (hidden behind walls and far away)
    if (!r.tag) return;
    let showTag = false;
    if (vis && tags) {
      const hp = new THREE.Vector3(av.rx, av.ry + 2.1 * av.g.scale.y, av.rz); const d = camera.position.distanceTo(hp);
      const v = hp.clone().project(camera);
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
}

/* ---------------- proximity text chat ---------------- */
function showSay(id, text) {
  const r = app.roster.get(id); if (!r) return;
  if (inGame()) {
    const myE = !!app.S.eaten[app.me.id], theirE = !!app.S.eaten[id];
    if (theirE && !myE) return;
    if (id !== app.me.id && !theirE && r.pos && Math.hypot(r.pos.x - me.x, r.pos.z - me.z) > 16 && !myE) return;
  }
  r.bubble = { text, until: performance.now() + 5000 };
  const d = document.createElement('div'); d.innerHTML = `<b style="color:${r.color}">${esc(r.name)}</b>${esc(text)}`; $('chatlog').appendChild(d);
  while ($('chatlog').children.length > 6) $('chatlog').firstChild.remove();
  setTimeout(() => d.remove(), 9000);
}
function openChat() { const c = $('chatbox'); c.hidden = false; c.value = ''; app.chatting = true; if (document.pointerLockElement) document.exitPointerLock(); setTimeout(() => c.focus(), 0); }
$('chatbox').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { const t = $('chatbox').value.trim(); if (t) net.send({ t: 'say', text: t }); closeChat(); }
  else if (e.key === 'Escape') closeChat();
});
function closeChat() { $('chatbox').hidden = true; app.chatting = false; $('chatbox').blur(); lockMouse(); }

/* ---------------- keypad ---------------- */
let padVal = '';
$('padKeys').innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'C'].map(k => `<button type="button" data-k="${k}">${k}</button>`).join('');
function openPad() { padVal = ''; renderPad(); $('keypad').hidden = false; app.padOpen = true; if (document.pointerLockElement) document.exitPointerLock(); $('padHint').textContent = `Type the ${app.A.code.length}-digit code with the number keys, then press Enter.`; }
function closePad(resume) { $('keypad').hidden = true; app.padOpen = false; if (resume) lockMouse(); }
function renderPad() { const n = app.A?.code?.length || 4; $('padShow').textContent = padVal.padEnd(n, '·'); }
function padKey(k) { const n = app.A.code.length; if (k === '⌫') padVal = padVal.slice(0, -1); else if (k === 'C') padVal = ''; else if (padVal.length < n) padVal += k; renderPad(); SFX.plate(); }
function padSubmit() { if (padVal.length !== app.A.code.length) return; sendReq({ type: 'safe', code: padVal }); closePad(true); }
$('padKeys').addEventListener('click', e => { const b = e.target.closest('button'); if (b) padKey(b.dataset.k); });
$('padGo').onclick = padSubmit; $('padClose').onclick = () => closePad(true);

/* ---------------- input ---------------- */
const keys = {};
addEventListener('keydown', e => {
  if (app.chatting) return;
  if (app.padOpen) { if (/^Digit\d$|^Numpad\d$/.test(e.code)) padKey(e.code.slice(-1)); else if (e.code === 'Backspace') padKey('⌫'); else if (e.code === 'Enter' || e.code === 'NumpadEnter') padSubmit(); else if (e.code === 'Escape') closePad(true); e.preventDefault(); return; }
  if (app.view === 'game' && !e.repeat) {
    if (e.code === 'KeyF') { me.fl = !me.fl; SFX.plate(); }
    if (e.code === 'KeyM') { if (voice.micOn) micToggle(); else toast('Turn your microphone on from the menu (Esc).'); }
    if (e.code === 'KeyT') { e.preventDefault(); openChat(); return; }
    if (e.code === 'KeyE') pressInteract();
    if (e.code === 'Space' && me.eaten) app.specIdx++;
  }
  if (app.view === 'game' && ['Space', 'Tab'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('click', () => { if (app.view === 'game' && !app.padOpen && !app.chatting && $('over').hidden && $('done').hidden) { audioInit(); lockMouse(); } if (me.eaten) app.specIdx++; });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  $('lockhint').hidden = locked || app.view !== 'game';
  if (locked) $('menu').hidden = true;
  else if (app.view === 'game' && !app.padOpen && !app.chatting && $('over').hidden && $('done').hidden) { $('menu').hidden = false; $('hostLobbyBtn').hidden = !isHost(); micButtons(); }
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || me.eaten) return;
  const s = .0022 * settings.sens; me.yaw -= e.movementX * s; me.pitch = clamp(me.pitch - e.movementY * s, -1.45, 1.45);
});
$('resumeBtn').onclick = () => { $('menu').hidden = true; lockMouse(); };
$('sVol').value = settings.vol; $('sBright').value = settings.bright; $('sSens').value = settings.sens;
$('sVol').oninput = e => { settings.vol = +e.target.value; voice.setVolume(settings.vol); store.set('vol', settings.vol); };
$('sBright').oninput = e => { settings.bright = +e.target.value; renderer.toneMappingExposure = settings.bright; store.set('bright', settings.bright); };
$('sSens').oninput = e => { settings.sens = +e.target.value; store.set('sens', settings.sens); };
$('hostLobbyBtn').onclick = $('overLobbyBtn').onclick = $('doneLobbyBtn').onclick = () => { if (!isHost()) return; net.send({ t: 'bcast', e: { type: 'screen', screen: 'lobby' } }); goLobby(); };
$('retryBtn').onclick = () => { if (isHost() && app.cfg && app.S.phase !== 'switching') { app.S.phase = 'switching'; hostStart(app.cfg.level, app.cfg.idx); } };
$('nextBtn').onclick = () => { if (isHost() && app.cfg && app.S.phase !== 'switching') { app.S.phase = 'switching'; hostStart(app.cfg.level + 1, 0); } };
function showEndButtons() { const h = isHost(); ['retryBtn', 'overLobbyBtn', 'nextBtn', 'doneLobbyBtn'].forEach(id => $(id).hidden = !h); $('overWait').hidden = $('doneWait').hidden = h; }

/* ---------------- interaction ---------------- */
const ray = new THREE.Raycaster(); ray.far = 2.8; const center = new THREE.Vector2(0, 0);
let focus = null;
function findFocus() {
  focus = null; if (!inGame() || me.eaten || me.jailed || app.scare || app.jump || app.S.phase !== 'play') return;
  ray.setFromCamera(center, camera);
  // only test what's within reach, so huge rooms stay fast
  const near = world.root.children.filter(o => { const dx = o.position.x - me.x, dz = o.position.z - me.z; if (dx * dx + dz * dz < 30) return true; const g = o.geometry; if (!g) return false; if (!g.boundingSphere) g.computeBoundingSphere(); return g.boundingSphere.radius > 3; });
  const hits = ray.intersectObjects(near, true);
  for (const h of hits) { if (h.object.userData.ink || !h.object.visible) continue; const pid = h.object.userData.pid; if (pid) { const info = app.A.info(pid, app.S); if (info) focus = { pid, info }; } break; }
}
function pressInteract() {
  if (!focus || me.stun > 0) return; const { pid, info } = focus;
  if (info.done || info.hold) return;
  if (info.safe) return openPad();
  if (info.locked) { SFX.locked(); toast(info.label); return; }
  if (pid === 'door') sendReq({ type: 'door' }); else if (pid === 'lectern') sendReq({ type: 'replay' });
}
function updateInteract(dt) {
  findFocus();
  const pr = $('prompt'), ring = $('ring');
  $('cross').classList.toggle('hot', !!focus && !focus.info.done);
  if (!focus) { pr.hidden = true; ring.hidden = true; app.holdT = 0; return; }
  const { pid, info } = focus; const pending = app.pending.has(pid) && performance.now() - app.pending.get(pid) < 2500;
  pr.hidden = false; pr.classList.toggle('dim', !!info.done);
  const html = info.done ? esc(info.label) : pending ? 'Searching…' : `<b>${info.hold ? 'Hold E' : 'E'}</b>${esc(info.label)}`;
  if (pr._h !== html) { pr._h = html; pr.innerHTML = html; }
  if (info.hold && !info.done && !pending && keys.KeyE && me.stun <= 0) {
    app.holdT += dt; const need = info.holdTime || DIFF[app.cfg.diff].search; ring.hidden = false; if (pid === 'jail' && Math.random() < .08) SFX.lockpick();
    $('ringC').setAttribute('stroke-dashoffset', 138.2 * (1 - Math.min(1, app.holdT / need)));
    if (app.holdT >= need) { app.holdT = 0; app.pending.set(pid, performance.now()); sendReq(pid === 'jail' ? { type: 'free' } : { type: 'search', pid }); noise(.2, .08, 900); }
  } else { app.holdT = 0; ring.hidden = true; }
}

/* ---------------- local player ---------------- */
function updateMe(dt) {
  const S = app.S; const frozen = app.padOpen || app.chatting || !!S.screen || S.phase === 'clear' || !!app.scare || !!app.jump || document.pointerLockElement !== canvas;
  const pt = (net.now() - app.cfg.startAt) / 1000;
  if (me.plat && me.plat.pos) { const a = me.plat.pos(pt - dt), b = me.plat.pos(pt); me.x += b.x - a.x; me.z += b.z - a.z; me.y += b.y - a.y; }
  me.stun = Math.max(0, me.stun - dt); me.inv = Math.max(0, me.inv - dt);
  let ix = 0, iz = 0;
  if (!frozen) { if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1; }
  const mag = Math.hypot(ix, iz); if (mag > 1) { ix /= mag; iz /= mag; }
  const crouch = !frozen && (keys.KeyC || keys.ControlLeft);
  const moving = mag > 0;
  const sprint = !frozen && (keys.ShiftLeft || keys.ShiftRight) && !crouch && moving && me.stam > 1;
  me.stam = clamp(me.stam + (sprint ? -28 : 16) * dt, 0, 100);
  let speed = crouch ? 2.2 : sprint ? 6.6 : 4.2; if (me.stun > 0) speed *= .25;
  const sn = Math.sin(me.yaw), cs = Math.cos(me.yaw);
  const wx = ix * cs + iz * sn, wz = -ix * sn + iz * cs;
  const ctl = me.ground ? 12 : 3;
  me.vx = lerp(me.vx, wx * speed, Math.min(1, dt * ctl)); me.vz = lerp(me.vz, wz * speed, Math.min(1, dt * ctl));
  me.x += me.vx * dt; me.z += me.vz * dt;
  if (!frozen && keys.Space && me.ground && !crouch && me.stun <= 0) { me.vy = 6.2; me.ground = false; SFX.jump(); }
  const prevFeet = me.y; me.vy -= 20 * dt; me.y += me.vy * dt;
  const gr = me.vy <= 0 ? app.A.ground(me, prevFeet, pt) : null;
  if (gr) { if (!me.ground && me.vy < -3) SFX.step(); me.y = gr.top; me.vy = 0; me.ground = true; me.plat = gr.plat || null; } else { me.ground = false; me.plat = null; }
  collide(me, world.solids, .35);
  app.roster.forEach(r => { if (r.id === app.me.id || !r.pos || app.S.eaten[r.id]) return; const dx = me.x - r.pos.x, dz = me.z - r.pos.z, d = Math.hypot(dx, dz); if (d > 0 && d < .7) { me.x += dx / d * (.7 - d); me.z += dz / d * (.7 - d); } });
  me.h = lerp(me.h, crouch ? 1.15 : 1.75, Math.min(1, dt * 12));
  const sp = Math.hypot(me.vx, me.vz);
  if (sp > .5 && me.ground) { me.bob += dt * sp * 2.2; me.stepT -= dt * sp; if (me.stepT <= 0) { me.stepT = 1.9; SFX.step(); } }
  const bob = Math.sin(me.bob) * .045 * Math.min(1, sp / 4);
  const shake = me.stun > 0 ? (Math.random() - .5) * .04 : 0;
  camera.position.set(me.x, me.y + me.h - .12 + bob, me.z); camera.rotation.set(me.pitch + shake, me.yaw + shake, 0);
  flash.visible = me.fl && !me.jailed; flash.intensity = 30 * flicker(nearestSentry(me.x, me.z));
  setText('stamI', ''); $('stamI').style.width = me.stam + '%'; $('stam').style.opacity = me.stam < 99 ? 1 : 0;
}
function scareCam(dt) {
  const sc = app.scare, V = app.sentries[sc.by], since = performance.now() - sc.at;
  if (V) { const px = V.rx + Math.sin(V.rf) * .75, pz = V.rz + Math.cos(V.rf) * .75; camera.position.set(px + (Math.random() - .5) * .05, .75 + (Math.random() - .5) * .05, pz); camera.lookAt(V.rx, .7, V.rz); flash.visible = true; flash.intensity = 40 * (Math.random() < .5 ? 1 : .1); }
  if (since > 1100) { app.scare = null; $('chomp').hidden = true; const order = [...app.roster.values()].sort((a, b) => a.joinedAt - b.joinedAt).map(r => r.id); const j = app.A.jail.spots[Math.max(0, order.indexOf(app.me.id)) % app.A.jail.spots.length]; me.x = j.x; me.z = j.z; me.y = 0; me.vx = me.vz = 0; me.jailed = true; me.yaw = 0; me.pitch = 0; toast('You are locked in the jail. Your crew can pick the lock, if they want to.'); }
}
function spectate(dt) {
  const S = app.S; const since = performance.now() - app.eatenAt;
  if (since < 1500 && app.M) { // the jumpscare: stare down the throat
    const m = app.M.g.position, f = app.M.rf; const mx = m.x + Math.sin(f) * 1.6, mz = m.z + Math.cos(f) * 1.6;
    camera.position.lerp(new THREE.Vector3(mx + Math.sin(f) * .6, 2.3, mz + Math.cos(f) * .6), Math.min(1, dt * 8));
    camera.lookAt(m.x, 2.3, m.z); return;
  }
  $('chomp').hidden = true;
  const living = [...app.roster.values()].filter(r => r.id !== app.me.id && r.pos && !S.eaten[r.id]);
  const sp = $('spec');
  if (living.length) {
    const r = living[app.specIdx % living.length], p = r.pos; sp.hidden = false; setText('spec', `${S.lost && S.lost[app.me.id] ? 'Left behind in the jail' : 'You were eaten'}. Watching ${r.name} · click to switch · only other ghosts can hear you`);
    camera.position.lerp(new THREE.Vector3(p.x, p.y + (p.h || 1.75) - .12, p.z), Math.min(1, dt * 10)); camera.rotation.set(p.pitch, p.yaw, 0);
  } else if (app.M) { sp.hidden = false; setText('spec', 'Everyone was eaten.'); const m = app.M.g.position; camera.position.lerp(new THREE.Vector3(m.x + 5, 4, m.z + 5), dt * 2); camera.lookAt(m.x, 1.5, m.z); }
}

/* ---------------- frame ---------------- */
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, clock.getDelta()), t = performance.now() / 1000;
  if (inGame()) {
    const S = app.S, A = app.A, now = net.now();
    if (isHost()) hostTick(dt);
    if (!app.S) return renderer.render(scene, camera); // host may have switched area
    // monster
    if (S.phase === 'monster' && S.monster) {
      if (!app.monsterShown) { app.monsterShown = true; SFX.roar(); A.room.smash(); $('redwash').classList.add('on'); hemi.color.set(0xff5060); banner("Time's up", 'Something is coming', true, 2200); if (document.pointerLockElement !== canvas) { } }
      if (!app.M) { app.M = makeMonster(world.root); app.M.rx = S.monster.x; app.M.rz = S.monster.z; app.M.rf = S.monster.face; }
      animMonster(app.M, S.monster, dt, t);
    }
    if (S.eaten[app.me.id] && !me.eaten) { me.eaten = true; app.eatenAt = performance.now(); SFX.chomp(); hurt(); $('chomp').hidden = false; $('notecard').hidden = true; }
    // sentries
    if (S.sentries) {
      let best = 1e9, bi = -1;
      S.sentries.forEach((s, i) => { const V = app.sentries[i]; if (!V) return; animSentry(V, s, dt, t); V.g.visible = S.phase !== 'monster' || true; const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < best) { best = d; bi = i; } if (s.st === 'hunt' && app.prevSt[i] !== 'hunt' && d < 12 && app.fresh) SFX.screech(); app.prevSt[i] = s.st; });
      app.growlT -= dt; if (bi >= 0 && S.sentries[bi].st === 'hunt' && best < 12 && app.growlT <= 0) { app.growlT = 1.6 + Math.random() * 2; SFX.growl(1 - best / 12); }
      app.clickT -= dt;
      if (bi >= 0 && best < 15 && app.clickT <= 0 && !me.eaten && !app.jump) { const s = S.sentries[bi]; app.clickT = s.st === 'hunt' ? .14 + Math.random() * .1 : .5 + best * .06 + Math.random() * .4; const ang = Math.atan2(s.x - me.x, s.z - me.z) - (me.yaw + Math.PI); click((1 - best / 15) * .22, -Math.sin(ang)); }
    }
    // creepy bed: louder as the nearest monster closes in; breathing near hidden ones
    { let ds = nearestSentry(me.x, me.z), dl = 1e9; (app.A.lurkers || []).forEach((l, i) => { if (!(S.lurk || {})[i]) dl = Math.min(dl, Math.hypot(l.x - me.x, l.z - me.z)); });
      const I = me.eaten ? 0 : S.phase === 'monster' ? .9 : clamp(1 - ds / 16, 0, 1), B = me.eaten ? 0 : clamp(1 - dl / 7, 0, 1); creepUpdate(dt, I, B); }
    // jail
    const J = S.jailed || {};
    if (S.caught && S.caught.length) { const c = S.caught[S.caught.length - 1]; if (c.at !== app.lastCaught) { app.lastCaught = c.at; if (app.fresh) { if (c.id === app.me.id) { app.scare = { at: performance.now(), by: c.by }; SFX.screech(); hurt(); $('notecard').hidden = true; } else toast(`A sentry dragged ${nameOf(c.id)} off to the jail!`); } } }
    if (S.freedAt && S.freedAt !== app.lastFreed) { app.lastFreed = S.freedAt; if (app.fresh) { SFX.unlock(); toast(`${nameOf(S.freedBy)} picked the jail lock!`); } }
    if (me.jailed && !J[app.me.id]) { me.jailed = false; const o = app.A.jail.out; me.x = o.x + (Math.random() - .5) * 2; me.z = o.z + Math.random() * .6; }
    // ambush monsters hidden in the dark
    if (S.lurk) for (const i in S.lurk) { if (app.lurkSeen[i]) continue; app.lurkSeen[i] = 1; const L = S.lurk[i], V = app.lurkV[i], l = app.A.lurkers[i]; if (!V || !app.fresh) continue;
      if (L.by === app.me.id) startJump(V, false); else { const dd = Math.hypot(l.x - me.x, l.z - me.z); if (dd < 25) SFX.scream(Math.max(.15, 1 - dd / 25) * .7); V.g.visible = true; V.leap = performance.now(); V.leapTo = (app.roster.get(L.by) || {}).pos; } }
    app.lurkV.forEach(V => { if (!V.leap || app.jump?.V === V) return; const e = (performance.now() - V.leap) / 1000; if (e > 2) { V.g.visible = false; V.leap = 0; return; } if (V.leapTo) { V.g.position.x = lerp(V.g.position.x, V.leapTo.x, Math.min(1, dt * 6)); V.g.position.z = lerp(V.g.position.z, V.leapTo.z, Math.min(1, dt * 6)); V.g.position.y = Math.sin(Math.min(1, e * 2) * Math.PI) * .6; } poseCreature(V, 0, 'scream', dt, t); });
    if (me.eaten) spectate(dt); else if (app.jump) jumpCam(dt, t); else if (app.scare) scareCam(dt); else updateMe(dt);
    world.update(dt, t, S.phase === 'monster');
    A.render(dt, S, { now, me, fx, fresh: app.fresh, phase: S.phase, exitText }); app.fresh = true;
    if (!me.eaten) updateInteract(dt); else { $('prompt').hidden = true; $('ring').hidden = true; }
    // timer
    const tl = S.phase === 'monster' ? 0 : timeLeft(); setText('hTimer', fmt(tl));
    $('hTimer').classList.toggle('danger', tl <= 15); $('hTimer').classList.toggle('warn', tl > 15 && tl <= 60);
    const s = Math.ceil(tl); if (tl <= 10 && tl > 0 && s !== app.lastTick && S.phase === 'play') { app.lastTick = s; SFX.tick(); }
    setText('hProg', A.progress(S, { exitText }));
    setText('hObj', S.phase === 'monster' ? (me.eaten ? 'You were eaten.' : 'RUN!') : now < app.cfg.startAt ? `Get ready… ${Math.ceil((app.cfg.startAt - now) / 1000)}` : S.phase === 'clear' ? 'Room cleared!' : A.objective(S));
    if (app.noteCode && !me.eaten) $('notecard').hidden = false;
    // end screens
    if (S.screen && app.shownScreen !== S.screen.type) {
      app.shownScreen = S.screen.type; if (document.pointerLockElement) document.exitPointerLock(); $('menu').hidden = true; showEndButtons();
      if (S.screen.type === 'over') { $('overEyebrow').textContent = `Level ${app.cfg.level} · Room ${app.cfg.idx + 1} of ${ROOMS} · ${A.name}`; const n = allPlayers().length; $('overText').textContent = S.screen.reason === 'jail' ? (n === 1 ? 'A sentry dragged you to the jail and nobody was left to pick the lock.' : 'The sentries locked up every last one of you. Nobody was left to pick the lock.') : n === 1 ? 'The clock ran out and the monster found you.' : `The clock ran out and the monster ate all ${n} of you, one crunchy crewmate at a time.`; $('over').hidden = false; }
      else { SFX.win(); $('doneTitle').textContent = `Level ${app.cfg.level} escaped`; $('doneText').textContent = `Level ${app.cfg.level + 1} has a bigger study with more keys, more sentries and a longer platform course. Same ${DIFF[app.cfg.diff].label.toLowerCase()} clock: ${fmt(DIFF[app.cfg.diff].time)} per room. Anyone left behind comes back.`; $('done').hidden = false; }
    }
    if (!S.screen) { $('over').hidden = true; $('done').hidden = true; }
    // send my pose
    if (performance.now() - app.lastPos > 66) { app.lastPos = performance.now(); if (!me.eaten && !app.scare) net.send({ t: 'pos', p: { x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), h: +me.h.toFixed(2), fl: me.fl && !me.jailed } }); }
    renderRoster();
  } else if (app.view === 'home' || app.view === 'lobby') {
    camera.position.set(Math.sin(t * .1) * 6, 2.2, Math.cos(t * .1) * 6); camera.lookAt(0, 1.4, 0);
    menuScene(dt, t);
  }
  updateAvatars(dt);
  // voice positions
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  voice.update({ x: camera.position.x, y: camera.position.y, z: camera.position.z, fx: fwd.x, fy: fwd.y, fz: fwd.z }, me.eaten && inGame(), id => {
    const r = app.roster.get(id); if (!r || !r.pos || !inGame()) return null;
    return { x: r.pos.x, y: r.pos.y + (r.pos.h || 1.75) - .2, z: r.pos.z, eaten: !!app.S.eaten[id], blocked: wallBetween(me.x, me.z, r.pos.x, r.pos.z, world.solids) };
  }, !inGame());
  const lvl = Math.min(100, voice.micLevel() * 600); $('hudMeter').style.width = lvl + '%'; $('lobbyMeter').style.width = lvl + '%';
  if (app.view === 'lobby') app.roster.forEach(r => { const el = $('lp-' + r.id); if (el) el.classList.toggle('talk', r.id === app.me.id ? lvl > 12 : voice.talking(r.id)); });
  renderer.render(scene, camera);
}
let rosterHtml = '';
function renderRoster() {
  const S = app.S; const html = [...app.roster.values()].sort((a, b) => a.joinedAt - b.joinedAt).map(r => {
    const out = S.eaten[r.id], jailed = (S.jailed || {})[r.id], talk = r.id === app.me.id ? voice.micLevel() > .02 : voice.talking(r.id);
    const atExit = r.id === app.me.id ? inZone(me, app.A.room.exitZone) : r.pos && inZone(r.pos, app.A.room.exitZone);
    return `<div class="rp${out ? ' out' : ''}${talk ? ' talk' : ''}"><span class="dot" style="background:${r.color}"></span>${esc(r.id === app.me.id ? r.name + ' (you)' : r.name)}${r.id === app.hostId ? ' · host' : ''}${jailed ? ' · in jail' : ''}${atExit && !out && !jailed ? ' · at exit' : ''}${out ? (S.lost[r.id] ? ' · left behind' : ' · eaten') : ''}</div>`;
  }).join('');
  if (html !== rosterHtml) { rosterHtml = html; $('roster').innerHTML = html; }
}

// A little monster idling behind the home and lobby screens.
let menuM = null;
function menuScene(dt, t) {
  if (!menuM) { world.clear(); darkness(false); const f = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshToonMaterial({ color: 0x2a2236 })); f.rotation.x = -Math.PI / 2; world.root.add(f); world.torch(-3, -2, Math.PI / 4, 10); world.torch(3, -2, -Math.PI / 4, 10); menuM = makeMonster(world.root); menuM.g.position.x = 1.5; menuM.crew = CREATURE_KINDS.map((k, i) => { const V = makeCreature(world.root, k); V.g.position.set(-2.6 + i * 1.5, 0, 1.2 + (i % 2) * .6); V.g.rotation.y = .3 - i * .2; return V; }); }
  if (!menuM.g.parent || menuM.g.parent !== world.root) { menuM = null; return; }
  (menuM.crew || []).forEach((V, i) => poseCreature(V, 0, Math.sin(t * .7 + i * 2) > .6 ? 'hunt' : 'calm', dt, t));
  animMonster(menuM, { x: 1.5, z: 0, face: Math.sin(t * .4) * .5, open: .25 + Math.max(0, Math.sin(t * 1.3)) * .6, chew: 0, moving: false }, dt, t);
  world.update(dt, t, false);
}
show('home'); frame();
