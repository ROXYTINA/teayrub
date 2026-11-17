import fs from 'node:fs';
import { config } from './config.js';
import { ddb, T } from './store.js';

let words = [];

export async function initWords() {
  const bank = JSON.parse(fs.readFileSync(new URL('../data/words.json', import.meta.url), 'utf8'));
  words = Object.values(bank).flat();
  if (config.useDynamo) {
    try {
      const d = await ddb();
      const items = [];
      let key;
      do {
        const r = await d.client.send(new d.ScanCommand({ TableName: T('words'), ExclusiveStartKey: key }));
        items.push(...(r.Items || []));
        key = r.LastEvaluatedKey;
      } while (key);
      if (items.length) words = items.map((i) => i.word);
      console.log(`[words] loaded ${words.length} words from DynamoDB`);
    } catch (e) {
      console.warn('[words] DynamoDB unavailable, using bundled list:', e.message);
    }
  }
  console.log(`[words] ${words.length} words ready`);
}

export function pickWord(used = []) {
  const u = new Set(used);
  const pool = words.filter((w) => !u.has(w));
  const list = pool.length ? pool : words;
  return list[Math.floor(Math.random() * list.length)];
}
