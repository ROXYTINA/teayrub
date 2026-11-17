// Persistent data: leaderboard, match history, artwork gallery.
// Cloud (USE_DYNAMO=true) -> DynamoDB.  Local dev -> plain Redis keys.
import { redis } from './redis.js';
import { config } from './config.js';

export const T = (name) => `${config.tablePrefix}-${name}`;

let _ddb;
export async function ddb() {
  if (!_ddb) {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    const lib = await import('@aws-sdk/lib-dynamodb');
    _ddb = { client: lib.DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region })), ...lib };
  }
  return _ddb;
}

export async function saveMatch({ code, players }) {
  const ts = Date.now();
  const matchId = `${ts}-${code}`;
  if (!config.useDynamo) {
    const m = redis.multi();
    players.forEach((p, i) => {
      m.zincrby('lb:total', p.score, p.name);
      if (i === 0 && p.score > 0) m.zincrby('lb:wins', 1, p.name);
    });
    m.lpush('matches', JSON.stringify({ matchId, code, ts, players })).ltrim('matches', 0, 99);
    await m.exec();
    return;
  }
  const d = await ddb();
  await d.client.send(new d.PutCommand({ TableName: T('matches'), Item: { matchId, code, ts, players } }));
  await Promise.all(players.map((p, i) => d.client.send(new d.UpdateCommand({
    TableName: T('leaderboard'),
    Key: { name: p.name },
    UpdateExpression: 'ADD totalScore :s, games :one, wins :w',
    ExpressionAttributeValues: { ':s': p.score, ':one': 1, ':w': i === 0 && p.score > 0 ? 1 : 0 },
  }))));
}

export async function getLeaderboard(limit = 10) {
  if (!config.useDynamo) {
    const r = await redis.zrevrange('lb:total', 0, limit - 1, 'WITHSCORES');
    const out = [];
    for (let i = 0; i < r.length; i += 2) out.push({ name: r[i], totalScore: Number(r[i + 1]) });
    return out;
  }
  const d = await ddb();
  const r = await d.client.send(new d.ScanCommand({ TableName: T('leaderboard') })); // fine at class scale; add a GSI to scale
  return (r.Items || []).sort((a, b) => b.totalScore - a.totalScore).slice(0, limit)
    .map(({ name, totalScore, wins, games }) => ({ name, totalScore, wins, games }));
}

export async function addArtwork({ key, url, word, drawer, code }) {
  const item = { pk: 'gallery', ts: Date.now(), key, url, word, drawer, code };
  if (!config.useDynamo) {
    await redis.lpush('gallery', JSON.stringify(item));
    await redis.ltrim('gallery', 0, 99);
    return;
  }
  const d = await ddb();
  await d.client.send(new d.PutCommand({ TableName: T('gallery'), Item: item }));
}

export async function listArtworks(limit = 24) {
  if (!config.useDynamo) return (await redis.lrange('gallery', 0, limit - 1)).map((s) => JSON.parse(s));
  const d = await ddb();
  const r = await d.client.send(new d.QueryCommand({
    TableName: T('gallery'),
    KeyConditionExpression: 'pk = :p',
    ExpressionAttributeValues: { ':p': 'gallery' },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return r.Items || [];
}
