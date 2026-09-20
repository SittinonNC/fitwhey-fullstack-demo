import { resolve } from 'node:path';
import { rmSync } from 'node:fs';
import { createStore } from '../lib/store.mjs';
if (!process.argv.includes('--confirm')) {
  console.error('Stop the app first. This deletes demo orders and resets stock. Run npm run db:reset -- --confirm');
  process.exit(1);
}
const path = resolve(process.env.DB_PATH || './data/store.sqlite');
for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
createStore(path).close();
console.log('Demo stock reset. Start the app again.');
