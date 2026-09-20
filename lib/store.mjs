import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export class StoreError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message); this.code = code; this.status = status; this.details = details;
  }
}

export function createStore(filename = resolve(/* turbopackIgnore: true */ process.env.DB_PATH || './data/store.sqlite')) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, brand TEXT NOT NULL,
      description TEXT NOT NULL, image TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
      sku TEXT NOT NULL UNIQUE, size TEXT NOT NULL, flavour TEXT NOT NULL,
      price_minor INTEGER NOT NULL CHECK(price_minor >= 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      UNIQUE(product_id, size, flavour)
    );
    CREATE TABLE IF NOT EXISTS inventory (
      variant_id TEXT PRIMARY KEY REFERENCES variants(id),
      available INTEGER NOT NULL CHECK(available >= 0),
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, order_number TEXT NOT NULL UNIQUE,
      idempotency_key TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL,
      status TEXT NOT NULL, currency TEXT NOT NULL,
      subtotal_minor INTEGER NOT NULL, shipping_minor INTEGER NOT NULL,
      total_minor INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_items (
      order_id TEXT NOT NULL REFERENCES orders(id),
      variant_id TEXT NOT NULL REFERENCES variants(id),
      sku TEXT NOT NULL, product_name TEXT NOT NULL, size TEXT NOT NULL, flavour TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price_minor INTEGER NOT NULL,
      line_total_minor INTEGER NOT NULL,
      PRIMARY KEY(order_id, variant_id)
    );
  `);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR IGNORE INTO products VALUES (?, ?, ?, ?, ?)').run(
      'my-whey', 'MY WHEY', 'BAAM!!',
      'เวย์โปรตีนสำหรับทุกวันของการฝึก เลือกขนาดและรสชาติที่ใช่ แล้วไปให้ถึงเป้าหมายของคุณ',
      '/images/my-whey.webp'
    );
    const seed = [
      ['whey-5-choc', 'BAAM-5-CHO', '5 lb', 'Choc', 129900, 12],
      ['whey-5-vanilla', 'BAAM-5-VAN', '5 lb', 'Vanilla', 134900, 8],
      ['whey-5-strawberry', 'BAAM-5-STR', '5 lb', 'Strawberry', 134900, 5],
      ['whey-10-choc', 'BAAM-10-CHO', '10 lb', 'Choc', 239900, 0],
      ['whey-10-vanilla', 'BAAM-10-VAN', '10 lb', 'Vanilla', 249900, 6],
      ['whey-10-strawberry', 'BAAM-10-STR', '10 lb', 'Strawberry', 249900, 3],
    ];
    for (const [id, sku, size, flavour, price, stock] of seed) {
      db.prepare('INSERT OR IGNORE INTO variants(id, product_id, sku, size, flavour, price_minor) VALUES (?, ?, ?, ?, ?, ?)').run(id, 'my-whey', sku, size, flavour, price);
      db.prepare('INSERT OR IGNORE INTO inventory(variant_id, available) VALUES (?, ?)').run(id, stock);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }

  // Catalog metadata changes infrequently. Inventory is deliberately read fresh.
  const catalogCache = new Map();
  function getProduct(id) {
    let entry = catalogCache.get(id);
    if (!entry || entry.expiresAt < Date.now()) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!product) throw new StoreError('PRODUCT_NOT_FOUND', 'ไม่พบสินค้า', 404);
      const variants = db.prepare('SELECT id, sku, size, flavour, price_minor AS priceMinor FROM variants WHERE product_id = ? AND active = 1 ORDER BY rowid').all(id);
      entry = { product, variants, expiresAt: Date.now() + 30000 };
      catalogCache.set(id, entry);
    }
    const inventory = db.prepare('SELECT i.variant_id, i.available, i.version FROM inventory i JOIN variants v ON v.id = i.variant_id WHERE v.product_id = ?').all(id);
    const stock = new Map(inventory.map(row => [row.variant_id, row]));
    return { ...entry.product, currency: 'THB', maxPerOrder: 10,
      variants: entry.variants.map(variant => ({ ...variant, availableQuantity: stock.get(variant.id).available, version: stock.get(variant.id).version })),
      inventoryAsOf: new Date().toISOString() };
  }

  function readOrder(id) {
    const order = db.prepare(`SELECT id, order_number AS orderNumber, status, currency,
      subtotal_minor AS subtotalMinor, shipping_minor AS shippingMinor,
      total_minor AS totalMinor, created_at AS createdAt FROM orders WHERE id = ?`).get(id);
    const items = db.prepare(`SELECT variant_id AS variantId, sku, product_name AS productName,
      size, flavour, quantity, unit_price_minor AS unitPriceMinor, line_total_minor AS lineTotalMinor
      FROM order_items WHERE order_id = ? ORDER BY variant_id`).all(id);
    return { ...order, items };
  }

  function createOrder(body, key) {
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key))
      throw new StoreError('INVALID_IDEMPOTENCY_KEY', 'ต้องส่ง Idempotency-Key ที่ถูกต้อง');
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => k !== 'items') || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20)
      throw new StoreError('INVALID_ITEMS', 'รายการสินค้าไม่ถูกต้อง');
    const merged = new Map();
    for (const item of body.items) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(k => !['variantId', 'quantity'].includes(k)) || typeof item.variantId !== 'string' || item.variantId.length > 80 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10)
        throw new StoreError('INVALID_QUANTITY', 'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1–10');
      merged.set(item.variantId, (merged.get(item.variantId) || 0) + item.quantity);
      if (merged.get(item.variantId) > 10) throw new StoreError('QUANTITY_LIMIT', 'ซื้อได้สูงสุด 10 ชิ้นต่อรายการ');
    }
    const items = [...merged].sort(([a], [b]) => a.localeCompare(b)).map(([variantId, quantity]) => ({ variantId, quantity }));
    const hash = createHash('sha256').update(JSON.stringify(items)).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = db.prepare('SELECT id, request_hash FROM orders WHERE idempotency_key = ?').get(key);
      if (existing) {
        if (existing.request_hash !== hash) throw new StoreError('IDEMPOTENCY_CONFLICT', 'คำขอนี้ถูกใช้กับรายการสินค้าอื่นแล้ว', 409);
        const order = readOrder(existing.id); db.exec('COMMIT');
        return { order, replayed: true };
      }
      const lines = [];
      for (const item of items) {
        const variant = db.prepare(`SELECT v.*, p.name AS product_name FROM variants v
          JOIN products p ON p.id = v.product_id WHERE v.id = ? AND v.active = 1`).get(item.variantId);
        if (!variant) throw new StoreError('VARIANT_NOT_FOUND', 'ไม่พบตัวเลือกสินค้า', 404);
        const updated = db.prepare('UPDATE inventory SET available = available - ?, version = version + 1 WHERE variant_id = ? AND available >= ? RETURNING available').get(item.quantity, item.variantId, item.quantity);
        if (!updated) throw new StoreError('OUT_OF_STOCK', `${variant.size} / ${variant.flavour} มีสินค้าไม่เพียงพอ กรุณาปรับจำนวน`, 409, { variantId: item.variantId });
        lines.push({ ...variant, quantity: item.quantity });
      }
      const subtotal = lines.reduce((sum, line) => sum + line.price_minor * line.quantity, 0);
      const id = randomUUID();
      const number = 'FW-' + id.slice(0, 8).toUpperCase();
      db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, number, key, hash, 'confirmed_demo', 'THB', subtotal, 0, subtotal, new Date().toISOString());
      const insert = db.prepare('INSERT INTO order_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const line of lines) insert.run(id, line.id, line.sku, line.product_name, line.size, line.flavour, line.quantity, line.price_minor, line.price_minor * line.quantity);
      const order = readOrder(id);
      db.exec('COMMIT');
      return { order, replayed: false };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return { getProduct, createOrder, close: () => db.close() };
}
