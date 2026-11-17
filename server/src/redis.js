import Redis from 'ioredis';
import { config } from './config.js';

const opts = {
  retryStrategy: (times) => Math.min(times * 200, 2000),
  maxRetriesPerRequest: 5,
};

export const redis = new Redis(config.redisUrl, opts); // commands
export const sub = new Redis(config.redisUrl, opts); //   dedicated Pub/Sub connection

redis.on('error', (e) => console.error('[redis]', e.message));
sub.on('error', (e) => console.error('[redis-sub]', e.message));

// ---- Lua scripts: atomic operations so many servers can safely share state ----

// Room "owner" lock: whoever holds it runs that room's timers. Renewed every tick,
// so if the owner dies, another server takes over within ~3 s.
redis.defineCommand('ownLock', {
  numberOfKeys: 1,
  lua: `
    local v = redis.call('GET', KEYS[1])
    if v == ARGV[1] then redis.call('PEXPIRE', KEYS[1], ARGV[2]) return 1 end
    if not v then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end
    return 0`,
});

// Compare-and-set the game phase (prevents double "start" / double "end turn").
redis.defineCommand('casPhase', {
  numberOfKeys: 1,
  lua: `
    if redis.call('HGET', KEYS[1], 'phase') == ARGV[1] then
      redis.call('HSET', KEYS[1], 'phase', ARGV[2])
      return 1
    end
    return 0`,
});

// Record a correct guess exactly once and award points to guesser + drawer.
redis.defineCommand('recordGuess', {
  numberOfKeys: 2, // guessed set, scores zset
  lua: `
    if redis.call('SADD', KEYS[1], ARGV[1]) == 1 then
      redis.call('ZINCRBY', KEYS[2], ARGV[2], ARGV[1])
      redis.call('ZINCRBY', KEYS[2], ARGV[4], ARGV[3])
      return 1
    end
    return 0`,
});
