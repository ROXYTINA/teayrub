import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

export const config = {
  port: Number(env.PORT) || 3000,
  redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  taskId: env.TASK_ID || os.hostname(),
  az: env.AZ || 'local', // overwritten at startup from ECS metadata when running on Fargate
  region: env.AWS_REGION || 'ap-southeast-1',
  serviceName: env.SERVICE_NAME || 'clouddraw',
  useDynamo: env.USE_DYNAMO === 'true',
  tablePrefix: env.TABLE_PREFIX || 'clouddraw',
  s3Bucket: env.S3_BUCKET || '',
  cwMetrics: env.CW_METRICS === 'true',
  dataDir: env.DATA_DIR || path.join(os.tmpdir(), 'clouddraw'),
  webDir: env.WEB_DIR || path.resolve(here, '../../web'),
  roomTtlSec: 6 * 3600,
  game: {
    drawMs: Number(env.DRAW_MS) || 70000,
    roundEndMs: Number(env.ROUND_END_MS) || 7000,
    matchEndMs: Number(env.MATCH_END_MS) || 15000,
    rounds: Number(env.ROUNDS) || 2,
    minPlayers: 2,
    maxPlayers: 10,
    drawerPoints: 40,
  },
};
