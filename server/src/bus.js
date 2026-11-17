// Redis Pub/Sub bus. Every server subscribes to the channel of each room that has
// at least one local player. This is what lets players on different servers / AZs
// see each other's strokes and chat.
import { redis, sub } from './redis.js';

export const channel = (code) => `ch:{${code}}`;
export const encode = (msg, opts = {}) => JSON.stringify({ ...opts, msg });
export const publish = (code, msg, opts) => redis.publish(channel(code), encode(msg, opts));

const handlers = [];
const reconnectHandlers = [];
export const onMessage = (h) => handlers.push(h);
export const onReconnect = (h) => reconnectHandlers.push(h);

sub.on('message', (ch, raw) => {
  const code = ch.slice(4, -1); // "ch:{ABCDE}" -> "ABCDE"
  let env;
  try { env = JSON.parse(raw); } catch { return; }
  for (const h of handlers) h(code, env);
});

// After a Redis failover Pub/Sub may have dropped messages; tell the app to resync clients.
let first = true;
sub.on('ready', () => {
  if (first) { first = false; return; }
  console.warn('[bus] resubscribed after reconnect, resyncing clients');
  for (const h of reconnectHandlers) h();
});

export const watch = (code) => sub.subscribe(channel(code));
export const unwatch = (code) => sub.unsubscribe(channel(code));
