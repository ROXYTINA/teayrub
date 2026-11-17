// End-to-end smoke test: 2 players on 2 DIFFERENT servers play one full match.
//   node smoke.js ws://localhost:3001 ws://localhost:3002
import crypto from 'node:crypto';
import WebSocket from 'ws';

const [a, b] = [process.argv[2] || 'ws://localhost:3001', process.argv[3] || 'ws://localhost:3002'];
const http = (u) => u.replace(/^ws/, 'http');
const log = (...x) => console.log(...x);
let failed = 0;
const check = (ok, msg) => { log(ok ? '  PASS' : '  FAIL', msg); if (!ok) failed++; };

const { code } = await (await fetch(`${http(a)}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
log('room', code);

function player(base, name) {
  const p = { id: crypto.randomUUID(), name, events: [], word: null, strokes: [] };
  p.ws = new WebSocket(`${base}/ws`);
  p.ready = new Promise((res) => p.ws.on('open', () => { p.ws.send(JSON.stringify({ t: 'join', code, playerId: p.id, name })); res(); }));
  p.ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    p.events.push(m);
    if (m.t === 'word') p.word = m.word;
    if (m.t === 'stroke') p.strokes.push(m);
    if (m.t === 'state' && m.word) p.word = m.word;
  });
  p.send = (o) => p.ws.send(JSON.stringify(o));
  p.has = (t) => p.events.some((e) => e.t === t);
  p.last = (t) => [...p.events].reverse().find((e) => e.t === t);
  return p;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await wait(50); } return false; };

const p1 = player(a, 'Ann'), p2 = player(b, 'Ben');
await Promise.all([p1.ready, p2.ready]);
check(await until(() => p1.has('state') && p2.has('state')), 'both players joined (different servers)');
check(await until(() => p1.last('players')?.players.length === 2), 'player list shows 2 players');
check(p1.last('state').task !== p2.last('state').task, `players are on different tasks (${p1.last('state').task} / ${p2.last('state').task})`);

p1.send({ t: 'start' });
check(await until(() => p1.has('turn') && p2.has('turn')), 'turn started on both servers');
await until(() => p1.word || p2.word);
const drawer = p1.word ? p1 : p2, guesser = drawer === p1 ? p2 : p1;
check(!!drawer.word && !guesser.word, 'secret word sent ONLY to the drawer');
check(!JSON.stringify(guesser.events).includes(drawer.word), 'word never appears in guesser traffic');

drawer.send({ t: 'stroke', id: 's1', c: '#23224d', w: 6, p: [[0.1, 0.1], [0.2, 0.2]], ts: Date.now() });
check(await until(() => guesser.strokes.length === 1), 'stroke from drawer reached guesser across servers');
check(drawer.strokes.length === 0, 'drawer does not get their own stroke echoed');
guesser.send({ t: 'stroke', id: 'cheat', c: '#23224d', w: 6, p: [[0.5, 0.5]], ts: Date.now() });
await wait(300);
check(drawer.strokes.length === 0, 'non-drawer strokes are rejected');

guesser.send({ t: 'chat', text: 'definitely wrong' });
check(await until(() => drawer.events.some((e) => e.t === 'chat' && e.text === 'definitely wrong')), 'chat delivered across servers');
await wait(500);
guesser.send({ t: 'chat', text: drawer.word.toUpperCase() });
check(await until(() => drawer.has('correct') && guesser.has('correct')), 'correct guess detected (case-insensitive)');
await wait(400);
const score = guesser.last('players').players.find((x) => x.id === guesser.id).score;
check(score >= 100, `guesser scored ${score}`);
check(await until(() => guesser.has('turn_end')), 'turn ended early because everyone guessed');

// late joiner / reconnect gets canvas replay
const p3 = player(b, 'Cy');
await p3.ready;
await until(() => p3.has('state'));
check(p3.last('state').players.length === 3, 'third player joined mid-game');

check(await until(() => drawer.has('turn') && drawer.events.filter((e) => e.t === 'turn').length >= 2, 12000), 'second turn started (roles swap)');
check(await until(() => p1.has('match_end') && p2.has('match_end'), 25000), 'match ended after all turns');
check(await until(() => p1.has('lobby'), 10000), 'room returned to lobby');

const lb = await (await fetch(`${http(a)}/api/leaderboard`)).json();
check(lb.length > 0, `leaderboard saved match: ${JSON.stringify(lb)}`);
log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
[p1, p2, p3].forEach((p) => p.ws.close());
process.exit(failed ? 1 : 0);
