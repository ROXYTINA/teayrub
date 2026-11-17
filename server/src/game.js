// Game logic. ALL state lives in Redis, so any server can handle any player and
// a server crash never kills a match.
//
//   LOBBY -> PREP -> DRAWING -> ROUND_END -> (DRAWING ... ) -> MATCH_END -> LOBBY
//
// Timers: one server "owns" each room at a time (Redis lock). Only the owner advances
// phases, based on the absolute timestamp `phaseEndsAt` stored in Redis.
import crypto from 'node:crypto';
import { redis } from './redis.js';
import { config } from './config.js';
import { pickWord } from './words.js';
import { publish, channel, encode } from './bus.js';
import * as store from './store.js';

const G = config.game;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const PRESENCE_MS = 15000; // a player counts as connected if a server saw their socket in the last 15 s

// Braces = Redis hash tag: all keys of a room share one slot (Redis Cluster ready).
export const K = {
  room: (c) => `room:{${c}}`,
  players: (c) => `room:{${c}}:players`,
  seen: (c) => `room:{${c}}:seen`,
  scores: (c) => `room:{${c}}:scores`,
  strokes: (c) => `room:{${c}}:strokes`,
  guessed: (c) => `room:{${c}}:guessed`,
  used: (c) => `room:{${c}}:used`,
  lock: (c) => `room:{${c}}:lock`,
};

export class GameError extends Error {
  constructor(message) { super(message); this.userMessage = message; }
}

const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const hideable = (ch) => /[\p{L}\p{N}]/u.test(ch);
const maskWord = (word, revealed) => [...word].map((ch, i) => (hideable(ch) && !revealed.includes(i) ? '_' : ch)).join('');
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------------------------------------------------------- rooms & players

export async function createRoom() {
  for (let i = 0; i < 10; i++) {
    const code = Array.from({ length: 5 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
    // HSETNX = atomic "claim this code"; two servers can never hand out the same one.
    if (await redis.hsetnx(K.room(code), 'phase', 'LOBBY')) {
      await redis.hset(K.room(code), { turn: 0, rounds: G.rounds, createdAt: Date.now() });
      await touch(code);
      return code;
    }
  }
  throw new GameError('Could not allocate a room code, try again');
}

export async function roomInfo(code) {
  const phase = await redis.hget(K.room(code), 'phase');
  if (!phase) return null;
  return { phase, players: await redis.hlen(K.players(code)) };
}

async function touch(code) {
  const p = redis.pipeline();
  for (const k of ['room', 'players', 'seen', 'scores', 'strokes', 'guessed', 'used']) p.expire(K[k](code), config.roomTtlSec);
  await p.exec();
}

export async function getPlayers(code) {
  const [p, seen] = await Promise.all([redis.hgetall(K.players(code)), redis.hgetall(K.seen(code))]);
  const now = Date.now();
  const out = {};
  for (const [id, json] of Object.entries(p)) {
    out[id] = { name: JSON.parse(json).name, connected: now - (Number(seen[id]) || 0) < PRESENCE_MS };
  }
  return out;
}

async function playerList(code) {
  const [players, raw, guessed] = await Promise.all([
    getPlayers(code),
    redis.zrange(K.scores(code), 0, -1, 'WITHSCORES'),
    redis.smembers(K.guessed(code)),
  ]);
  const scores = {};
  for (let i = 0; i < raw.length; i += 2) scores[raw[i]] = Number(raw[i + 1]);
  const g = new Set(guessed);
  return Object.entries(players).map(([id, p]) => ({
    id, name: p.name, connected: p.connected, score: scores[id] || 0, guessed: g.has(id),
  }));
}

export async function broadcastPlayers(code) {
  await publish(code, { t: 'players', players: await playerList(code) });
}

export async function joinPlayer(code, playerId, name) {
  if (!(await redis.exists(K.room(code)))) throw new GameError('Room not found. Check the code and try again.');
  const known = await redis.hexists(K.players(code), playerId);
  if (!known && (await redis.hlen(K.players(code))) >= G.maxPlayers) throw new GameError('This room is full.');
  await redis.pipeline()
    .hset(K.players(code), playerId, JSON.stringify({ name }))
    .hset(K.seen(code), playerId, Date.now())
    .zadd(K.scores(code), 'NX', 0, playerId)
    .exec();
  await touch(code);
}

export const heartbeat = async (entries) => {
  if (!entries.length) return;
  const now = Date.now();
  const p = redis.pipeline();
  for (const [code, id] of entries) p.hset(K.seen(code), id, now);
  await p.exec();
};

// Back-date presence so the player shows as offline after ~5 s unless they reconnect.
export const markLeft = (code, id) => redis.hset(K.seen(code), id, Date.now() - (PRESENCE_MS - 5000));

// ---------------------------------------------------------------- snapshots

const totalTurns = (room) => (room.order ? JSON.parse(room.order).length * Number(room.rounds || G.rounds) : 0);
const roundOf = (room) => {
  const n = room.order ? JSON.parse(room.order).length : 0;
  return n ? Math.floor(Number(room.turn || 0) / n) + 1 : 1;
};
const turnInfo = (room) => ({
  serverTime: Date.now(),
  turn: Number(room.turn || 0),
  totalTurns: totalTurns(room),
  round: roundOf(room),
  rounds: Number(room.rounds || G.rounds),
  drawerId: room.drawerId || null,
  hint: room.hint || '',
  phaseEndsAt: Number(room.phaseEndsAt || 0),
  drawMs: Number(room.drawMs || G.drawMs),
});

// Full state for a joining / reconnecting client (canvas replay included).
export async function snapshot(code, playerId) {
  const [room, strokes, players] = await Promise.all([
    redis.hgetall(K.room(code)),
    redis.lrange(K.strokes(code), 0, -1),
    playerList(code),
  ]);
  if (!room.phase) throw new GameError('Room not found');
  const me = players.find((p) => p.id === playerId);
  const reveal = room.phase === 'ROUND_END' || (room.phase === 'DRAWING' && (playerId === room.drawerId || me?.guessed));
  return {
    t: 'state', code, phase: room.phase, task: config.taskId, az: config.az,
    ...turnInfo(room),
    word: reveal ? room.word : undefined,
    players,
    strokes: strokes.map((s) => JSON.parse(s)),
  };
}

// ---------------------------------------------------------------- game flow

export async function handleStart(code) {
  const players = await getPlayers(code);
  const ids = Object.keys(players).filter((id) => players[id].connected);
  if (ids.length < G.minPlayers) throw new GameError(`Need at least ${G.minPlayers} players to start.`);
  if (!(await redis.casPhase(K.room(code), 'LOBBY', 'PREP'))) return; // someone else already started
  const m = redis.multi().del(K.scores(code), K.used(code))
    .zadd(K.scores(code), ...ids.flatMap((id) => [0, id]))
    .hset(K.room(code), { order: JSON.stringify(shuffle(ids)), rounds: G.rounds });
  await m.exec();
  await beginTurn(code, 0);
}

async function beginTurn(code, turn) {
  const room = await redis.hgetall(K.room(code));
  const order = JSON.parse(room.order || '[]');
  const total = order.length * Number(room.rounds || G.rounds);
  const players = await getPlayers(code);
  while (turn < total && !players[order[turn % order.length]]?.connected) turn++; // skip absent drawers
  if (turn >= total) return endMatch(code);

  const drawerId = order[turn % order.length];
  const word = pickWord(await redis.smembers(K.used(code)));
  const now = Date.now();
  const fields = {
    phase: 'DRAWING', turn, drawerId, word, hint: maskWord(word, []), revealed: '',
    phaseStartedAt: now, phaseEndsAt: now + G.drawMs, drawMs: G.drawMs,
  };
  await redis.multi().del(K.strokes(code), K.guessed(code)).hset(K.room(code), fields).sadd(K.used(code), word).exec();
  await touch(code);
  const info = turnInfo({ ...room, ...fields });
  await publish(code, { t: 'turn', ...info });
  await publish(code, { t: 'word', word }, { to: drawerId }); // the secret goes ONLY to the drawer
  await broadcastPlayers(code);
}

async function endTurn(code) {
  if (!(await redis.casPhase(K.room(code), 'DRAWING', 'ROUND_END'))) return;
  const room = await redis.hgetall(K.room(code));
  const guessedCount = await redis.scard(K.guessed(code));
  const endsAt = Date.now() + G.roundEndMs;
  await redis.hset(K.room(code), { phaseEndsAt: endsAt, lastGuessed: guessedCount });
  await publish(code, { t: 'turn_end', word: room.word, drawerId: room.drawerId, guessedCount, phaseEndsAt: endsAt, serverTime: Date.now() });
  await broadcastPlayers(code);
}

async function endMatch(code) {
  const endsAt = Date.now() + G.matchEndMs;
  await redis.hset(K.room(code), { phase: 'MATCH_END', phaseEndsAt: endsAt });
  const players = (await playerList(code)).sort((a, b) => b.score - a.score);
  await publish(code, { t: 'match_end', players, phaseEndsAt: endsAt, serverTime: Date.now() });
  store.saveMatch({ code, players: players.map((p) => ({ name: p.name, score: p.score })) })
    .catch((e) => console.error('[store] saveMatch failed:', e.message));
}

async function resetToLobby(code) {
  const players = await getPlayers(code);
  const keep = Object.keys(players).filter((id) => players[id].connected);
  const drop = Object.keys(players).filter((id) => !players[id].connected);
  const m = redis.multi().del(K.strokes(code), K.guessed(code), K.used(code), K.scores(code));
  if (drop.length) m.hdel(K.players(code), ...drop).hdel(K.seen(code), ...drop);
  if (keep.length) m.zadd(K.scores(code), ...keep.flatMap((id) => [0, id]));
  m.hset(K.room(code), { phase: 'LOBBY', turn: 0 }).hdel(K.room(code), 'order', 'drawerId', 'word', 'hint');
  await m.exec();
  await publish(code, { t: 'lobby' });
  await broadcastPlayers(code);
}

// ---------------------------------------------------------------- ticking (room owner only)

const lastSig = new Map();
export const forget = (code) => lastSig.delete(code);

export async function tick(code) {
  if (!(await redis.ownLock(K.lock(code), config.taskId, 3000))) return; // someone else owns this room
  const room = await redis.hgetall(K.room(code));
  if (!room.phase) return;
  const now = Date.now();
  const players = await getPlayers(code);

  // Presence changes (someone dropped / came back) -> refresh everyone's player list.
  const sig = Object.entries(players).map(([id, p]) => id + (p.connected ? 1 : 0)).sort().join();
  if (lastSig.get(code) !== sig) { lastSig.set(code, sig); await broadcastPlayers(code); }

  switch (room.phase) {
    case 'DRAWING': {
      const drawerGone = room.drawerId && players[room.drawerId] && !players[room.drawerId].connected;
      if (now >= Number(room.phaseEndsAt) || drawerGone) return endTurn(code);
      return maybeReveal(code, room, now);
    }
    case 'ROUND_END':
      if (now >= Number(room.phaseEndsAt)) return beginTurn(code, Number(room.turn) + 1);
      return;
    case 'MATCH_END':
      if (now >= Number(room.phaseEndsAt)) return resetToLobby(code);
      return;
    default:
  }
}

// Reveal one letter at 50% and another at 75% of the time (only for words of 4+ letters).
async function maybeReveal(code, room, now) {
  const letters = [...room.word].map((c, i) => (hideable(c) ? i : -1)).filter((i) => i >= 0);
  const revealed = room.revealed ? room.revealed.split(',').map(Number) : [];
  const f = (now - Number(room.phaseStartedAt)) / Number(room.drawMs);
  const want = letters.length < 4 ? 0 : f >= 0.75 ? 2 : f >= 0.5 ? 1 : 0;
  if (revealed.length >= want) return;
  const pool = letters.filter((i) => !revealed.includes(i));
  revealed.push(pool[crypto.randomInt(pool.length)]);
  const hint = maskWord(room.word, revealed);
  await redis.hset(K.room(code), { revealed: revealed.join(','), hint });
  await publish(code, { t: 'hint', hint });
}

// ---------------------------------------------------------------- player actions

export function sanitizeStroke(m) {
  if (!m || typeof m.id !== 'string' || m.id.length > 24) return null;
  if (typeof m.c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(m.c)) return null;
  const w = Number(m.w);
  if (!(w >= 1 && w <= 60)) return null;
  if (!Array.isArray(m.p) || m.p.length < 1 || m.p.length > 100) return null;
  const p = [];
  for (const pt of m.p) {
    if (!Array.isArray(pt) || pt.length !== 2) return null;
    const [x, y] = pt;
    if (typeof x !== 'number' || typeof y !== 'number' || !(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;
    p.push([x, y]);
  }
  return { t: 'stroke', id: m.id, c: m.c, w, p, ts: Number(m.ts) || 0 };
}

// Store for replay + fan out through Redis in ONE round trip. No `await` before exec()
// so strokes from one socket are issued to Redis in order.
export async function handleStroke(code, playerId, seg) {
  const p = redis.pipeline();
  p.rpush(K.strokes(code), JSON.stringify(seg));
  p.ltrim(K.strokes(code), -5000, -1);
  p.publish(channel(code), encode(seg, { except: playerId })); // drawer already drew it locally
  await p.exec();
}

export async function handleClear(code) {
  await redis.del(K.strokes(code));
  await publish(code, { t: 'clear' });
}

export async function handleGuess(code, playerId, rawText) {
  const text = String(rawText || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 100);
  if (!text) return;
  const [room, players] = await Promise.all([redis.hgetall(K.room(code)), getPlayers(code)]);
  const me = players[playerId];
  if (!me) return;

  const drawing = room.phase === 'DRAWING';
  const isDrawer = playerId === room.drawerId;
  let alreadyGuessed = false;

  if (drawing && !isDrawer) {
    alreadyGuessed = (await redis.sismember(K.guessed(code), playerId)) === 1;
    if (!alreadyGuessed && norm(text) === norm(room.word)) {
      const remaining = Math.max(0, Number(room.phaseEndsAt) - Date.now());
      const points = 100 + Math.floor((300 * remaining) / Number(room.drawMs));
      // Lua script: record + score atomically, so simultaneous correct guesses can't double count.
      const ok = await redis.recordGuess(K.guessed(code), K.scores(code), playerId, points, room.drawerId, G.drawerPoints);
      if (ok) {
        await publish(code, { t: 'correct', playerId, name: me.name, points });
        await publish(code, { t: 'word', word: room.word }, { to: playerId });
        await broadcastPlayers(code);
        const guessers = Object.entries(players).filter(([id, p]) => p.connected && id !== room.drawerId).length;
        if ((await redis.scard(K.guessed(code))) >= guessers) {
          await redis.hset(K.room(code), 'phaseEndsAt', Date.now()); // everyone got it -> owner ends the turn within 1 s
        }
      }
      return;
    }
  }
  // Never let the drawer or people who already know the word leak it in chat.
  if (drawing && (isDrawer || alreadyGuessed) && norm(text).includes(norm(room.word))) return;
  await publish(code, { t: 'chat', playerId, name: me.name, text });
}
