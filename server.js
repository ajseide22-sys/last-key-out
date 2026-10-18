// Last Key Out — game server. No dependencies: run with `node server.js`.
// Serves the client from ./public and relays game state + voice-chat signaling over WebSockets.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS = 8;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

// Optional TURN server for players behind strict NATs (see README).
function iceServers() {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) list.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USER || '', credential: process.env.TURN_PASS || '' });
  return list;
}

/* ---------------- static files ---------------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/config') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ iceServers: iceServers() })); }
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { // unknown paths fall back to the app so /?room=ABCD style links work
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => { if (e2) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(d2); });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

/* ---------------- minimal WebSocket (RFC 6455) ---------------- */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  onConnection(wrapSocket(socket));
});

function wrapSocket(socket) {
  const ws = { alive: true, open: true, handlers: {}, on(ev, fn) { this.handlers[ev] = fn; } };
  let buf = Buffer.alloc(0), frag = [], fragOp = 0;
  const emit = (ev, a) => ws.handlers[ev] && ws.handlers[ev](a);
  function frame(op, payload) {
    const len = payload.length; let head;
    if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
    else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    head[0] = 0x80 | op;
    return Buffer.concat([head, payload]);
  }
  ws.send = (str) => { if (!ws.open) return; try { socket.write(frame(1, Buffer.from(str))); } catch (e) { /* closed */ } };
  ws.ping = () => { if (ws.open) try { socket.write(frame(9, Buffer.alloc(0))); } catch (e) { } };
  ws.close = () => { if (!ws.open) return; ws.open = false; try { socket.end(frame(8, Buffer.alloc(0))); } catch (e) { } setTimeout(() => socket.destroy(), 500); emit('close'); };
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > 2 * 1024 * 1024) return ws.close();
    while (buf.length >= 2) {
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; const big = buf.readBigUInt64BE(2); if (big > 1048576n) return ws.close(); len = Number(big); off = 10; }
      if (!masked) return ws.close(); // clients must mask
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4); off += 4;
      const data = Buffer.from(buf.subarray(off, off + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + len);
      if (op === 8) return ws.close();
      if (op === 9) { try { socket.write(frame(10, data)); } catch (e) { } continue; }
      if (op === 10) { ws.alive = true; continue; }
      if (op === 0 || op === 1 || op === 2) {
        if (op !== 0) fragOp = op;
        frag.push(data);
        if (fin) { const msg = Buffer.concat(frag); frag = []; if (fragOp === 1) emit('message', msg.toString('utf8')); }
      }
    }
  });
  socket.on('close', () => { if (ws.open) { ws.open = false; emit('close'); } });
  socket.on('error', () => { if (ws.open) { ws.open = false; emit('close'); } socket.destroy(); });
  return ws;
}

/* ---------------- rooms ---------------- */
const rooms = new Map(); // code -> { code, players: Map(id -> player), hostId, area, snap, screen }
let nextId = 1;
const COLORS = ['#ff6b6b', '#4dd6ff', '#ffd23f', '#8cff6b', '#c38bff', '#ff9a3c', '#ff7ac8', '#f1e8da'];

function makeCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let c; do { c = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c)); return c; }
function cleanMeta(m) { m = m && typeof m === 'object' ? m : {}; const c = m.cos && typeof m.cos === 'object' ? m.cos : {}; const id = v => typeof v === 'string' && /^[a-z]-[a-z]{2,12}$/.test(v) ? v : undefined; return { mic: !!m.mic, muted: !!m.muted, cos: { color: id(c.color), hat: id(c.hat), acc: id(c.acc), light: id(c.light) } }; }
function cleanName(n) { return String(n || '').replace(/[<>&"'`]/g, '').trim().slice(0, 16) || 'Player'; }
function publicPlayer(p) { return { id: p.id, name: p.name, color: p.color, joinedAt: p.joinedAt, meta: p.meta || {} }; }
function roomList(r) { return [...r.players.values()].map(publicPlayer); }
function broadcast(r, obj, exceptId) { const s = JSON.stringify(obj); for (const p of r.players.values()) if (p.id !== exceptId) p.ws.send(s); }
function sendTo(r, id, obj) { const p = r.players.get(id); if (p) p.ws.send(JSON.stringify(obj)); }

function onConnection(ws) {
  const id = 'p' + (nextId++);
  let room = null, me = null;
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'ping') return ws.send(JSON.stringify({ t: 'pong', c: m.c, s: Date.now() }));
    if (m.t === 'join') {
      if (room) return;
      let code = String(m.room || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
      if (m.create || !code) { code = makeCode(); rooms.set(code, { code, players: new Map(), hostId: null, area: null, snap: null, screen: 'lobby' }); }
      const r = rooms.get(code);
      if (!r) return ws.send(JSON.stringify({ t: 'error', code: 'no_room', msg: 'No room with code ' + code + '. Check the code or create a new room.' }));
      if (r.players.size >= MAX_PLAYERS) return ws.send(JSON.stringify({ t: 'error', code: 'full', msg: 'Room ' + code + ' is full (' + MAX_PLAYERS + ' players).' }));
      const used = new Set([...r.players.values()].map(p => p.color));
      me = { id, ws, name: cleanName(m.name), color: COLORS.find(c => !used.has(c)) || COLORS[0], joinedAt: Date.now(), meta: cleanMeta(m.meta) };
      room = r; r.players.set(id, me);
      if (!r.hostId) r.hostId = id;
      ws.send(JSON.stringify({ t: 'welcome', id, room: code, hostId: r.hostId, players: roomList(r), area: r.area, snap: r.snap, screen: r.screen, now: Date.now(), iceServers: iceServers() }));
      broadcast(r, { t: 'peer-join', player: publicPlayer(me) }, id);
      return;
    }
    if (!room) return;
    switch (m.t) {
      case 'pos': // player transform, relayed to everyone else
        broadcast(room, { t: 'pos', id, p: m.p }, id); break;
      case 'bcast': // host-authoritative state and one-shot effects
        if (id !== room.hostId) return;
        if (m.e && m.e.type === 'area') { room.area = m.e; room.snap = null; room.screen = 'game'; }
        if (m.e && m.e.type === 'snap') room.snap = m.e;
        if (m.e && m.e.type === 'screen') room.screen = m.e.screen;
        broadcast(room, { t: 'bcast', e: m.e }, id); break;
      case 'tohost': // a guest asking the host to do something (open a chest, enter a code)
        if (room.hostId === id) return;
        sendTo(room, room.hostId, { t: 'fromguest', from: id, e: m.e }); break;
      case 'rtc': // WebRTC signaling for voice chat
        if (typeof m.to === 'string' && room.players.has(m.to)) sendTo(room, m.to, { t: 'rtc', from: id, data: m.data }); break;
      case 'say': // lobby text, also proximity-filtered in game on the client
        broadcast(room, { t: 'say', id, text: String(m.text || '').slice(0, 140) }, null); break;
      case 'meta': // mic on/off and cosmetics
        me.meta = cleanMeta(m.meta); broadcast(room, { t: 'meta', id, meta: me.meta }, id); break;
    }
  });
  ws.on('close', () => {
    if (!room) return;
    room.players.delete(id);
    if (room.players.size === 0) { rooms.delete(room.code); return; }
    if (room.hostId === id) { // hand the game to whoever joined first
      room.hostId = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0].id;
    }
    broadcast(room, { t: 'peer-leave', id, hostId: room.hostId, players: roomList(room) });
  });
  ws.alive = true;
  ws.timer = setInterval(() => { if (!ws.open) return clearInterval(ws.timer); if (!ws.alive) { clearInterval(ws.timer); return ws.close(); } ws.alive = false; ws.ping(); }, 25000);
}

server.listen(PORT, () => {
  console.log('\n  Last Key Out is running.');
  console.log('  Open  http://localhost:' + PORT + '  in your browser.');
  console.log('  Friends need an https:// address to use voice chat — see README.md.\n');
});
