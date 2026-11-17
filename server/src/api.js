import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import { redis } from './redis.js';
import { config } from './config.js';
import * as game from './game.js';
import * as store from './store.js';

const CODE_RE = /^[A-Z2-9]{5}$/;
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  if (e.userMessage) return res.status(400).json({ error: e.userMessage });
  console.error('[api]', e);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
});

export function apiRouter() {
  const r = express.Router();

  r.post('/rooms', wrap(async (_req, res) => res.json({ code: await game.createRoom() })));

  r.get('/rooms/:code', wrap(async (req, res) => {
    const code = req.params.code.toUpperCase();
    const info = CODE_RE.test(code) && (await game.roomInfo(code));
    res.json(info ? { exists: true, ...info } : { exists: false });
  }));

  r.get('/leaderboard', wrap(async (_req, res) => res.json(await store.getLeaderboard(10))));
  r.get('/gallery', wrap(async (_req, res) => res.json(await store.listArtworks(24))));

  // ---- artwork: the browser uploads the PNG straight to S3 with a presigned URL.
  // Image bytes never pass through the game servers.
  r.post('/artwork/presign', wrap(async (req, res) => {
    const { code, playerId } = req.body || {};
    if (!CODE_RE.test(code || '') || typeof playerId !== 'string') return res.status(400).json({ error: 'bad request' });
    const room = await redis.hgetall(game.K.room(code));
    // Only the drawer of the turn that just ended, and only if somebody guessed it.
    if (room.phase !== 'ROUND_END' || room.drawerId !== playerId || !(Number(room.lastGuessed) > 0)) {
      return res.status(403).json({ error: 'Not eligible to upload artwork' });
    }
    if (!(await redis.set(`art:once:${code}:${room.turn}`, 1, 'EX', 3600, 'NX'))) {
      return res.status(409).json({ error: 'Already uploaded' });
    }
    const file = `${code}-${room.turn}-${crypto.randomBytes(4).toString('hex')}.png`;
    const key = `artwork/${file}`;
    const players = await game.getPlayers(code);
    await redis.set(`art:meta:${key}`, JSON.stringify({ code, word: room.word, drawer: players[playerId]?.name || '?' }), 'EX', 600);

    let uploadUrl;
    if (config.s3Bucket) {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const s3 = new S3Client({ region: config.region });
      uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: config.s3Bucket, Key: key, ContentType: 'image/png' }), { expiresIn: 300 });
    } else {
      uploadUrl = `/api/local-upload/${file}`; // local dev: save to disk instead of S3
    }
    res.json({ key, uploadUrl, headers: { 'Content-Type': 'image/png' } });
  }));

  r.put('/local-upload/:file', express.raw({ type: 'image/png', limit: '2mb' }), wrap(async (req, res) => {
    const file = req.params.file;
    if (config.s3Bucket || !/^[\w-]+\.png$/.test(file)) return res.sendStatus(400);
    if (!(await redis.exists(`art:meta:artwork/${file}`))) return res.sendStatus(403);
    const dir = path.join(config.dataDir, 'artwork');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, file), req.body);
    res.sendStatus(204);
  }));

  r.post('/artwork/confirm', wrap(async (req, res) => {
    const key = String(req.body?.key || '');
    const meta = key && (await redis.get(`art:meta:${key}`));
    if (!meta) return res.status(404).json({ error: 'Unknown upload' });
    const m = JSON.parse(meta);
    await redis.del(`art:meta:${key}`);
    await store.addArtwork({ key, url: `/${key}`, word: m.word, drawer: m.drawer, code: m.code });
    res.json({ ok: true });
  }));

  return r;
}
