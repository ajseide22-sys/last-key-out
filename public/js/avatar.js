// Player avatars and the cosmetics they can wear. cos = { color, hat, acc, light } (item ids).
import * as THREE from 'three';
import { toon } from './props.js';

export const ITEMS = [
  // body colors
  { id: 'c-crimson', cat: 'color', name: 'Crimson', price: 60, hex: 0xc8323e },
  { id: 'c-ocean', cat: 'color', name: 'Ocean', price: 60, hex: 0x2f7fd0 },
  { id: 'c-lime', cat: 'color', name: 'Lime', price: 60, hex: 0x7ccc3a },
  { id: 'c-tangerine', cat: 'color', name: 'Tangerine', price: 60, hex: 0xf08a24 },
  { id: 'c-violet', cat: 'color', name: 'Violet', price: 90, hex: 0x8a4fd0 },
  { id: 'c-bubblegum', cat: 'color', name: 'Bubblegum', price: 90, hex: 0xf27fb8 },
  { id: 'c-bone', cat: 'color', name: 'Bone', price: 150, hex: 0xe8dfc8 },
  { id: 'c-midnight', cat: 'color', name: 'Midnight', price: 200, hex: 0x232040 },
  { id: 'c-gold', cat: 'color', name: 'Solid Gold', price: 1500, hex: 0xe8b830, metal: true },
  // hats
  { id: 'h-beanie', cat: 'hat', name: 'Beanie', price: 80 },
  { id: 'h-cone', cat: 'hat', name: 'Traffic Cone', price: 120 },
  { id: 'h-top', cat: 'hat', name: 'Top Hat', price: 150 },
  { id: 'h-chef', cat: 'hat', name: 'Chef Hat', price: 200 },
  { id: 'h-cowboy', cat: 'hat', name: 'Cowboy Hat', price: 250 },
  { id: 'h-horns', cat: 'hat', name: 'Devil Horns', price: 350 },
  { id: 'h-wizard', cat: 'hat', name: 'Wizard Hat', price: 400 },
  { id: 'h-viking', cat: 'hat', name: 'Viking Helmet', price: 500 },
  { id: 'h-halo', cat: 'hat', name: 'Halo', price: 600 },
  { id: 'h-pumpkin', cat: 'hat', name: 'Pumpkin Head', price: 800 },
  { id: 'h-crown', cat: 'hat', name: 'Crown', price: 1200 },
  // accessories
  { id: 'a-bowtie', cat: 'acc', name: 'Bow Tie', price: 60 },
  { id: 'a-mustache', cat: 'acc', name: 'Mustache', price: 70 },
  { id: 'a-glasses', cat: 'acc', name: 'Glasses', price: 90 },
  { id: 'a-scarf', cat: 'acc', name: 'Scarf', price: 100 },
  { id: 'a-backpack', cat: 'acc', name: 'Backpack', price: 220 },
  { id: 'a-cape', cat: 'acc', name: 'Cape', price: 450 },
  // flashlight colors (everyone sees your beam)
  { id: 'l-cold', cat: 'light', name: 'Cold White', price: 100, hex: 0xe8f2ff },
  { id: 'l-ice', cat: 'light', name: 'Ice Blue', price: 200, hex: 0x8fd0ff },
  { id: 'l-toxic', cat: 'light', name: 'Toxic Green', price: 300, hex: 0xa8ff7a },
  { id: 'l-violet', cat: 'light', name: 'Violet', price: 300, hex: 0xc8a0ff },
  { id: 'l-blood', cat: 'light', name: 'Blood Red', price: 400, hex: 0xff7a6a },
];
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const CATS = [{ id: 'hat', name: 'Hats' }, { id: 'acc', name: 'Accessories' }, { id: 'color', name: 'Colors' }, { id: 'light', name: 'Flashlight' }];
export const DEFAULT_LIGHT = 0xfff1d6;
export const lightColor = cos => (cos && ITEM[cos.light] && ITEM[cos.light].hex) || DEFAULT_LIGHT;

function M(geo, mat, x, y, z, p) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; p.add(m); return m; }

function buildHat(id, head) {
  const g = new THREE.Group(); g.position.y = .26; head.add(g);
  const black = toon(0x1a1820), gold = new THREE.MeshStandardMaterial({ color: 0xe8b830, metalness: .9, roughness: .25 });
  switch (id) {
    case 'h-beanie': { const m = toon(0xd0402a); M(new THREE.SphereGeometry(.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, -.08, 0, g); M(new THREE.TorusGeometry(.29, .045, 8, 20), toon(0xf0e0c0), 0, -.08, 0, g).rotation.x = Math.PI / 2; M(new THREE.SphereGeometry(.08, 10, 8), toon(0xf0e0c0), 0, .22, 0, g); break; }
    case 'h-cone': { M(new THREE.ConeGeometry(.22, .6, 16), toon(0xff7a1a), 0, .22, 0, g); M(new THREE.CylinderGeometry(.13, .16, .1, 16), toon(0xffffff), 0, .2, 0, g); M(new THREE.BoxGeometry(.5, .05, .5), toon(0xff7a1a), 0, -.07, 0, g); break; }
    case 'h-top': { M(new THREE.CylinderGeometry(.42, .42, .03, 24), black, 0, -.04, 0, g); M(new THREE.CylinderGeometry(.22, .23, .45, 24), black, 0, .2, 0, g); M(new THREE.CylinderGeometry(.235, .235, .07, 24), toon(0x8a1a2a), 0, .02, 0, g); break; }
    case 'h-chef': { const w = toon(0xf8f6f0); M(new THREE.CylinderGeometry(.25, .25, .22, 20), w, 0, .04, 0, g); for (let k = 0; k < 5; k++) M(new THREE.SphereGeometry(.15, 10, 8), w, Math.cos(k * 1.26) * .13, .22, Math.sin(k * 1.26) * .13, g); M(new THREE.SphereGeometry(.16, 10, 8), w, 0, .28, 0, g); break; }
    case 'h-cowboy': { const b = toon(0x8a5a2a); const brim = M(new THREE.CylinderGeometry(.55, .55, .03, 24), b, 0, -.04, 0, g); brim.scale.z = .8; M(new THREE.CylinderGeometry(.2, .26, .3, 16), b, 0, .12, 0, g); M(new THREE.CylinderGeometry(.265, .265, .05, 16), toon(0x2a1a0a), 0, .0, 0, g); break; }
    case 'h-horns': { const r = toon(0xc81a1a); [-1, 1].forEach(s => { const h = M(new THREE.ConeGeometry(.07, .3, 10), r, s * .18, .06, .05, g); h.rotation.z = -s * .45; }); break; }
    case 'h-wizard': { const p = toon(0x4a2a9a); M(new THREE.CylinderGeometry(.45, .45, .03, 24), p, 0, -.04, 0, g); const c = M(new THREE.ConeGeometry(.26, .75, 20), p, 0, .33, 0, g); c.rotation.z = .15; for (let k = 0; k < 4; k++) M(new THREE.OctahedronGeometry(.04), toon(0xffd84a), Math.cos(k * 1.6) * .17, .1 + k * .12, Math.sin(k * 1.6) * .17, g); break; }
    case 'h-viking': { const s = new THREE.MeshStandardMaterial({ color: 0x9a96a6, metalness: .8, roughness: .35 }); M(new THREE.SphereGeometry(.31, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), s, 0, -.1, 0, g); M(new THREE.TorusGeometry(.31, .03, 6, 20), gold, 0, -.1, 0, g).rotation.x = Math.PI / 2; [-1, 1].forEach(k => { const h = M(new THREE.ConeGeometry(.06, .32, 10), toon(0xf0e6d0), k * .32, .08, 0, g); h.rotation.z = -k * 1.0; }); break; }
    case 'h-halo': { const h = M(new THREE.TorusGeometry(.24, .03, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffe680 }), 0, .2, 0, g); h.rotation.x = Math.PI / 2; break; }
    case 'h-pumpkin': { g.position.y = 0; const p = M(new THREE.SphereGeometry(.4, 16, 12), toon(0xf07a1a), 0, 0, 0, g); p.scale.set(1.1, .9, 1.05); const dark = new THREE.MeshBasicMaterial({ color: 0xffb030 }); [-1, 1].forEach(s => M(new THREE.ConeGeometry(.06, .1, 3), dark, s * .13, .06, .38, g)); M(new THREE.BoxGeometry(.24, .05, .02), dark, 0, -.1, .39, g); M(new THREE.CylinderGeometry(.04, .05, .14, 6), toon(0x3a6a20), 0, .38, 0, g); break; }
    case 'h-crown': { M(new THREE.CylinderGeometry(.25, .25, .14, 20, 1, true), gold, 0, .02, 0, g); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; M(new THREE.ConeGeometry(.05, .14, 6), gold, Math.cos(a) * .24, .15, Math.sin(a) * .24, g); M(new THREE.SphereGeometry(.03, 8, 6), new THREE.MeshStandardMaterial({ color: [0xd01a3a, 0x2a6ad0, 0x2ad06a][k % 3], roughness: .1 }), Math.cos(a) * .25, .03, Math.sin(a) * .25, g); } break; }
  }
  return g;
}
function buildAcc(id, body, head) {
  switch (id) {
    case 'a-bowtie': { const r = toon(0xc81a2a); [-1, 1].forEach(s => { const c = M(new THREE.ConeGeometry(.07, .12, 4), r, s * .07, .9, .35, body); c.rotation.z = s * Math.PI / 2; }); M(new THREE.SphereGeometry(.035, 8, 6), r, 0, .9, .37, body); break; }
    case 'a-mustache': { const b = toon(0x2a1a10); [-1, 1].forEach(s => { const m = M(new THREE.CapsuleGeometry(.03, .12, 4, 8), b, s * .08, -.06, .32, head); m.rotation.z = s * 1.2; }); break; }
    case 'a-glasses': { const f = toon(0x1a1820); [-1, 1].forEach(s => M(new THREE.TorusGeometry(.075, .015, 6, 18), f, s * .13, .06, .34, head)); M(new THREE.BoxGeometry(.1, .015, .015), f, 0, .07, .35, head); break; }
    case 'a-scarf': { const r = toon(0xd03a3a); M(new THREE.TorusGeometry(.3, .07, 8, 20), r, 0, .92, 0, body).rotation.x = Math.PI / 2; const t = M(new THREE.BoxGeometry(.12, .4, .05), r, .12, .7, .33, body); t.rotation.z = .2; break; }
    case 'a-backpack': { const b = toon(0x3a6a3a); M(new THREE.BoxGeometry(.45, .5, .22), b, 0, .6, -.42, body); M(new THREE.BoxGeometry(.3, .2, .08), toon(0x2a4a2a), 0, .5, -.55, body); break; }
    case 'a-cape': { const c = new THREE.Mesh(new THREE.PlaneGeometry(.75, .95, 4, 4), new THREE.MeshToonMaterial({ color: 0x8a1020, side: THREE.DoubleSide })); c.position.set(0, .5, -.42); c.rotation.x = .12; c.castShadow = true; body.add(c); return c; }
  }
  return null;
}
// The avatar: a round little explorer with a hand torch. Returns handles the game animates.
export function makeAvatar(cos = {}, baseColor = '#ff6b6b') {
  const g = new THREE.Group(); const item = ITEM[cos.color]; const c = item ? item.hex : new THREE.Color(baseColor).getHex();
  const m = item && item.metal ? new THREE.MeshStandardMaterial({ color: c, metalness: .9, roughness: .25 }) : toon(c);
  const white = toon(0xffffff), black = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const bodyG = new THREE.Group(); g.add(bodyG);
  const body = M(new THREE.SphereGeometry(.42, 20, 14), m, 0, .55, 0, bodyG); body.scale.set(1, 1.15, 1);
  const head = new THREE.Group(); head.position.y = 1.2; g.add(head);
  if (cos.hat !== 'h-pumpkin') { M(new THREE.SphereGeometry(.34, 20, 14), m, 0, 0, 0, head); [-1, 1].forEach(s => { M(new THREE.SphereGeometry(.09, 10, 8), white, s * .13, .06, .27, head); M(new THREE.SphereGeometry(.045, 8, 6), black, s * .13, .06, .35, head); }); }
  if (cos.hat) buildHat(cos.hat, head);
  const cape = cos.acc ? buildAcc(cos.acc, bodyG, head) : null;
  const torch = M(new THREE.CylinderGeometry(.05, .06, .26, 8), toon(0x3a3346), .38, -.45, .25, head); torch.rotation.x = Math.PI / 2;
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: lightColor(cos), transparent: true, opacity: .06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(.38, -.45, 3.25); head.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .04, 6, 28), new THREE.MeshBasicMaterial({ color: 0x7dffc4, transparent: true, opacity: 0 })); ring.rotation.x = Math.PI / 2; ring.position.y = 1.95; g.add(ring);
  return { g, head, beam, ring, body, cape, rx: 0, rz: 0, ry: 0, init: false };
}
