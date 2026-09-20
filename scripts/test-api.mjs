import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const dir = mkdtempSync(join(tmpdir(), 'fitwhey-http-'));
const port = process.env.TEST_PORT || '3107';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { env: { ...process.env, DB_PATH: join(dir, 'api.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', data => { logs += data; }); server.stderr.on('data', data => { logs += data; });
const orderBody = (id, quantity = 1) => ({ items: [{ variantId: id, quantity }] });
const post = (body, key = randomUUID(), origin = base) => fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, Origin: origin }, body: JSON.stringify(body) });
try {
  let online = false;
  for (let i = 0; i < 60; i++) {
    try { online = (await fetch(`${base}/api/products/my-whey`)).ok; if (online) break; } catch {}
    if (server.exitCode !== null) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(online, logs);
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(`${base}/cart`)).status, 200);
  const product = await fetch(`${base}/api/products/my-whey`);
  assert.equal(product.headers.get('cache-control'), 'no-store');
  assert.equal((await product.json()).data.variants.length, 6);
  assert.equal((await fetch(`${base}/api/products/missing`)).status, 404);
  assert.equal((await post(orderBody('whey-5-choc'), randomUUID(), 'https://example.com')).status, 403);
  assert.equal((await post(orderBody('whey-5-choc', 0))).status, 400);
  assert.equal((await post(orderBody('whey-10-choc'))).status, 409);
  const key = randomUUID();
  const repeats = await Promise.all(Array.from({ length: 10 }, () => post(orderBody('whey-5-choc'), key)));
  assert.equal(repeats.filter(r => r.status === 201).length, 1);
  assert.equal(repeats.filter(r => r.status === 200).length, 9);
  const ids = await Promise.all(repeats.map(async r => (await r.json()).data.id));
  assert.equal(new Set(ids).size, 1);
  assert.equal((await post(orderBody('whey-5-choc', 2), key)).status, 409);
  // Seeded stock is 3: buy 2, then race 30 independent requests for the final piece.
  assert.equal((await post(orderBody('whey-10-strawberry', 2))).status, 201);
  const race = await Promise.all(Array.from({ length: 30 }, () => post(orderBody('whey-10-strawberry'))));
  assert.equal(race.filter(r => r.status === 201).length, 1);
  assert.equal(race.filter(r => r.status === 409).length, 29);
  const final = (await (await fetch(`${base}/api/products/my-whey`)).json()).data;
  assert.equal(final.variants.find(v => v.id === 'whey-10-strawberry').availableQuantity, 0);
  assert.equal(final.variants.find(v => v.id === 'whey-5-choc').availableQuantity, 11);
  console.log('PASS: pages, API contract, invalid input, sold out, 10 concurrent retries -> 1 order, 30 last-item requests -> 1 success / 29 conflicts.');
} catch (error) { console.error(logs); throw error; }
finally { server.kill('SIGTERM'); await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve)); rmSync(dir, { recursive: true, force: true }); }
