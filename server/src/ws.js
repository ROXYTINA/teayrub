// WebSocket layer. Stateless: a socket only remembers {code, playerId}; everything
// else comes from Redis. Messages reach other servers through the Pub/Sub bus.
import { WebSocketServer } from 'ws';
import * as game from './game.js';
import * as bus from './bus.js';

// code -> { sockets:Set<ws>, phase, drawerId, ready:Promise }   (only rooms with players on THIS server)
const local = new Map();
let shuttingDown = false;
export const beginShutdown = () => { shuttingDown = true; };
export const stats = () => ({
  rooms: local.size,
  connections: [...local.values()].reduce((n, r) => n + r.sockets.size, 0),
});

const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Player';

// ---- deliver messages coming from Redis to local sockets
bus.onMessage((code, env) => {
  const r = local.get(code);
  if (!r) return;
  const m = env.msg;
  // Cache phase/drawer locally so stroke validation needs zero Redis reads.
  if (m.t === 'turn') { r.phase = 'DRAWING'; r.drawerId = m.drawerId; }
  else if (m.t === 'turn_end') r.phase = 'ROUND_END';
  else if (m.t === 'match_end') { r.phase = 'MATCH_END'; r.drawerId = null; }
  else if (m.t === 'lobby') { r.phase = 'LOBBY'; r.drawerId = null; }

  const data = JSON.stringify(m);
  for (const ws of r.sockets) {
    if (env.to && ws.playerId !== env.to) continue;
    if (env.except && ws.playerId === env.except) continue;
    if (ws.readyState !== 1) continue;
    if (ws.bufferedAmount > 1_000_000) { ws.terminate(); continue; } // slow client: drop it, it will resync on reconnect
    ws.send(data);
  }
});

// After a Redis reconnect, send every local client a fresh snapshot.
bus.onReconnect(async () => {
  for (const [code, r] of local) {
    for (const ws of r.sockets) {
      try {
        const snap = await game.snapshot(code, ws.playerId);
        r.phase = snap.phase; r.drawerId = snap.drawerId;
        send(ws, snap);
      } catch { /* room gone */ }
    }
  }
});

async function onJoin(ws, m) {
  if (ws.code) return;
  const code = String(m.code || '').toUpperCase().trim();
  if (!/^[A-Z2-9]{5}$/.test(code)) throw new game.GameError('Invalid room code.');
  const playerId = String(m.playerId || '');
  if (!/^[\w-]{8,64}$/.test(playerId)) throw new game.GameError('Invalid player id.');

  await game.joinPlayer(code, playerId, cleanName(m.name));
  if (ws.readyState !== 1) return;
  ws.code = code;
  ws.playerId = playerId;

  let r = local.get(code);
  if (!r) {
    r = { sockets: new Set(), phase: 'LOBBY', drawerId: null };
    r.ready = bus.watch(code); // subscribe to this room's channel
    local.set(code, r);
  }
  await r.ready;
  for (const old of r.sockets) if (old.playerId === playerId) old.close(4001, 'replaced');
  r.sockets.add(ws);

  const snap = await game.snapshot(code, playerId);
  r.phase = snap.phase; r.drawerId = snap.drawerId;
  send(ws, snap);
  await game.broadcastPlayers(code);
}

async function onMessage(ws, raw) {
  const now = Date.now();
  if (now - ws.win > 1000) { ws.win = now; ws.count = 0; }
  if (++ws.count > 100) return; // flood guard (~100 msgs/s per socket)

  let m;
  try { m = JSON.parse(raw); } catch { return; }
  if (m.t === 'join') return onJoin(ws, m);
  if (!ws.code) throw new game.GameError('Join a room first.');
  const r = local.get(ws.code);
  if (!r) return;
  const isDrawer = r.phase === 'DRAWING' && r.drawerId === ws.playerId;

  switch (m.t) {
    case 'stroke': {
      if (!isDrawer) return;
      const seg = game.sanitizeStroke(m);
      if (seg) await game.handleStroke(ws.code, ws.playerId, seg);
      return;
    }
    case 'clear':
      if (isDrawer) await game.handleClear(ws.code);
      return;
    case 'chat':
      if (now - ws.lastChat < 400) return; // 1 chat/guess per 400 ms
      ws.lastChat = now;
      return game.handleGuess(ws.code, ws.playerId, m.text);
    case 'start':
      return game.handleStart(ws.code);
    default:
  }
}

function onClose(ws) {
  const r = ws.code && local.get(ws.code);
  if (!r) return;
  r.sockets.delete(ws);
  const stillHere = [...r.sockets].some((s) => s.playerId === ws.playerId);
  if (!stillHere && !shuttingDown) game.markLeft(ws.code, ws.playerId).catch(() => {});
  if (r.sockets.size === 0) {
    local.delete(ws.code);
    game.forget(ws.code);
    bus.unwatch(ws.code).catch(() => {});
  }
}

export function attachWs(server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 32 * 1024 });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.win = 0; ws.count = 0; ws.lastChat = 0;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      onMessage(ws, raw).catch((e) => {
        if (e.userMessage) send(ws, { t: 'error', message: e.userMessage, fatal: !ws.code });
        else console.error('[ws]', e);
      });
    });
    ws.on('close', () => onClose(ws));
    ws.on('error', () => {});
  });

  // Keep-alive: ping every 25 s (the ALB/CloudFront idle timeout is longer) and drop dead sockets.
  setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 25_000);

  // Presence heartbeat: tell Redis which players have a live socket on this server.
  setInterval(() => {
    const entries = [];
    for (const [code, r] of local) for (const ws of r.sockets) entries.push([code, ws.playerId]);
    game.heartbeat(entries).catch(() => {});
  }, 5000);

  // Room ticker: every second, try to tick each local room (only the lock owner actually does work).
  let ticking = false;
  setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      const results = await Promise.allSettled([...local.keys()].map((c) => game.tick(c)));
      for (const r of results) if (r.status === 'rejected') console.error('[tick]', r.reason?.message);
    } finally { ticking = false; }
  }, 1000);

  return wss;
}

export function closeAll() {
  for (const r of local.values()) for (const ws of r.sockets) ws.close(1012, 'server restarting');
}
