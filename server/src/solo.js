// Solo matchmaking: a player who wants no room waits in a queue. Once enough solo
// players are waiting (config.game.minPlayers), they are placed together in a new room.
//
// Waiting players poll every couple of seconds. A player who stops polling for
// ALIVE_MS is treated as gone and dropped from the queue.
import { redis } from './redis.js';
import { config } from './config.js';
import { createRoom } from './game.js';

const QUEUE = 'solo:queue';
const ALIVE_MS = 8000;
const ASSIGN_TTL_SEC = 60;

const aliveKey = (id) => `solo:alive:${id}`;
const assignKey = (id) => `solo:assign:${id}`;

// Called on every poll. Returns the room code once the player has been placed, otherwise null.
export async function soloPoll(playerId) {
  await redis.set(aliveKey(playerId), 1, 'PX', ALIVE_MS);
  await redis.zadd(QUEUE, 'NX', Date.now(), playerId);
  await tryMatch();
  const code = await redis.get(assignKey(playerId));
  if (code) await redis.del(assignKey(playerId));
  return code;
}

async function tryMatch() {
  const need = config.game.minPlayers;
  const queued = await redis.zrange(QUEUE, 0, -1);
  if (!queued.length) return;

  const alive = await Promise.all(queued.map((id) => redis.exists(aliveKey(id))));
  const gone = queued.filter((_, i) => !alive[i]);
  if (gone.length) await redis.zrem(QUEUE, ...gone);

  const waiting = queued.filter((_, i) => alive[i]);
  if (waiting.length < need) return;

  const group = waiting.slice(0, need);
  // Removing the group is the claim: if another server already took some of them, skip this round.
  if ((await redis.zrem(QUEUE, ...group)) !== group.length) return;

  const code = await createRoom();
  await Promise.all(group.map((id) => redis.set(assignKey(id), code, 'EX', ASSIGN_TTL_SEC)));
}

// Removes a player from the queue (for example when they cancel).
export async function soloCancel(playerId) {
  await redis.zrem(QUEUE, playerId);
  await redis.del(aliveKey(playerId));
}
