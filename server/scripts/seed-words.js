// Usage: USE_DYNAMO=true TABLE_PREFIX=clouddraw AWS_REGION=ap-southeast-1 npm run seed-words
import fs from 'node:fs';
import { config } from '../src/config.js';
import { ddb, T } from '../src/store.js';

const bank = JSON.parse(fs.readFileSync(new URL('../data/words.json', import.meta.url), 'utf8'));
const items = Object.entries(bank).flatMap(([category, list]) => list.map((word) => ({ word, category })));
const d = await ddb();
for (let i = 0; i < items.length; i += 25) {
  const chunk = items.slice(i, i + 25);
  await d.client.send(new d.BatchWriteCommand({
    RequestItems: { [T('words')]: chunk.map((Item) => ({ PutRequest: { Item } })) },
  }));
}
console.log(`Seeded ${items.length} words into ${T('words')} (${config.region})`);
process.exit(0);
