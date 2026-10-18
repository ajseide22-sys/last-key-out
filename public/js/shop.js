// The wallet and the cosmetics shop. Everything is saved in this browser (localStorage).
import * as THREE from 'three';
import { ITEMS, ITEM, CATS, makeAvatar, lightColor } from './avatar.js';

const KEY = 'lko.profile';
const load = () => { try { return Object.assign({ wallet: 0, owned: [], cos: {}, escapes: 0, best: 0 }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { wallet: 0, owned: [], cos: {}, escapes: 0, best: 0 }; } };
let prof = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prof)); } catch (e) { } };
const listeners = [];
const changed = () => { save(); listeners.forEach(f => f(prof)); };

export const profile = () => prof;
export const getCos = () => Object.assign({}, prof.cos);
export const onProfile = f => listeners.push(f);
export function bank(amount) { prof.wallet += amount; prof.escapes++; prof.best = Math.max(prof.best, amount); changed(); }

/* ---------------- UI ---------------- */
const $ = id => document.getElementById(id);
let cat = 'model', preview = null, tryOn = null, baseColor = '#ff6b6b';
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function cosWith(id) { const c = getCos(); if (id) c[ITEM[id].cat] = id; return c; }

function render() {
  $('shopWallet').textContent = '$' + prof.wallet.toLocaleString();
  $('shopTabs').innerHTML = CATS.map(c => `<button type="button" class="tab" data-cat="${c.id}" aria-pressed="${c.id === cat}">${c.name}</button>`).join('');
  const items = ITEMS.filter(i => i.cat === cat);
  const none = `<button type="button" class="item" data-none="1" aria-pressed="${!prof.cos[cat]}"><span class="sw none"></span><span class="in">${cat === 'light' ? 'Warm (default)' : cat === 'color' ? 'Default color' : cat === 'model' ? 'Classic Blob' : 'None'}</span><span class="pr">Free</span></button>`;
  $('shopGrid').innerHTML = none + items.map(i => {
    const own = prof.owned.includes(i.id), eq = prof.cos[cat] === i.id;
    const sw = i.hex !== undefined ? `<span class="sw" style="background:#${i.hex.toString(16).padStart(6, '0')}"></span>` : '<span class="sw icon"></span>';
    return `<button type="button" class="item${own ? ' own' : ''}" data-id="${i.id}" aria-pressed="${eq}">${sw}<span class="in">${esc(i.name)}</span><span class="pr">${eq ? 'Wearing' : own ? 'Owned · wear' : '$' + i.price.toLocaleString()}</span></button>`;
  }).join('');
  $('shopNote').textContent = '';
  rebuildPreview();
}
function rebuildPreview() {
  if (!preview) return;
  if (preview.av) preview.scene.remove(preview.av.g);
  preview.av = makeAvatar(tryOn ? cosWith(tryOn) : getCos(), baseColor); preview.scene.add(preview.av.g);
  preview.spot.color.setHex(lightColor(tryOn ? cosWith(tryOn) : getCos()));
}
function initPreview() {
  const canvas = $('shopPreview');
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(35, 1, .1, 50); cam.position.set(0, 1.5, 4.6); cam.lookAt(0, 1.05, 0);
  scene.add(new THREE.HemisphereLight(0xc8b8ff, 0x302040, 1.3)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 3); scene.add(d);
  const spot = new THREE.PointLight(0xfff1d6, 3, 4); spot.position.set(1, 1, 2); scene.add(spot);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshToonMaterial({ color: 0x2a2236 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  preview = { r, scene, cam, spot, av: null, t: 0 };
  const loop = () => { if ($('shop').hidden) { preview.raf = 0; return; } const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.floor(w * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } preview.t += .016; if (preview.av) { preview.av.g.rotation.y = Math.sin(preview.t * .6) * .9; preview.av.tick(preview.t, false); } r.render(scene, cam); preview.raf = requestAnimationFrame(loop); };
  preview.loop = loop;
}
export function openShop(color) {
  baseColor = color || baseColor; tryOn = null; $('shop').hidden = false;
  if (!preview) initPreview(); render(); if (!preview.raf) preview.loop();
}
export function initShop() {
  $('shopTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cat = b.dataset.cat; tryOn = null; render(); });
  $('shopGrid').addEventListener('mouseover', e => { const b = e.target.closest('button.item'); const id = b && b.dataset.id; if (id !== tryOn) { tryOn = id || null; rebuildPreview(); } });
  $('shopGrid').addEventListener('mouseleave', () => { tryOn = null; rebuildPreview(); });
  $('shopGrid').addEventListener('click', e => {
    const b = e.target.closest('button.item'); if (!b) return;
    if (b.dataset.none) { delete prof.cos[cat]; changed(); render(); return; }
    const it = ITEM[b.dataset.id]; if (!it) return;
    if (!prof.owned.includes(it.id)) {
      if (prof.wallet < it.price) { $('shopNote').textContent = `${it.name} costs $${it.price.toLocaleString()}. You have $${prof.wallet.toLocaleString()}. Escape with more money to afford it.`; return; }
      prof.wallet -= it.price; prof.owned.push(it.id);
    }
    prof.cos[it.cat] = it.id; tryOn = null; changed(); render();
  });
  $('shopClose').onclick = () => { $('shop').hidden = true; };
}
