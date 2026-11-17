import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { redis } from './redis.js';
import { initWords } from './words.js';
import { apiRouter } from './api.js';
import { attachWs, beginShutdown, closeAll } from './ws.js';
import { startMetrics } from './metrics.js';

// On Fargate, ask the task metadata endpoint which AZ we are in (shown in the UI footer for demos).
async function detectAz() {
  const uri = process.env.ECS_CONTAINER_METADATA_URI_V4;
  if (!uri || process.env.AZ) return;
  try { config.az = (await (await fetch(`${uri}/task`)).json()).AvailabilityZone || config.az; } catch { /* ignore */ }
}

await Promise.all([initWords(), detectAz()]);

const app = express();
app.disable('x-powered-by');

// Liveness: ALWAYS cheap and independent of Redis. If the ALB health check depended on Redis,
// a Redis failover would make the ALB kill every healthy task. Don't do that.
app.get('/healthz', (_req, res) => res.json({ ok: true, task: config.taskId, az: config.az }));
// Readiness / debugging: checks Redis.
app.get('/readyz', async (_req, res) => {
  try { await redis.ping(); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});

app.use('/api', express.json({ limit: '4kb' }), apiRouter());
app.use('/artwork', express.static(path.join(config.dataDir, 'artwork'))); // local dev only (S3/CloudFront in the cloud)
app.use(express.static(config.webDir)); // local dev / single-container mode (S3/CloudFront in the cloud)

const server = http.createServer(app);
attachWs(server);
startMetrics();

server.listen(config.port, () => {
  console.log(`[clouddraw] task=${config.taskId} az=${config.az} listening on :${config.port}`);
});

// Graceful shutdown (ECS sends SIGTERM on scale-in / deploy): close sockets with 1012 so
// clients reconnect to another task right away. Players are NOT marked offline.
function shutdown() {
  beginShutdown();
  closeAll();
  server.close();
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
