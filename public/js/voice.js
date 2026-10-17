// Proximity voice chat: one WebRTC audio link per pair of players, each played through a 3D panner
// placed at that player's head. Voices fade with distance and sound muffled through walls.
export class Voice {
  constructor(net) {
    this.net = net; this.peers = new Map(); this.ice = [{ urls: 'stun:stun.l.google.com:19302' }];
    this.ctx = null; this.out = null; this.track = null; this.stream = null; this.muted = false; this.myId = null; this.level = 0;
    this.volume = 1; this.maxDist = 22;
  }
  attach(ctx) {
    this.ctx = ctx; this.out = ctx.createGain(); this.out.gain.value = this.volume; this.out.connect(ctx.destination);
  }
  setVolume(v) { this.volume = v; if (this.out) this.out.gain.value = v; }
  get micOn() { return !!this.track; }
  async enableMic() {
    if (this.track) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error(location.protocol === 'https:' || location.hostname === 'localhost' ? 'This browser does not support microphone access.' : 'Voice chat needs a secure link. Open the game through an https:// address (see README).');
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    this.stream = s; this.track = s.getAudioTracks()[0]; this.track.enabled = !this.muted;
    if (this.ctx) { const src = this.ctx.createMediaStreamSource(s); this.micAn = this.ctx.createAnalyser(); this.micAn.fftSize = 512; src.connect(this.micAn); }
    for (const p of this.peers.values()) this.attachTrack(p);
    return true;
  }
  setMuted(m) { this.muted = m; if (this.track) this.track.enabled = !m; }
  micLevel() { if (!this.micAn || this.muted) return 0; return rms(this.micAn); }

  attachTrack(p) { const tr = p.pc.getTransceivers()[0]; if (tr && this.track) { try { tr.direction = 'sendrecv'; } catch (e) { } tr.sender.replaceTrack(this.track).catch(() => { }); } }
  addPeer(id) {
    if (this.peers.has(id) || id === this.myId) return;
    const initiator = this.myId < id;
    const p = this.makePeer(id);
    if (initiator) {
      p.pc.addTransceiver('audio', { direction: 'sendrecv' });
      this.attachTrack(p);
      p.pc.createOffer().then(o => p.pc.setLocalDescription(o)).then(() => this.net.send({ t: 'rtc', to: id, data: { sdp: p.pc.localDescription } })).catch(e => console.warn('offer failed', e));
    }
  }
  makePeer(id) {
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    const p = { id, pc, queue: [], node: null, an: null, talking: false, el: null };
    pc.onicecandidate = e => { if (e.candidate) this.net.send({ t: 'rtc', to: id, data: { ice: e.candidate } }); };
    pc.ontrack = e => this.hookAudio(p, e.streams[0] || new MediaStream([e.track]));
    pc.onconnectionstatechange = () => { p.state = pc.connectionState; };
    this.peers.set(id, p); return p;
  }
  hookAudio(p, stream) {
    if (!this.ctx || p.node) return;
    // Chrome only feeds remote WebRTC audio into Web Audio if an element is also playing it.
    const el = new Audio(); el.muted = true; el.srcObject = stream; el.play().catch(() => { }); p.el = el;
    const src = this.ctx.createMediaStreamSource(stream);
    const an = this.ctx.createAnalyser(); an.fftSize = 512;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000;
    const pan = this.ctx.createPanner(); Object.assign(pan, { panningModel: 'HRTF', distanceModel: 'linear', refDistance: 1.5, maxDistance: this.maxDist, rolloffFactor: 1 });
    const g = this.ctx.createGain(); g.gain.value = 1;
    src.connect(an); an.connect(lp); lp.connect(pan); pan.connect(g); g.connect(this.out);
    p.node = { src, lp, pan, g }; p.an = an;
  }
  async signal(from, data) {
    let p = this.peers.get(from);
    if (!p) p = this.makePeer(from);
    const pc = p.pc;
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          this.attachTrack(p);
          const tr = pc.getTransceivers()[0]; if (tr) try { tr.direction = 'sendrecv'; } catch (e) { }
          const a = await pc.createAnswer(); await pc.setLocalDescription(a);
          this.net.send({ t: 'rtc', to: from, data: { sdp: pc.localDescription } });
        }
        for (const c of p.queue) await pc.addIceCandidate(c).catch(() => { }); p.queue = [];
      } else if (data.ice) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.ice).catch(() => { }); else p.queue.push(data.ice);
      }
    } catch (e) { console.warn('voice signal error', e); }
  }
  removePeer(id) { const p = this.peers.get(id); if (!p) return; try { p.pc.close(); } catch (e) { } if (p.node) { try { p.node.g.disconnect(); } catch (e) { } } if (p.el) p.el.srcObject = null; this.peers.delete(id); }
  closeAll() { [...this.peers.keys()].forEach(id => this.removePeer(id)); }

  // listener = { x, y, z, fx, fy, fz } (camera position and forward); peerPose(id) → { x, y, z, eaten, blocked } or null
  update(listener, myEaten, peerPose, lobby) {
    if (!this.ctx) return;
    const L = this.ctx.listener, t = this.ctx.currentTime;
    setP(L, 'positionX', listener.x, t); setP(L, 'positionY', listener.y, t); setP(L, 'positionZ', listener.z, t);
    if (L.forwardX) { L.forwardX.setTargetAtTime(listener.fx, t, .03); L.forwardY.setTargetAtTime(listener.fy, t, .03); L.forwardZ.setTargetAtTime(listener.fz, t, .03); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else if (L.setOrientation) L.setOrientation(listener.fx, listener.fy, listener.fz, 0, 1, 0);
    for (const p of this.peers.values()) {
      if (!p.node) continue;
      p.talking = rms(p.an) > .02;
      const pose = peerPose(p.id);
      let gain = 1, cut = 20000, pos = listener;
      if (lobby || !pose) { pos = listener; }
      else if (pose.eaten && myEaten) { pos = listener; gain = .9; }            // ghosts hear each other anywhere
      else if (pose.eaten && !myEaten) { gain = 0; }                         // the living can't hear ghosts
      else { pos = pose; if (pose.blocked) { cut = 900; gain = .6; } }
      const n = p.node;
      setP(n.pan, 'positionX', pos.x, t); setP(n.pan, 'positionY', pos.y, t); setP(n.pan, 'positionZ', pos.z, t);
      n.g.gain.setTargetAtTime(gain, t, .08); n.lp.frequency.setTargetAtTime(cut, t, .1);
    }
  }
  talking(id) { const p = this.peers.get(id); return !!(p && p.talking); }
  linkState(id) { const p = this.peers.get(id); return p ? (p.state || 'new') : 'none'; }
}
const buf = new Uint8Array(512);
function rms(an) { an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < an.fftSize; i++) { const v = (buf[i] - 128) / 128; s += v * v; } return Math.sqrt(s / an.fftSize); }
function setP(node, k, v, t) { if (node[k]) node[k].setTargetAtTime(v, t, .03); else if (k === 'positionX' && node.setPosition) node.setPosition(v, 0, 0); }
