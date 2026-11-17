// Load test: N rooms x M bots. Drawers send strokes, others chat wrong guesses.
// Measures stroke delivery latency (sender timestamp -> receiver) on this machine's clock.
//
//   cd loadtest && npm install
//   node bots.js --url ws://localhost:8080 --rooms 40 --per-room 8 --duration 120
//   node bots.js --url ws://localhost:3001,ws://localhost:3002 ...   (several servers, round-robin)
//
// Tip: start the servers with DRAW_MS=20000 so turns rotate quickly during the test.
import crypto from 'node:crypto';
import WebSocket from 'ws';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };
const bases = arg('url', 'ws://localhost:8080').split(',');
const ROOMS = Number(arg('rooms', 10));
const PER_ROOM = Number(arg('per-room', 6));
const DURATION = Number(arg('duration', 60));
const RAMP_MS = Number(arg('ramp-ms', 100)); // delay between rooms

let latencies = [], received = 0, sent = 0, connected = 0, errors = 0;
const bots = [];

class Bot {
  constructor(code, idx, base) {
    this.code = code; this.idx = idx; this.base = base;
    this.id = crypto.randomUUID();
    this.name = `bot${idx}`;
    this.timer = null; this.x = Math.random(); this.y = Math.random(); this.n = 0;
  }
  connect() {
    return new Promise((resolve) => {
      const ws = (this.ws = new WebSocket(`${this.base}/ws`));
      ws.on('open', () => ws.send(JSON.stringify({ t: 'join', code: this.code, playerId: this.id, name: this.name })));
      ws.on('message', (raw) => {
        const m = JSON.parse(raw);
        received++;
        if (m.t === 'state') { connected++; resolve(); }
        else if (m.t === 'turn') this.onTurn(m);
        else if (m.t === 'turn_end') this.stopDrawing();
        else if (m.t === 'stroke' && m.ts) latencies.push(Date.now() - m.ts);
        else if (m.t === 'lobby' && this.host) setTimeout(() => this.send({ t: 'start' }), 1000);
        else if (m.t === 'error') errors++;
      });
      ws.on('close', () => { connected--; this.stopDrawing(); });
      ws.on('error', () => { errors++; resolve(); });
    });
  }
  send(o) { if (this.ws.readyState === 1) { this.ws.send(JSON.stringify(o)); sent++; } }
  onTurn(m) {
    this.stopDrawing();
    if (m.drawerId === this.id) {
      this.timer = setInterval(() => {
        const p = [];
        for (let i = 0; i < 2; i++) { // ~50 points/s
          this.x = Math.min(1, Math.max(0, this.x + (Math.random() - 0.5) * 0.06));
          this.y = Math.min(1, Math.max(0, this.y + (Math.random() - 0.5) * 0.06));
          p.push([+this.x.toFixed(4), +this.y.toFixed(4)]);
        }
        this.send({ t: 'stroke', id: `b${this.idx}-${this.n}`, c: '#23224d', w: 6, p, ts: Date.now() });
        if (Math.random() < 0.02) this.n++;
      }, 40);
    } else {
      this.timer = setInterval(() => this.send({ t: 'chat', text: `guess ${Math.floor(Math.random() * 99)}` }), 4000 + Math.random() * 6000);
    }
  }
  stopDrawing() { clearInterval(this.timer); this.timer = null; }
}

const http = (base) => base.replace(/^ws/, 'http');
const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;

async function room(i) {
  const base = bases[i % bases.length];
  const { code } = await (await fetch(`${http(base)}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
  const members = [];
  for (let b = 0; b < PER_ROOM; b++) {
    // spread a room's players across servers so cross-server Pub/Sub is exercised
    const bot = new Bot(code, i * PER_ROOM + b, bases[(i + b) % bases.length]);
    bot.host = b === 0;
    members.push(bot); bots.push(bot);
  }
  await Promise.all(members.map((b) => b.connect()));
  members[0].send({ t: 'start' });
}

console.log(`Starting ${ROOMS} rooms x ${PER_ROOM} bots = ${ROOMS * PER_ROOM} players on ${bases.join(', ')}`);
const t0 = Date.now();
const report = setInterval(() => {
  const s = latencies.sort((a, b) => a - b);
  console.log(`t=${Math.round((Date.now() - t0) / 1000)}s conns=${connected} recv=${received} sent=${sent} errors=${errors} ` +
    `stroke latency ms p50=${pct(s, 0.5)} p95=${pct(s, 0.95)} p99=${pct(s, 0.99)} (n=${s.length})`);
  latencies = []; received = 0; sent = 0;
}, 5000);

for (let i = 0; i < ROOMS; i++) { await room(i).catch((e) => { errors++; console.error('room failed', e.message); }); await new Promise((r) => setTimeout(r, RAMP_MS)); }
setTimeout(() => { clearInterval(report); bots.forEach((b) => b.ws.close()); console.log('done'); process.exit(0); }, DURATION * 1000);
