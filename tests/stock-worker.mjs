import { parentPort, workerData } from 'node:worker_threads';
import { createStore } from '../lib/store.mjs';
const store = createStore(workerData.path);
parentPort.postMessage('ready');
parentPort.once('message', () => {
  try { store.createOrder({ items: [{ variantId: 'whey-5-choc', quantity: 1 }] }, workerData.key); parentPort.postMessage({ ok: true }); }
  catch (error) { parentPort.postMessage({ ok: false, code: error.code, message: error.message }); }
  finally { store.close(); parentPort.close(); }
});
