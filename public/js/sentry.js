// Sentries: monsters that patrol the dark and hunt flashlights (and loud noises).
// The host runs their brains on a walk grid; everyone animates them from S.sentries = [{ x, z, f, st }].
import * as THREE from 'three';
import { wallBetween } from './world.js';

/* ---------------- walk grid + BFS paths ---------------- */
export function buildNav(solids, W, D, cell = .5, R = .32) {
  const x0 = -W / 2, z0 = -D / 2, nx = Math.ceil(W / cell), nz = Math.ceil(D / cell), block = new Uint8Array(nx * nz);
  for (const s of solids) {
    if (!s.on) continue;
    const i0 = Math.max(0, Math.floor((s.x0 - R - x0) / cell)), i1 = Math.min(nx - 1, Math.floor((s.x1 + R - x0) / cell));
    const j0 = Math.max(0, Math.floor((s.z0 - R - z0) / cell)), j1 = Math.min(nz - 1, Math.floor((s.z1 + R - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) block[j * nx + i] = 1;
  }
  // the room's own edge
  for (let i = 0; i < nx; i++) { block[i] = 1; block[(nz - 1) * nx + i] = 1; } for (let j = 0; j < nz; j++) { block[j * nx] = 1; block[j * nx + nx - 1] = 1; }
  const nav = { cell, x0, z0, nx, nz, block };
  nav.idx = (x, z) => { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
  nav.center = k => ({ x: x0 + (k % nx + .5) * cell, z: z0 + (Math.floor(k / nx) + .5) * cell });
  nav.free = k => k >= 0 && !block[k];
  nav.nearestFree = (x, z) => { const k = nav.idx(x, z); if (nav.free(k)) return k; for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const q = k + dj * nx + di; if (nav.free(q)) return q; } return -1; };
  const prev = new Int32Array(nx * nz), seen = new Uint32Array(nx * nz); let stamp = 1; const queue = new Int32Array(nx * nz);
  nav.path = (ax, az, bx, bz) => {
    const s = nav.nearestFree(ax, az), t = nav.nearestFree(bx, bz); if (s < 0 || t < 0) return null;
    stamp++; let h = 0, tl = 0; queue[tl++] = s; seen[s] = stamp; prev[s] = -1;
    while (h < tl) { const k = queue[h++]; if (k === t) break; const i = k % nx;
      const nb = [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx];
      for (const q of nb) { if (q < 0 || q >= nx * nz || seen[q] === stamp || block[q]) continue; seen[q] = stamp; prev[q] = k; queue[tl++] = q; } }
    if (seen[t] !== stamp) return null;
    const out = []; let k = t; while (k !== -1) { out.push(k); k = prev[k]; } out.reverse();
    return out.filter((_, i) => i % 3 === 0 || i === out.length - 1).map(nav.center);
  };
  nav.randomFree = rng => { for (let k = 0; k < 400; k++) { const q = Math.floor(rng() * nx * nz); if (nav.free(q)) return nav.center(q); } return { x: 0, z: 0 }; };
  return nav;
}

/* ---------------- host brain ---------------- */
// opts: { speed, sense, beam, grace(ms) }
export function stepSentries(S, brains, nav, players, now, dt, opts, rng, startAt) {
  const caught = [];
  S.sentries.forEach((s, i) => {
    const b = brains[i] || (brains[i] = { path: null, repath: 0, seen: 0, sx: 0, sz: 0, feed: 0 });
    if (s.st === 'feed') { b.feed -= dt; if (b.feed <= 0) { s.st = 'patrol'; b.path = null; } return; }
    // who is lighting me up?
    let tgt = null, best = 1e9;
    if (now > startAt + opts.grace) for (const p of players) {
      if (p.eaten || p.jailed || !p.fl) continue;
      const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz); if (d > opts.beam) continue;
      let lit = d < opts.sense;
      if (!lit) { const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), dot = (-dx * fx - dz * fz) / (d || 1); lit = dot > .94; } // they're shining the beam right at me
      if (!lit || wallBetween(s.x, s.z, p.x, p.z, nav.walls)) continue;
      if (d < best) { best = d; tgt = p; }
    }
    if (tgt) { if (s.st !== 'hunt') b.repath = 0; s.st = 'hunt'; b.seen = now; b.sx = tgt.x; b.sz = tgt.z; }
    else if (opts.alert && b.alertAt !== opts.alert.at && Math.hypot(opts.alert.x - s.x, opts.alert.z - s.z) < 30) { b.alertAt = opts.alert.at; s.st = 'hunt'; b.seen = now; b.sx = opts.alert.x; b.sz = opts.alert.z; b.repath = 0; }
    else if (s.st === 'hunt' && now - b.seen > 3500) { s.st = 'patrol'; b.path = null; }
    // plan
    b.repath -= dt;
    if (s.st === 'hunt' && b.repath <= 0) { b.path = nav.path(s.x, s.z, b.sx, b.sz); b.repath = .7; }
    if (s.st === 'patrol' && (!b.path || !b.path.length)) { const w = nav.randomFree(rng); b.path = nav.path(s.x, s.z, w.x, w.z); if (!b.path) b.path = []; }
    // walk
    const sp = s.st === 'hunt' ? opts.speed : 1.4;
    if (b.path && b.path.length) {
      const w = b.path[0], dx = w.x - s.x, dz = w.z - s.z, d = Math.hypot(dx, dz);
      if (d < .3) b.path.shift(); else { const st = Math.min(d, sp * dt); s.x += dx / d * st; s.z += dz / d * st; s.f = Math.atan2(dx, dz); }
    }
    // direct lunge when close and in sight
    if (tgt && best < 3) { const dx = tgt.x - s.x, dz = tgt.z - s.z; s.x += dx / best * opts.speed * .4 * dt; s.z += dz / best * opts.speed * .4 * dt; s.f = Math.atan2(dx, dz); }
    // catch anyone close, light or not
    for (const p of players) { if (p.eaten || p.jailed) continue; if (Math.hypot(p.x - s.x, p.z - s.z) < .95 && p.y < 1.2) { caught.push({ id: p.id, by: i }); s.st = 'feed'; b.feed = 3.5; b.path = null; break; } }
    s.x = +s.x.toFixed(2); s.z = +s.z.toFixed(2); s.f = +(s.f || 0).toFixed(2);
  });
  return caught;
}

/* ---------------- visuals ---------------- */
import { makeCreature, poseCreature, CREATURE_KINDS } from './creatures.js';
export { makeCreature, poseCreature, CREATURE_KINDS };
export function makeSentry(parent, i) { return makeCreature(parent, CREATURE_KINDS[i % CREATURE_KINDS.length]); }
export function animSentry(V, s, dt, t) {
  if (V.rx === null) { V.rx = s.x; V.rz = s.z; V.rf = s.f || 0; }
  const k = Math.min(1, dt * 10), ox = V.rx, oz = V.rz;
  V.rx += (s.x - V.rx) * k; V.rz += (s.z - V.rz) * k;
  let df = (s.f || 0) - V.rf; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2; V.rf += df * k;
  const sp = Math.hypot(V.rx - ox, V.rz - oz) / Math.max(dt, 1e-3);
  poseCreature(V, sp, s.st === 'hunt' || s.st === 'feed' ? 'hunt' : 'calm', dt, t);
  V.g.position.set(V.rx, 0, V.rz); V.g.rotation.y = V.rf;
}
