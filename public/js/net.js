// WebSocket client with server-clock sync.
export class Net {
  constructor() { this.h = {}; this.offset = 0; this.bestRtt = 1e9; this.ws = null; this.open = false; }
  on(t, fn) { this.h[t] = fn; }
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
      this.ws = ws;
      ws.onopen = () => { this.open = true; this.ping(); this.pinger = setInterval(() => this.ping(), 2000); resolve(); };
      ws.onerror = () => { if (!this.open) reject(new Error('Could not reach the game server.')); };
      ws.onclose = () => { const was = this.open; this.open = false; clearInterval(this.pinger); if (was && this.h.close) this.h.close(); };
      ws.onmessage = ev => {
        let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.t === 'pong') { const now = Date.now(), rtt = now - m.c; if (rtt < this.bestRtt * 1.5 || rtt < 60) { const off = m.s - (m.c + rtt / 2); this.offset = this.bestRtt === 1e9 ? off : this.offset * .7 + off * .3; this.bestRtt = Math.min(this.bestRtt, rtt); } this.rtt = rtt; return; }
        if (m.t === 'welcome') { this.offset = m.now - Date.now(); }
        const f = this.h[m.t]; if (f) f(m);
      };
    });
  }
  ping() { this.send({ t: 'ping', c: Date.now() }); }
  send(o) { if (this.open && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  now() { return Date.now() + this.offset; }
  close() { try { this.ws && this.ws.close(); } catch (e) { } this.open = false; clearInterval(this.pinger); }
}
