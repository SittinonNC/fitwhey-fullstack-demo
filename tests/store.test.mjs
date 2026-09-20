import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { createStore } from '../lib/store.mjs';

const request = (variantId = 'whey-5-choc', quantity = 1) => ({ items: [{ variantId, quantity }] });
const stock = (store, id = 'whey-5-choc') => store.getProduct('my-whey').variants.find(v => v.id === id).availableQuantity;

test('server prices, snapshots, persistence and idempotency', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitwhey-test-'));
  const path = join(dir, 'test.sqlite');
  let store = createStore(path);
  try {
    const key = randomUUID();
    const first = store.createOrder(request(), key);
    assert.equal(first.order.totalMinor, 129900);
    assert.equal(first.order.items[0].sku, 'BAAM-5-CHO');
    assert.equal(stock(store), 11);
    store.close(); store = createStore(path);
    const repeat = store.createOrder(request(), key);
    assert.equal(repeat.replayed, true);
    assert.equal(repeat.order.id, first.order.id);
    assert.equal(stock(store), 11);
    assert.throws(() => store.createOrder(request('whey-5-choc', 2), key), { code: 'IDEMPOTENCY_CONFLICT' });
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('rolls back every SKU if a later SKU has insufficient stock', () => {
  const store = createStore(':memory:');
  try {
    assert.throws(() => store.createOrder({ items: [
      { variantId: 'whey-5-choc', quantity: 2 },
      { variantId: 'whey-5-strawberry', quantity: 6 }
    ] }, randomUUID()), { code: 'OUT_OF_STOCK' });
    assert.equal(stock(store), 12);
    assert.equal(stock(store, 'whey-5-strawberry'), 5);
  } finally { store.close(); }
});

test('rejects invalid quantities and client-supplied prices', () => {
  const store = createStore(':memory:');
  try {
    for (const quantity of [0, -1, 1.5, '1', null, 11, Infinity]) {
      assert.throws(() => store.createOrder(request('whey-5-choc', quantity), randomUUID()), { code: 'INVALID_QUANTITY' });
    }
    assert.throws(() => store.createOrder({ items: [{ variantId: 'whey-5-choc', quantity: 1, priceMinor: 1 }] }, randomUUID()), { code: 'INVALID_QUANTITY' });
    assert.throws(() => store.createOrder(request(), ''), { code: 'INVALID_IDEMPOTENCY_KEY' });
    assert.equal(stock(store), 12);
  } finally { store.close(); }
});

test('merges repeated SKUs before enforcing limits and hashing', () => {
  const store = createStore(':memory:');
  try {
    const key = randomUUID();
    const result = store.createOrder({ items: [...request().items, ...request().items] }, key);
    assert.equal(result.order.items.length, 1);
    assert.equal(result.order.items[0].quantity, 2);
    assert.equal(store.createOrder(request('whey-5-choc', 2), key).replayed, true);
    assert.throws(() => store.createOrder({ items: [...request('whey-5-choc', 6).items, ...request('whey-5-choc', 6).items] }, randomUUID()), { code: 'QUANTITY_LIMIT' });
  } finally { store.close(); }
});

test('stock is restored if storing the order items fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitwhey-rollback-'));
  const path = join(dir, 'test.sqlite');
  const store = createStore(path);
  const inspector = new DatabaseSync(path);
  try {
    inspector.exec("CREATE TRIGGER fail_items BEFORE INSERT ON order_items BEGIN SELECT RAISE(ABORT, 'simulated insert failure'); END;");
    assert.throws(() => store.createOrder(request(), randomUUID()), /simulated insert failure/);
    assert.equal(stock(store), 12);
    assert.equal(inspector.prepare('SELECT count(*) AS n FROM orders').get().n, 0);
  } finally { inspector.close(); store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('20 independent database connections compete for one last item: exactly one order', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fitwhey-race-'));
  const path = join(dir, 'test.sqlite');
  const store = createStore(path);
  const inspector = new DatabaseSync(path);
  inspector.prepare('UPDATE inventory SET available = 1 WHERE variant_id = ?').run('whey-5-choc');
  try {
    const workers = Array.from({ length: 20 }, () => new Worker(new URL('./stock-worker.mjs', import.meta.url), { workerData: { path, key: randomUUID() } }));
    let readyCount = 0;
    const results = await Promise.all(workers.map(worker => new Promise((resolve, reject) => {
      worker.on('message', message => {
        if (message === 'ready') {
          readyCount++;
          if (readyCount === workers.length) workers.forEach(w => w.postMessage('start'));
        } else resolve(message);
      });
      worker.on('error', reject);
      worker.on('exit', code => { if (code) reject(new Error(`Worker exit ${code}`)); });
    })));
    assert.equal(results.filter(r => r.ok).length, 1);
    assert.equal(results.filter(r => r.code === 'OUT_OF_STOCK').length, 19);
    assert.equal(stock(store), 0);
    assert.equal(inspector.prepare('SELECT count(*) AS n FROM orders').get().n, 1);
    await Promise.all(workers.map(worker => worker.terminate()));
  } finally { inspector.close(); store.close(); rmSync(dir, { recursive: true, force: true }); }
});
