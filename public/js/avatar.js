// Player avatars and every cosmetic. cos = { model, color, hat, acc, light } (item ids, all optional).
import * as THREE from 'three';
import { toon } from './props.js';

export const ITEMS = [
  // characters
  { id: 'm-robot', cat: 'model', name: 'Robot', price: 400 },
  { id: 'm-frog', cat: 'model', name: 'Frog', price: 450 },
  { id: 'm-ghost', cat: 'model', name: 'Ghost', price: 500 },
  { id: 'm-cat', cat: 'model', name: 'Cat', price: 600 },
  { id: 'm-bear', cat: 'model', name: 'Bear', price: 600 },
  { id: 'm-penguin', cat: 'model', name: 'Penguin', price: 650 },
  { id: 'm-skeleton', cat: 'model', name: 'Skeleton', price: 700 },
  { id: 'm-alien', cat: 'model', name: 'Alien', price: 800 },
  { id: 'm-mummy', cat: 'model', name: 'Mummy', price: 900 },
  { id: 'm-knight', cat: 'model', name: 'Knight', price: 1000 },
  { id: 'm-astronaut', cat: 'model', name: 'Astronaut', price: 1500 },
  { id: 'm-shadow', cat: 'model', name: 'Shadow', price: 2500 },
  // colors (tint the character's body)
  { id: 'c-crimson', cat: 'color', name: 'Crimson', price: 60, hex: 0xc8323e },
  { id: 'c-ocean', cat: 'color', name: 'Ocean', price: 60, hex: 0x2f7fd0 },
  { id: 'c-lime', cat: 'color', name: 'Lime', price: 60, hex: 0x7ccc3a },
  { id: 'c-tangerine', cat: 'color', name: 'Tangerine', price: 60, hex: 0xf08a24 },
  { id: 'c-mint', cat: 'color', name: 'Mint', price: 80, hex: 0x7fe0c0 },
  { id: 'c-rose', cat: 'color', name: 'Rose', price: 80, hex: 0xe86a8a },
  { id: 'c-violet', cat: 'color', name: 'Violet', price: 90, hex: 0x8a4fd0 },
  { id: 'c-bubblegum', cat: 'color', name: 'Bubblegum', price: 90, hex: 0xf27fb8 },
  { id: 'c-bone', cat: 'color', name: 'Bone', price: 150, hex: 0xe8dfc8 },
  { id: 'c-charcoal', cat: 'color', name: 'Charcoal', price: 150, hex: 0x3a3a40 },
  { id: 'c-midnight', cat: 'color', name: 'Midnight', price: 200, hex: 0x232040 },
  { id: 'c-toxic', cat: 'color', name: 'Toxic Glow', price: 700, hex: 0x6aff3a, glow: true },
  { id: 'c-chrome', cat: 'color', name: 'Chrome', price: 1200, hex: 0xd8dce8, metal: true },
  { id: 'c-gold', cat: 'color', name: 'Solid Gold', price: 1500, hex: 0xe8b830, metal: true },
  { id: 'c-rainbow', cat: 'color', name: 'Rainbow', price: 3000, hex: 0xff4080, rainbow: true },
  // hats
  { id: 'h-beanie', cat: 'hat', name: 'Beanie', price: 80 },
  { id: 'h-party', cat: 'hat', name: 'Party Hat', price: 90 },
  { id: 'h-cone', cat: 'hat', name: 'Traffic Cone', price: 120 },
  { id: 'h-catears', cat: 'hat', name: 'Cat Ears', price: 140 },
  { id: 'h-top', cat: 'hat', name: 'Top Hat', price: 150 },
  { id: 'h-bunny', cat: 'hat', name: 'Bunny Ears', price: 160 },
  { id: 'h-chef', cat: 'hat', name: 'Chef Hat', price: 200 },
  { id: 'h-headphones', cat: 'hat', name: 'Headphones', price: 220 },
  { id: 'h-cowboy', cat: 'hat', name: 'Cowboy Hat', price: 250 },
  { id: 'h-grad', cat: 'hat', name: 'Graduation Cap', price: 260 },
  { id: 'h-santa', cat: 'hat', name: 'Santa Hat', price: 280 },
  { id: 'h-propeller', cat: 'hat', name: 'Propeller Cap', price: 300 },
  { id: 'h-flowers', cat: 'hat', name: 'Flower Crown', price: 320 },
  { id: 'h-horns', cat: 'hat', name: 'Devil Horns', price: 350 },
  { id: 'h-pirate', cat: 'hat', name: 'Pirate Hat', price: 380 },
  { id: 'h-wizard', cat: 'hat', name: 'Wizard Hat', price: 400 },
  { id: 'h-antlers', cat: 'hat', name: 'Antlers', price: 450 },
  { id: 'h-viking', cat: 'hat', name: 'Viking Helmet', price: 500 },
  { id: 'h-halo', cat: 'hat', name: 'Halo', price: 600 },
  { id: 'h-pumpkin', cat: 'hat', name: 'Pumpkin Head', price: 800 },
  { id: 'h-crown', cat: 'hat', name: 'Crown', price: 1200 },
  // accessories
  { id: 'a-bowtie', cat: 'acc', name: 'Bow Tie', price: 60 },
  { id: 'a-mustache', cat: 'acc', name: 'Mustache', price: 70 },
  { id: 'a-necktie', cat: 'acc', name: 'Necktie', price: 80 },
  { id: 'a-glasses', cat: 'acc', name: 'Glasses', price: 90 },
  { id: 'a-scarf', cat: 'acc', name: 'Scarf', price: 100 },
  { id: 'a-monocle', cat: 'acc', name: 'Monocle', price: 140 },
  { id: 'a-eyepatch', cat: 'acc', name: 'Eye Patch', price: 150 },
  { id: 'a-backpack', cat: 'acc', name: 'Backpack', price: 220 },
  { id: 'a-chain', cat: 'acc', name: 'Gold Chain', price: 300 },
  { id: 'a-tail', cat: 'acc', name: 'Devil Tail', price: 320 },
  { id: 'a-balloon', cat: 'acc', name: 'Red Balloon', price: 350 },
  { id: 'a-sword', cat: 'acc', name: 'Sword on Back', price: 400 },
  { id: 'a-cape', cat: 'acc', name: 'Cape', price: 450 },
  { id: 'a-batwings', cat: 'acc', name: 'Bat Wings', price: 700 },
  { id: 'a-angelwings', cat: 'acc', name: 'Angel Wings', price: 900 },
  { id: 'a-petghost', cat: 'acc', name: 'Pet Ghost', price: 1100 },
  // flashlight colors (everyone sees your beam)
  { id: 'l-cold', cat: 'light', name: 'Cold White', price: 100, hex: 0xe8f2ff },
  { id: 'l-sunset', cat: 'light', name: 'Sunset Orange', price: 150, hex: 0xffb070 },
  { id: 'l-ice', cat: 'light', name: 'Ice Blue', price: 200, hex: 0x8fd0ff },
  { id: 'l-pink', cat: 'light', name: 'Hot Pink', price: 250, hex: 0xff8ad0 },
  { id: 'l-toxic', cat: 'light', name: 'Toxic Green', price: 300, hex: 0xa8ff7a },
  { id: 'l-violet', cat: 'light', name: 'Violet', price: 300, hex: 0xc8a0ff },
  { id: 'l-blood', cat: 'light', name: 'Blood Red', price: 400, hex: 0xff7a6a },
  { id: 'l-gold', cat: 'light', name: 'Gold', price: 500, hex: 0xffd860 },
];
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const CATS = [{ id: 'model', name: 'Characters' }, { id: 'hat', name: 'Hats' }, { id: 'acc', name: 'Accessories' }, { id: 'color', name: 'Colors' }, { id: 'light', name: 'Flashlight' }];
export const DEFAULT_LIGHT = 0xfff1d6;
export const lightColor = cos => (cos && ITEM[cos.light] && ITEM[cos.light].hex) || DEFAULT_LIGHT;

function M(geo, mat, x, y, z, p) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; p.add(m); return m; }
const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .5, metalness: 0 }, o));
const glowM = color => new THREE.MeshBasicMaterial({ color });
const capsule = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 12);
function eyes(head, white, black, y = .06, z = .27, sp = .13) { [-1, 1].forEach(s => { M(new THREE.SphereGeometry(.09, 10, 8), white, s * sp, y, z, head); M(new THREE.SphereGeometry(.045, 8, 6), black, s * sp, y, z + .08, head); }); }
const H = (mesh) => { mesh.userData.headMesh = true; return mesh; };

/* ---------------- character models ---------------- */
// Each builds into (body, head) and returns { top } — how far above the head's center hats should sit.
const MODELS = {
  blob(body, head, m) { M(new THREE.SphereGeometry(.42, 20, 14), m, 0, .55, 0, body).scale.set(1, 1.15, 1); H(M(new THREE.SphereGeometry(.34, 20, 14), m, 0, 0, 0, head)); eyes(head, toon(0xffffff), glowM(0x111111)); return { top: .26 }; },
  robot(body, head, m) {
    const steel = std(0x9a9eaa, { metalness: .8, roughness: .3 });
    M(new THREE.BoxGeometry(.66, .62, .48), m, 0, .58, 0, body); M(new THREE.BoxGeometry(.36, .22, .02), std(0x1a1c22), 0, .64, .25, body);
    [0, 1, 2].forEach(i => M(new THREE.SphereGeometry(.03, 8, 6), glowM([0xff4040, 0x40ff80, 0x40a0ff][i]), -.1 + i * .1, .64, .265, body));
    [-1, 1].forEach(s => { M(new THREE.BoxGeometry(.16, .3, .18), steel, s * .18, .13, 0, body); M(new THREE.CylinderGeometry(.05, .05, .4, 8), steel, s * .4, .6, 0, body); });
    H(M(new THREE.BoxGeometry(.52, .42, .44), m, 0, 0, 0, head)); H(M(new THREE.BoxGeometry(.42, .26, .02), std(0x0a0c10, { roughness: .2 }), 0, 0, .225, head));
    [-1, 1].forEach(s => H(M(new THREE.BoxGeometry(.08, .06, .02), glowM(0x5af0ff), s * .1, .02, .24, head)));
    M(new THREE.CylinderGeometry(.015, .015, .2, 6), steel, 0, .31, 0, head); M(new THREE.SphereGeometry(.04, 8, 6), glowM(0xff3030), 0, .42, 0, head);
    return { top: .22 };
  },
  ghost(body, head, m) {
    const sheet = new THREE.MeshToonMaterial({ color: m.color, side: THREE.DoubleSide, transparent: true, opacity: .92 });
    const geo = new THREE.CylinderGeometry(.36, .46, 1, 22, 4, true); const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) if (pos.getY(i) < -.45) pos.setY(i, pos.getY(i) + Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 6) * .07); geo.computeVertexNormals();
    M(geo, sheet, 0, .62, 0, body); H(M(new THREE.SphereGeometry(.37, 20, 14, 0, Math.PI * 2, 0, Math.PI * .6), sheet, 0, -.08, 0, head));
    [-1, 1].forEach(s => H(M(new THREE.SphereGeometry(.07, 10, 8), glowM(0x111111), s * .12, .02, .31, head)).scale.set(.8, 1.3, .4));
    H(M(new THREE.SphereGeometry(.05, 8, 6), glowM(0x111111), 0, -.12, .32, head)).scale.set(1, 1.4, .4);
    return { top: .28, float: true };
  },
  cat(body, head, m) {
    const pink = toon(0xf0a0b0); MODELS.blob(body, head, m);
    [-1, 1].forEach(s => { const e = M(new THREE.ConeGeometry(.1, .2, 4), m, s * .2, .28, 0, head); e.rotation.z = -s * .3; M(new THREE.ConeGeometry(.05, .1, 4), pink, s * .2, .27, .03, head).rotation.z = -s * .3; });
    M(new THREE.SphereGeometry(.035, 8, 6), pink, 0, -.03, .34, head);
    [-1, 1].forEach(s => [-.03, .01].forEach(y => { const w = M(new THREE.BoxGeometry(.2, .006, .006), glowM(0x222222), s * .17, -.05 + y, .3, head); w.rotation.z = s * y * 4; }));
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .35, -.4), new THREE.Vector3(0, .25, -.65), new THREE.Vector3(0, .55, -.8), new THREE.Vector3(.05, .85, -.72)]);
    M(new THREE.TubeGeometry(curve, 16, .045, 8), m, 0, 0, 0, body);
    return { top: .3 };
  },
  bear(body, head, m) {
    const light = toon(0xe8d0b0); MODELS.blob(body, head, m);
    M(new THREE.SphereGeometry(.24, 14, 10), light, 0, .52, .26, body).scale.set(1, 1.2, .5);
    [-1, 1].forEach(s => { M(new THREE.SphereGeometry(.11, 12, 10), m, s * .24, .24, 0, head); M(new THREE.SphereGeometry(.06, 10, 8), light, s * .24, .24, .05, head); });
    M(new THREE.SphereGeometry(.13, 12, 10), light, 0, -.08, .27, head).scale.set(1.1, .8, .8); M(new THREE.SphereGeometry(.04, 8, 6), glowM(0x1a1010), 0, -.04, .37, head);
    return { top: .3 };
  },
  frog(body, head, m) {
    const belly = toon(0xd8f0a0); M(new THREE.SphereGeometry(.5, 20, 14), m, 0, .5, 0, body).scale.set(1.1, .95, 1); M(new THREE.SphereGeometry(.36, 14, 10), belly, 0, .46, .2, body).scale.set(1, 1.1, .6);
    head.position.y = 1.0;
    [-1, 1].forEach(s => { H(M(new THREE.SphereGeometry(.14, 12, 10), m, s * .2, .12, .08, head)); H(M(new THREE.SphereGeometry(.1, 10, 8), toon(0xffffff), s * .2, .15, .17, head)); H(M(new THREE.SphereGeometry(.05, 8, 6), glowM(0x111111), s * .2, .15, .25, head)); });
    H(M(new THREE.TorusGeometry(.22, .015, 6, 20, Math.PI), glowM(0x3a1a10), 0, -.08, .34, head)).rotation.z = Math.PI;
    [-1, 1].forEach(s => M(new THREE.SphereGeometry(.13, 10, 8), m, s * .3, .06, .2, body).scale.set(1.2, .4, 1.4));
    return { top: .3 };
  },
  penguin(body, head, m) {
    const black = toon(0x1a1c24), white = toon(0xf4f4f0), orange = toon(0xf09a2a);
    M(new THREE.SphereGeometry(.44, 20, 14), black, 0, .6, 0, body).scale.set(1, 1.3, .95); M(new THREE.SphereGeometry(.34, 16, 12), white, 0, .55, .14, body).scale.set(1, 1.3, .7);
    [-1, 1].forEach(s => { const w = M(new THREE.SphereGeometry(.12, 10, 8), black, s * .44, .6, 0, body); w.scale.set(.3, 1.6, .9); w.rotation.z = s * .25; M(new THREE.BoxGeometry(.14, .05, .2), orange, s * .14, .03, .1, body); });
    H(M(new THREE.SphereGeometry(.32, 18, 12), black, 0, 0, 0, head)); H(M(new THREE.SphereGeometry(.24, 14, 10), white, 0, -.02, .12, head)).scale.set(1.1, .9, .8);
    eyes(head, toon(0xffffff), glowM(0x111111), .06, .26, .1);
    const beak = M(new THREE.ConeGeometry(.06, .16, 8), orange, 0, -.04, .36, head); beak.rotation.x = Math.PI / 2;
    // the scarf color shows off the color item
    M(new THREE.TorusGeometry(.26, .05, 8, 20), m, 0, .97, 0, body).rotation.x = Math.PI / 2;
    return { top: .26 };
  },
  skeleton(body, head) {
    const bone = std(0xe8e0cc, { roughness: .6 }), dark = glowM(0x050505);
    M(capsule(.035, .5), bone, 0, .66, -.05, body);
    for (let k = 0; k < 4; k++) { const r = M(new THREE.TorusGeometry(.2 - k * .015, .02, 6, 18, Math.PI * 1.3), bone, 0, .85 - k * .09, 0, body); r.rotation.set(Math.PI / 2, 0, Math.PI * -.15); }
    M(new THREE.SphereGeometry(.15, 12, 8), bone, 0, .36, 0, body).scale.set(1.3, .6, .8);
    [-1, 1].forEach(s => { M(capsule(.03, .3), bone, s * .1, .16, 0, body); M(capsule(.025, .42), bone, s * .3, .66, 0, body).rotation.z = s * .15; });
    H(M(new THREE.SphereGeometry(.3, 18, 14), bone, 0, .02, 0, head)).scale.set(.95, 1, 1);
    [-1, 1].forEach(s => H(M(new THREE.SphereGeometry(.08, 10, 8), dark, s * .11, .04, .24, head)).scale.set(1, 1.15, .5));
    H(M(new THREE.ConeGeometry(.035, .07, 3), dark, 0, -.06, .28, head)).rotation.x = Math.PI;
    for (let k = -3; k <= 3; k++) H(M(new THREE.BoxGeometry(.035, .05, .02), bone, k * .04, -.19, .22, head));
    [-1, 1].forEach(s => H(M(new THREE.SphereGeometry(.015, 6, 5), glowM(0xff3020), s * .11, .04, .27, head)));
    return { top: .26 };
  },
  alien(body, head, m) {
    M(capsule(.24, .5), m, 0, .55, 0, body); [-1, 1].forEach(s => { M(capsule(.045, .45), m, s * .3, .6, 0, body).rotation.z = s * .2; M(capsule(.06, .3), m, s * .1, .15, 0, body); });
    head.position.y = 1.25;
    H(M(new THREE.SphereGeometry(.36, 20, 14), m, 0, .08, 0, head)).scale.set(1, 1.2, 1);
    [-1, 1].forEach(s => { const e = H(M(new THREE.SphereGeometry(.1, 12, 10), std(0x050508, { roughness: .05, metalness: .3 }), s * .13, .02, .27, head)); e.scale.set(1.3, .75, .5); e.rotation.z = -s * .45; });
    [-1, 1].forEach(s => { const a = M(new THREE.CylinderGeometry(.012, .012, .3, 6), m, s * .12, .48, 0, head); a.rotation.z = -s * .3; M(new THREE.SphereGeometry(.04, 8, 6), glowM(0xc0ff60), s * .17, .62, 0, head); });
    return { top: .46 };
  },
  mummy(body, head) {
    const wrap = toon(0xd8ccae), wrap2 = toon(0xbcae8c);
    M(capsule(.32, .4), wrap, 0, .55, 0, body);
    for (let k = 0; k < 7; k++) { const r = M(new THREE.TorusGeometry(.33, .025, 4, 22), k % 2 ? wrap : wrap2, 0, .25 + k * .1, 0, body); r.rotation.set(Math.PI / 2 + (k % 2 ? .12 : -.12), 0, 0); }
    H(M(new THREE.SphereGeometry(.32, 18, 14), wrap, 0, 0, 0, head));
    for (let k = 0; k < 5; k++) { const r = H(M(new THREE.TorusGeometry(.31 - Math.abs(k - 2) * .03, .022, 4, 22), k % 2 ? wrap2 : wrap, 0, -.16 + k * .08, 0, head)); r.rotation.set(Math.PI / 2 + (k - 2) * .1, 0, 0); }
    H(M(new THREE.SphereGeometry(.05, 8, 6), glowM(0xfff0a0), .1, .05, .29, head));
    const loose = M(new THREE.BoxGeometry(.06, .4, .01), wrap, -.2, .55, .3, body); loose.rotation.z = .3;
    return { top: .28 };
  },
  knight(body, head, m) {
    const steel = std(0xb0b4c0, { metalness: .85, roughness: .3 });
    M(new THREE.CylinderGeometry(.34, .4, .62, 16), steel, 0, .62, 0, body); M(new THREE.CylinderGeometry(.42, .44, .12, 16), steel, 0, .3, 0, body);
    [-1, 1].forEach(s => { M(new THREE.SphereGeometry(.15, 12, 8), steel, s * .38, .88, 0, body); M(new THREE.CylinderGeometry(.08, .09, .3, 10), steel, s * .14, .14, 0, body); });
    M(new THREE.BoxGeometry(.3, .4, .03), m, 0, .62, .37, body); // tabard in your color
    H(M(new THREE.CylinderGeometry(.3, .3, .5, 18), steel, 0, 0, 0, head)); H(M(new THREE.SphereGeometry(.3, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, .25, 0, head));
    H(M(new THREE.BoxGeometry(.4, .04, .02), glowM(0x0a0a0a), 0, .05, .3, head)); H(M(new THREE.BoxGeometry(.04, .2, .02), glowM(0x0a0a0a), 0, -.07, .3, head));
    const plume = M(new THREE.SphereGeometry(.09, 10, 8), m, 0, .6, -.05, head); plume.scale.set(.6, 2, 1.8);
    return { top: .5 };
  },
  astronaut(body, head, m) {
    const suit = toon(0xf0f0f0), visor = std(0xc89a3a, { metalness: .9, roughness: .1 });
    M(capsule(.36, .35), suit, 0, .58, 0, body); M(new THREE.BoxGeometry(.5, .55, .25), suit, 0, .65, -.35, body);
    M(new THREE.BoxGeometry(.24, .14, .03), m, 0, .72, .35, body);
    [-1, 1].forEach(s => M(new THREE.CylinderGeometry(.1, .11, .26, 10), suit, s * .15, .13, 0, body));
    H(M(new THREE.SphereGeometry(.28, 16, 12), toon(0xf0c8a0), 0, 0, 0, head)); eyes(head, toon(0xffffff), glowM(0x111111), .04, .22, .1);
    const dome = M(new THREE.SphereGeometry(.4, 20, 16), new THREE.MeshStandardMaterial({ color: 0xc8e0ff, transparent: true, opacity: .25, roughness: .05, metalness: .2 }), 0, .02, 0, head);
    H(M(new THREE.SphereGeometry(.405, 20, 12, -Math.PI * .35, Math.PI * .7, Math.PI * .25, Math.PI * .3), visor, 0, .02, 0, head));
    M(new THREE.TorusGeometry(.34, .05, 8, 22), suit, 0, -.28, 0, head).rotation.x = Math.PI / 2;
    return { top: .4 };
  },
  shadow(body, head) {
    const dark = new THREE.MeshBasicMaterial({ color: 0x020203 });
    M(new THREE.ConeGeometry(.45, 1.15, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0x020203, side: THREE.DoubleSide }), 0, .5, 0, body);
    H(M(new THREE.SphereGeometry(.33, 18, 14), dark, 0, 0, 0, head));
    [-1, 1].forEach(s => H(M(new THREE.SphereGeometry(.05, 10, 8), glowM(0xffffff), s * .12, .04, .3, head)).scale.set(1.4, .6, .5));
    H(M(new THREE.TorusGeometry(.14, .012, 6, 20, Math.PI), glowM(0xffffff), 0, -.08, .31, head)).rotation.z = Math.PI;
    return { top: .26 };
  },
};

/* ---------------- hats ---------------- */
function buildHat(id, head, top) {
  const g = new THREE.Group(); g.position.y = top; head.add(g);
  const black = toon(0x1a1820), gold = std(0xe8b830, { metalness: .9, roughness: .25 }), white = toon(0xf8f6f0);
  switch (id) {
    case 'h-beanie': { const m = toon(0xd0402a); M(new THREE.SphereGeometry(.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, -.08, 0, g); M(new THREE.TorusGeometry(.29, .045, 8, 20), toon(0xf0e0c0), 0, -.08, 0, g).rotation.x = Math.PI / 2; M(new THREE.SphereGeometry(.08, 10, 8), toon(0xf0e0c0), 0, .22, 0, g); break; }
    case 'h-party': { const c = M(new THREE.ConeGeometry(.16, .42, 16), toon(0x3a8ad0), 0, .14, 0, g); c.rotation.z = .2; for (let k = 0; k < 3; k++) M(new THREE.TorusGeometry(.13 - k * .04, .02, 6, 16), toon(0xffd84a), -.03 - k * .025, -.02 + k * .12, 0, g).rotation.x = Math.PI / 2; M(new THREE.SphereGeometry(.05, 8, 6), toon(0xff4a8a), -.08, .36, 0, g); break; }
    case 'h-cone': { M(new THREE.ConeGeometry(.22, .6, 16), toon(0xff7a1a), 0, .22, 0, g); M(new THREE.CylinderGeometry(.13, .16, .1, 16), white, 0, .2, 0, g); M(new THREE.BoxGeometry(.5, .05, .5), toon(0xff7a1a), 0, -.07, 0, g); break; }
    case 'h-catears': { [-1, 1].forEach(s => { const e = M(new THREE.ConeGeometry(.1, .2, 4), black, s * .18, .02, 0, g); e.rotation.z = -s * .3; M(new THREE.ConeGeometry(.05, .1, 4), toon(0xf0a0b0), s * .18, .01, .03, g).rotation.z = -s * .3; }); M(new THREE.TorusGeometry(.3, .02, 6, 24, Math.PI), black, 0, -.12, 0, g).rotation.y = Math.PI / 2; break; }
    case 'h-top': { M(new THREE.CylinderGeometry(.42, .42, .03, 24), black, 0, -.04, 0, g); M(new THREE.CylinderGeometry(.22, .23, .45, 24), black, 0, .2, 0, g); M(new THREE.CylinderGeometry(.235, .235, .07, 24), toon(0x8a1a2a), 0, .02, 0, g); break; }
    case 'h-bunny': { [-1, 1].forEach(s => { const e = M(new THREE.CapsuleGeometry(.06, .3, 4, 10), white, s * .1, .2, 0, g); e.rotation.z = -s * .15; const i = M(new THREE.CapsuleGeometry(.03, .24, 4, 8), toon(0xf0a0b0), s * .1, .2, .04, g); i.rotation.z = -s * .15; }); break; }
    case 'h-chef': { M(new THREE.CylinderGeometry(.25, .25, .22, 20), white, 0, .04, 0, g); for (let k = 0; k < 5; k++) M(new THREE.SphereGeometry(.15, 10, 8), white, Math.cos(k * 1.26) * .13, .22, Math.sin(k * 1.26) * .13, g); M(new THREE.SphereGeometry(.16, 10, 8), white, 0, .28, 0, g); break; }
    case 'h-headphones': { M(new THREE.TorusGeometry(.33, .03, 8, 24, Math.PI), black, 0, -.2, 0, g).rotation.y = Math.PI / 2; [-1, 1].forEach(s => { const c = M(new THREE.CylinderGeometry(.11, .11, .08, 16), toon(0xd04a4a), s * .34, -.22, 0, g); c.rotation.z = Math.PI / 2; }); break; }
    case 'h-cowboy': { const b = toon(0x8a5a2a); M(new THREE.CylinderGeometry(.55, .55, .03, 24), b, 0, -.04, 0, g).scale.z = .8; M(new THREE.CylinderGeometry(.2, .26, .3, 16), b, 0, .12, 0, g); M(new THREE.CylinderGeometry(.265, .265, .05, 16), toon(0x2a1a0a), 0, .0, 0, g); break; }
    case 'h-grad': { M(new THREE.CylinderGeometry(.24, .26, .14, 16), black, 0, -.02, 0, g); M(new THREE.BoxGeometry(.56, .03, .56), black, 0, .07, 0, g).rotation.y = Math.PI / 4; const t = M(new THREE.BoxGeometry(.02, .22, .02), toon(0xffd84a), .26, -.03, 0, g); M(new THREE.SphereGeometry(.03, 6, 5), toon(0xffd84a), 0, .09, 0, g); break; }
    case 'h-santa': { const r = toon(0xd0202a); M(new THREE.TorusGeometry(.28, .06, 8, 20), white, 0, -.08, 0, g).rotation.x = Math.PI / 2; const c = M(new THREE.ConeGeometry(.27, .5, 16), r, .06, .16, 0, g); c.rotation.z = -.5; M(new THREE.SphereGeometry(.07, 10, 8), white, .28, .3, 0, g); break; }
    case 'h-propeller': { const cap = toon(0x2a6ad0); M(new THREE.SphereGeometry(.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), cap, 0, -.1, 0, g); M(new THREE.BoxGeometry(.2, .02, .16), toon(0x2a6ad0), 0, -.1, .3, g); M(new THREE.CylinderGeometry(.015, .015, .12, 6), black, 0, .24, 0, g); const p = new THREE.Group(); p.position.y = .3; g.add(p); [0, 1].forEach(k => M(new THREE.BoxGeometry(.4, .01, .06), toon([0xffd84a, 0xd03030][k]), 0, 0, 0, p).rotation.y = k * Math.PI / 2); g.userData.spin = p; break; }
    case 'h-flowers': { M(new THREE.TorusGeometry(.27, .025, 6, 24), toon(0x3a8a3a), 0, -.06, 0, g).rotation.x = Math.PI / 2; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; M(new THREE.SphereGeometry(.05, 8, 6), toon([0xf06a9a, 0xffd84a, 0xffffff, 0xa06af0][k % 4]), Math.cos(a) * .27, -.04, Math.sin(a) * .27, g); } break; }
    case 'h-horns': { const r = toon(0xc81a1a); [-1, 1].forEach(s => { const h = M(new THREE.ConeGeometry(.07, .3, 10), r, s * .18, .06, .05, g); h.rotation.z = -s * .45; }); break; }
    case 'h-pirate': { const p = M(new THREE.CylinderGeometry(.42, .3, .2, 3), black, 0, .02, 0, g); p.rotation.y = Math.PI; p.scale.z = .7; M(new THREE.SphereGeometry(.05, 8, 6), white, 0, .04, .2, g); [-1, 1].forEach(s => M(new THREE.BoxGeometry(.08, .015, .015), white, 0, .04, .21, g).rotation.z = s * .7); break; }
    case 'h-wizard': { const p = toon(0x4a2a9a); M(new THREE.CylinderGeometry(.45, .45, .03, 24), p, 0, -.04, 0, g); M(new THREE.ConeGeometry(.26, .75, 20), p, 0, .33, 0, g).rotation.z = .15; for (let k = 0; k < 4; k++) M(new THREE.OctahedronGeometry(.04), toon(0xffd84a), Math.cos(k * 1.6) * .17, .1 + k * .12, Math.sin(k * 1.6) * .17, g); break; }
    case 'h-antlers': { const b = toon(0x8a6a4a); [-1, 1].forEach(s => { const a = M(new THREE.CylinderGeometry(.025, .035, .4, 6), b, s * .16, .14, 0, g); a.rotation.z = -s * .35; [.08, .2].forEach((y, i) => { const t = M(new THREE.CylinderGeometry(.015, .025, .16, 6), b, s * (.2 + i * .05), y + .02, .02, g); t.rotation.z = -s * 1.1; }); }); break; }
    case 'h-viking': { const s = std(0x9a96a6, { metalness: .8, roughness: .35 }); M(new THREE.SphereGeometry(.31, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), s, 0, -.1, 0, g); M(new THREE.TorusGeometry(.31, .03, 6, 20), gold, 0, -.1, 0, g).rotation.x = Math.PI / 2; [-1, 1].forEach(k => M(new THREE.ConeGeometry(.06, .32, 10), toon(0xf0e6d0), k * .32, .08, 0, g).rotation.z = -k * 1.0); break; }
    case 'h-halo': { M(new THREE.TorusGeometry(.24, .03, 8, 28), glowM(0xffe680), 0, .2, 0, g).rotation.x = Math.PI / 2; g.userData.bob = true; break; }
    case 'h-pumpkin': { g.position.y = 0; head.traverse(o => { if (o.userData.headMesh) o.visible = false; }); const p = M(new THREE.SphereGeometry(.4, 16, 12), toon(0xf07a1a), 0, 0, 0, g); p.scale.set(1.1, .9, 1.05); const lit = glowM(0xffb030); [-1, 1].forEach(s => M(new THREE.ConeGeometry(.06, .1, 3), lit, s * .13, .06, .38, g)); M(new THREE.BoxGeometry(.24, .05, .02), lit, 0, -.1, .39, g); M(new THREE.CylinderGeometry(.04, .05, .14, 6), toon(0x3a6a20), 0, .38, 0, g); break; }
    case 'h-crown': { M(new THREE.CylinderGeometry(.25, .25, .14, 20, 1, true), gold, 0, .02, 0, g); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; M(new THREE.ConeGeometry(.05, .14, 6), gold, Math.cos(a) * .24, .15, Math.sin(a) * .24, g); M(new THREE.SphereGeometry(.03, 8, 6), std([0xd01a3a, 0x2a6ad0, 0x2ad06a][k % 3], { roughness: .1 }), Math.cos(a) * .25, .03, Math.sin(a) * .25, g); } break; }
  }
  return g;
}

/* ---------------- accessories ---------------- */
function buildAcc(id, body, head, root) {
  const out = {};
  switch (id) {
    case 'a-bowtie': { const r = toon(0xc81a2a); [-1, 1].forEach(s => { const c = M(new THREE.ConeGeometry(.07, .12, 4), r, s * .07, .9, .35, body); c.rotation.z = s * Math.PI / 2; }); M(new THREE.SphereGeometry(.035, 8, 6), r, 0, .9, .37, body); break; }
    case 'a-mustache': { const b = toon(0x2a1a10); [-1, 1].forEach(s => M(new THREE.CapsuleGeometry(.03, .12, 4, 8), b, s * .08, -.06, .32, head).rotation.z = s * 1.2); break; }
    case 'a-necktie': { const t = toon(0x2a4ad0); M(new THREE.BoxGeometry(.08, .06, .03), t, 0, .92, .36, body); const l = M(new THREE.BoxGeometry(.09, .32, .02), t, 0, .74, .38, body); l.rotation.x = -.15; break; }
    case 'a-glasses': { const f = toon(0x1a1820); [-1, 1].forEach(s => M(new THREE.TorusGeometry(.075, .015, 6, 18), f, s * .13, .06, .34, head)); M(new THREE.BoxGeometry(.1, .015, .015), f, 0, .07, .35, head); break; }
    case 'a-scarf': { const r = toon(0xd03a3a); M(new THREE.TorusGeometry(.3, .07, 8, 20), r, 0, .92, 0, body).rotation.x = Math.PI / 2; M(new THREE.BoxGeometry(.12, .4, .05), r, .12, .7, .33, body).rotation.z = .2; break; }
    case 'a-monocle': { M(new THREE.TorusGeometry(.08, .014, 6, 20), std(0xe8b830, { metalness: .9, roughness: .2 }), .13, .06, .35, head); M(new THREE.CircleGeometry(.07, 16), new THREE.MeshStandardMaterial({ color: 0xc8e0ff, transparent: true, opacity: .3 }), .13, .06, .352, head); M(new THREE.CylinderGeometry(.004, .004, .3, 4), std(0xe8b830, { metalness: .9 }), .2, -.1, .32, head).rotation.z = .4; break; }
    case 'a-eyepatch': { M(new THREE.CircleGeometry(.08, 16), toon(0x111111), -.13, .06, .36, head); M(new THREE.TorusGeometry(.33, .01, 4, 30), toon(0x111111), 0, .1, 0, head).rotation.set(Math.PI / 2 - .3, 0, 0); break; }
    case 'a-backpack': { const b = toon(0x3a6a3a); M(new THREE.BoxGeometry(.45, .5, .22), b, 0, .6, -.42, body); M(new THREE.BoxGeometry(.3, .2, .08), toon(0x2a4a2a), 0, .5, -.55, body); break; }
    case 'a-chain': { const gm = std(0xe8b830, { metalness: .9, roughness: .2 }); M(new THREE.TorusGeometry(.26, .02, 6, 30), gm, 0, .86, .06, body).rotation.x = Math.PI / 2 - .5; M(new THREE.CylinderGeometry(.07, .07, .02, 16), gm, 0, .66, .4, body).rotation.x = Math.PI / 2; break; }
    case 'a-tail': { const r = toon(0xc81a1a); const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .35, -.4), new THREE.Vector3(0, .2, -.7), new THREE.Vector3(0, .45, -.9)]); M(new THREE.TubeGeometry(curve, 14, .03, 6), r, 0, 0, 0, body); const tip = M(new THREE.ConeGeometry(.08, .16, 4), r, 0, .5, -.92, body); tip.rotation.x = -.6; break; }
    case 'a-balloon': { const g = new THREE.Group(); g.position.set(.45, 1.9, -.2); root.add(g); M(new THREE.SphereGeometry(.22, 16, 12), std(0xe02a3a, { roughness: .25 }), 0, 0, 0, g).scale.set(1, 1.15, 1); M(new THREE.CylinderGeometry(.004, .004, 1.1, 4), toon(0xffffff), -.1, -.75, .05, g).rotation.z = .2; out.balloon = g; break; }
    case 'a-sword': { const steel = std(0xc8ccd8, { metalness: .9, roughness: .2 }); const s = new THREE.Group(); s.position.set(0, .7, -.42); s.rotation.z = .6; body.add(s); M(new THREE.BoxGeometry(.07, .8, .02), steel, 0, .25, 0, s); M(new THREE.BoxGeometry(.24, .04, .05), std(0xe8b830, { metalness: .8 }), 0, -.16, 0, s); M(new THREE.CylinderGeometry(.025, .025, .18, 8), toon(0x4a2a1a), 0, -.27, 0, s); break; }
    case 'a-cape': { const c = new THREE.Mesh(new THREE.PlaneGeometry(.75, .95, 4, 4), new THREE.MeshToonMaterial({ color: 0x8a1020, side: THREE.DoubleSide })); c.position.set(0, .5, -.42); c.rotation.x = .12; c.castShadow = true; body.add(c); out.cape = c; break; }
    case 'a-batwings': case 'a-angelwings': {
      const bat = id === 'a-batwings', mat = bat ? new THREE.MeshToonMaterial({ color: 0x2a1a2e, side: THREE.DoubleSide }) : new THREE.MeshToonMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      out.wings = [-1, 1].map(s => { const pv = new THREE.Group(); pv.position.set(s * .15, .85, -.38); body.add(pv); const shape = new THREE.Shape(); if (bat) { shape.moveTo(0, 0); shape.lineTo(.7, .35); shape.lineTo(.6, .05); shape.lineTo(.48, .12); shape.lineTo(.36, -.05); shape.lineTo(.22, .05); shape.lineTo(0, -.15); } else { shape.moveTo(0, 0); shape.quadraticCurveTo(.4, .5, .75, .3); shape.quadraticCurveTo(.55, .05, .6, -.15); shape.quadraticCurveTo(.3, -.2, 0, -.15); } const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat); w.scale.x = s; w.rotation.y = s * -.4; pv.add(w); return pv; });
      break;
    }
    case 'a-petghost': { const g = new THREE.Group(); root.add(g); const m = new THREE.MeshToonMaterial({ color: 0xf4f4ff, transparent: true, opacity: .85 }); M(new THREE.SphereGeometry(.14, 12, 10), m, 0, 0, 0, g); const tail = M(new THREE.ConeGeometry(.13, .22, 10), m, 0, -.15, 0, g); tail.rotation.x = Math.PI; [-1, 1].forEach(s => M(new THREE.SphereGeometry(.025, 6, 5), glowM(0x111111), s * .05, .02, .12, g)); out.pet = g; break; }
  }
  return out;
}

// The avatar. Returns handles the game animates every frame through tick(t).
export function makeAvatar(cos = {}, baseColor = '#ff6b6b') {
  const g = new THREE.Group(); const item = ITEM[cos.color];
  const modelKey = (cos.model && ITEM[cos.model] && cos.model.slice(2)) || 'blob';
  const defaultTint = { ghost: 0xf4f4ff, bear: 0x8a5a3a, frog: 0x5ab04a, alien: 0x8ad06a, robot: 0xa0a8b8 }[modelKey];
  const c = item ? item.hex : defaultTint !== undefined ? defaultTint : new THREE.Color(baseColor).getHex();
  const m = item && item.metal ? std(c, { metalness: .9, roughness: .25 }) : item && item.glow ? new THREE.MeshToonMaterial({ color: c, emissive: c, emissiveIntensity: .6 }) : new THREE.MeshToonMaterial({ color: c });
  const body = new THREE.Group(); g.add(body);
  const head = new THREE.Group(); head.position.y = 1.2; g.add(head);
  const info = MODELS[modelKey](body, head, m) || { top: .26 };
  const hat = cos.hat && ITEM[cos.hat] ? buildHat(cos.hat, head, info.top) : null;
  const acc = cos.acc && ITEM[cos.acc] ? buildAcc(cos.acc, body, head, g) : {};
  const torch = M(new THREE.CylinderGeometry(.05, .06, .26, 8), toon(0x3a3346), .38, -.45, .25, head); torch.rotation.x = Math.PI / 2;
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 20, 1, true), new THREE.MeshBasicMaterial({ color: lightColor(cos), transparent: true, opacity: .06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(.38, -.45, 3.25); head.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .04, 6, 28), new THREE.MeshBasicMaterial({ color: 0x7dffc4, transparent: true, opacity: 0 })); ring.rotation.x = Math.PI / 2; ring.position.y = 1.95; g.add(ring);
  const tick = (t, moving) => {
    if (info.float) body.position.y = .08 + Math.sin(t * 2.2) * .05;
    if (item && item.rainbow) m.color.setHSL((t * .15) % 1, .8, .55);
    if (hat && hat.userData.spin) hat.userData.spin.rotation.y = t * (moving ? 18 : 6);
    if (hat && hat.userData.bob) hat.position.y = info.top + Math.sin(t * 2) * .03;
    if (acc.cape) acc.cape.rotation.x = .12 + (moving ? .35 : 0) + Math.sin(t * 5) * .04;
    if (acc.wings) acc.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (.15 + Math.sin(t * (moving ? 9 : 3)) * .25); });
    if (acc.balloon) { acc.balloon.position.y = 1.9 + Math.sin(t * 1.4) * .08; acc.balloon.rotation.z = Math.sin(t * .9) * .15; }
    if (acc.pet) acc.pet.position.set(Math.cos(t * 1.1) * .8, 1.5 + Math.sin(t * 2.3) * .12, Math.sin(t * 1.1) * .8);
  };
  return { g, head, beam, ring, body, cape: acc.cape, tick, rx: 0, rz: 0, ry: 0, init: false };
}
