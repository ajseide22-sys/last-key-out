// A generative horror score, synthesized live: a low drone, slow dissonant chords, a detuned music box,
// and the occasional sting. setIntensity(0..1) layers in shrieking strings as monsters close in.
export class Music {
  constructor(ac, dest) {
    this.ac = ac; this.out = ac.createGain(); this.out.gain.value = 0; this.out.connect(dest);
    this.vol = 1; this.intensity = 0; this.running = false; this.timers = [];
    // reverb from a generated impulse: a big stone hall
    const len = ac.sampleRate * 4.5, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.verb = ac.createConvolver(); this.verb.buffer = ir; this.wet = ac.createGain(); this.wet.gain.value = .9; this.verb.connect(this.wet); this.wet.connect(this.out);
    this.dry = ac.createGain(); this.dry.gain.value = .5; this.dry.connect(this.out);
    this.buildDrone(); this.buildStrings();
  }
  buildDrone() {
    const ac = this.ac, lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = 4;
    const g = ac.createGain(); g.gain.value = .5; lp.connect(g); g.connect(this.dry); g.connect(this.verb);
    [[36.7, 'sawtooth'], [36.95, 'sawtooth'], [55.1, 'triangle'], [18.35, 'sine']].forEach(([f, type]) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; const og = ac.createGain(); og.gain.value = type === 'sine' ? .6 : .25; o.connect(og); og.connect(lp); o.start(); });
    const lfo = ac.createOscillator(); lfo.frequency.value = .05; const lg = ac.createGain(); lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    this.drone = g;
  }
  buildStrings() { // high cluster with nervous tremolo, silent until something is near
    const ac = this.ac, g = ac.createGain(); g.gain.value = 0; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = .8;
    const trem = ac.createGain(); trem.gain.value = .5; const lfo = ac.createOscillator(); lfo.frequency.value = 9; const lg = ac.createGain(); lg.gain.value = .5; lfo.connect(lg); lg.connect(trem.gain); lfo.start();
    [880, 932.3, 987.8, 1318.5].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const v = ac.createOscillator(); v.frequency.value = 5 + Math.random() * 2; const vg = ac.createGain(); vg.gain.value = 6; v.connect(vg); vg.connect(o.frequency); v.start(); o.connect(bp); o.start(); });
    bp.connect(trem); trem.connect(g); g.connect(this.verb); g.connect(this.dry); this.strings = g;
  }
  start() {
    if (this.running) return; this.running = true;
    this.out.gain.setTargetAtTime(.5 * this.vol, this.ac.currentTime, 2);
    const loop = (fn, min, max) => { const go = () => { if (!this.running) return; fn(); this.timers.push(setTimeout(go, (min + Math.random() * (max - min)) * 1000)); }; this.timers.push(setTimeout(go, (min * .3 + Math.random() * min) * 1000)); };
    loop(() => this.chord(), 8, 14); loop(() => this.musicBox(), 7, 15); loop(() => this.sting(), 22, 48);
  }
  stop() { this.running = false; this.timers.forEach(clearTimeout); this.timers = []; this.out.gain.setTargetAtTime(0, this.ac.currentTime, .8); }
  setVolume(v) { this.vol = v; if (this.running) this.out.gain.setTargetAtTime(.5 * v, this.ac.currentTime, .2); }
  setIntensity(k) { this.intensity = k; const t = this.ac.currentTime; this.strings.gain.setTargetAtTime(k * k * .05, t, .6); this.drone.gain.setTargetAtTime(.5 + k * .4, t, 1); }
  env(node, t, a, h, r, peak) { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.setValueAtTime(peak, t + a + h); node.gain.linearRampToValueAtTime(0, t + a + h + r); }
  chord() { // slow, dissonant clusters that swell and fade
    const ac = this.ac, t = ac.currentTime + .05, base = 110 * Math.pow(2, [-2, -1, 0, 1, 3][Math.floor(Math.random() * 5)] / 12);
    const shapes = [[0, 1, 6], [0, 3, 6, 11], [0, 1, 5, 8], [0, 6, 7], [0, 2, 3, 8]]; const sh = shapes[Math.floor(Math.random() * shapes.length)];
    const g = ac.createGain(); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; g.connect(lp); lp.connect(this.verb); lp.connect(this.dry);
    sh.forEach(st => [1, 1.004].forEach(d => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = base * Math.pow(2, st / 12) * d; const og = ac.createGain(); og.gain.value = .045; o.connect(og); og.connect(g); o.start(t); o.stop(t + 12); }));
    this.env(g, t, 4, 2, 5, .9);
  }
  musicBox() { // a broken lullaby: a few plinks from a minor scale, slightly out of tune
    const ac = this.ac, scale = [0, 2, 3, 5, 7, 8, 11, 12, 14, 15], root = 523.25 * (Math.random() < .5 ? 1 : .75);
    let t = ac.currentTime + .1; const n = 3 + Math.floor(Math.random() * 5); let idx = Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      idx = Math.max(0, Math.min(scale.length - 1, idx + Math.floor(Math.random() * 5) - 2));
      const f = root * Math.pow(2, scale[idx] / 12) * (1 + (Math.random() - .5) * .012);
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (1 - .006 * i), t + 1.4);
      const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.01;
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + 1.6);
      const g2 = ac.createGain(); g2.gain.value = .25; o2.connect(g2); g2.connect(g);
      o.connect(g); g.connect(this.verb); g.connect(this.dry); o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
      t += .35 + Math.random() * .5 + (i === n - 2 ? .6 : 0);
    }
  }
  sting() { // something happens somewhere in the house
    const ac = this.ac, t = ac.currentTime + .05, kind = Math.floor(Math.random() * 4);
    const noise = (d) => { const len = ac.sampleRate * d, b = ac.createBuffer(1, len, ac.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; return s; };
    if (kind === 0) { // reverse swell into a boom
      const s = noise(3), hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.setValueAtTime(200, t); hp.frequency.exponentialRampToValueAtTime(4000, t + 2.8); const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.25, t + 2.8); g.gain.linearRampToValueAtTime(0, t + 2.9);
      s.connect(hp); hp.connect(g); g.connect(this.verb); s.start(t);
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t + 2.85); o.frequency.exponentialRampToValueAtTime(30, t + 4.5); const og = ac.createGain(); og.gain.setValueAtTime(0, t + 2.85); og.gain.linearRampToValueAtTime(.7, t + 2.9); og.gain.exponentialRampToValueAtTime(.001, t + 4.8); o.connect(og); og.connect(this.dry); og.connect(this.verb); o.start(t + 2.8); o.stop(t + 5);
    } else if (kind === 1) { // metal scraping
      const s = noise(2.5), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 18; bp.frequency.setValueAtTime(900 + Math.random() * 600, t); bp.frequency.linearRampToValueAtTime(1800 + Math.random() * 900, t + 2.2); const g = ac.createGain(); this.env(g, t, .3, 1.5, .7, .5);
      s.connect(bp); bp.connect(g); g.connect(this.verb); s.start(t);
    } else if (kind === 2) { // distant knocks
      for (let i = 0; i < 3; i++) { const o = ac.createOscillator(); o.type = 'sine'; const tt = t + i * .55; o.frequency.setValueAtTime(120, tt); o.frequency.exponentialRampToValueAtTime(55, tt + .2); const g = ac.createGain(); g.gain.setValueAtTime(.5, tt); g.gain.exponentialRampToValueAtTime(.001, tt + .3); o.connect(g); g.connect(this.verb); o.start(tt); o.stop(tt + .35); }
    } else { // a whisper
      const s = noise(1.6), f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6; f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(1400, t + .5); f1.frequency.linearRampToValueAtTime(500, t + 1.3);
      const g = ac.createGain(); this.env(g, t, .2, .8, .5, .35); const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
      s.connect(f1); f1.connect(g); if (pan) { pan.pan.value = Math.random() < .5 ? -.9 : .9; g.connect(pan); pan.connect(this.verb); pan.connect(this.dry); } else g.connect(this.verb); s.start(t);
    }
  }
}
