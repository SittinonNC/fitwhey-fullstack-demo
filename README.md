# FITWHEY Full Stack Demo

เดโมจากโจทย์สมัครงาน: 2 หน้า พร้อม API ฝั่ง Node.js และฐานข้อมูลที่บันทึกจริง

## เปิดใช้งาน

ต้องใช้ Node.js 22.13 ขึ้นไป (แนะนำ Node 24 LTS หรือใหม่กว่า) เพราะใช้ `node:sqlite` ที่มากับ Node โดยตรง

```bash
npm ci
npm run dev
```

เปิด http://127.0.0.1:3000

## Deploy จาก GitHub

Repository นี้มี `render.yaml` สำหรับ deploy เป็น Node.js Web Service บน Render โดยเชื่อมจาก GitHub
เพื่อให้หน้าเว็บ, Route Handlers และ SQLite demo ทำงานร่วมกันได้ ตัว service จะ bind กับ `0.0.0.0`
และใช้พอร์ตจากตัวแปร `PORT` ของโฮสต์โดยอัตโนมัติ

ฐานข้อมูลบน free service เป็นข้อมูลเดโมชั่วคราวและอาจเริ่มใหม่เมื่อ instance ถูกสร้างใหม่
หากใช้งานจริงให้เปลี่ยนเป็น PostgreSQL และเก็บ connection string ผ่าน environment variable

สำหรับ production build บนเครื่อง:

```bash
npm run build
npm start
```

หยุด dev server ก่อนใช้ `npm start` เพราะใช้ port 3000 เหมือนกัน ตัวแอป bind ที่ loopback เท่านั้น

## ลองตามโจทย์

1. หน้า `/`: เริ่มที่ 5 lb / Choc ราคา 1,299 บาท มีสต็อก 12 ชิ้น
2. เปลี่ยนเป็น 10 lb: Choc ยังถูกเลือก แต่จะแจ้งหมดและปิดปุ่มซื้อ
3. เลือก Vanilla: เปลี่ยนเป็น 2,499 บาทและเพิ่มลงตะกร้าได้
4. เปิด `/cart`: ปรับจำนวน ลบรายการ และยืนยันคำสั่งซื้อทดลอง
5. แสดงหมายเลข Order และใบสรุป สต็อกลดลงจริงและคงอยู่หลัง restart
6. เปิดสองแท็บเพื่อดูสต็อกอัปเดตทุก 3 วินาทีเมื่อแท็บแสดงอยู่

ราคา สต็อก และค่าจัดส่งเป็นข้อมูลสมมติ ไม่มี payment gateway ไม่มีการเรียกเก็บเงิน/ส่งสินค้า และไม่มีการเก็บข้อมูลส่วนตัว

## API

### GET /api/products/my-whey

คืน product + variants ทั้งหมด + ราคาเป็นสตางค์ + `availableQuantity` / `version`
ส่ง `Cache-Control: no-store` และ `X-Request-Id`; ไม่พบสินค้าคืน 404

```bash
curl http://127.0.0.1:3000/api/products/my-whey
```

### POST /api/orders

```bash
curl http://127.0.0.1:3000/api/orders \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: example-order-key-0001' \
  -d '{"items":[{"variantId":"whey-5-choc","quantity":1}]}'
```

- 201: Order ใหม่; 200: replay คำขอเดิม
- 400: รูปแบบข้อมูล/จำนวน/key ไม่ถูกต้อง
- 403: browser ส่งมาจาก origin อื่น
- 404: ไม่มี SKU ที่เปิดขาย
- 409 `OUT_OF_STOCK`: สต็อกไม่พอ, rollback ทุก SKU
- 409 `IDEMPOTENCY_CONFLICT`: key เดิม แต่รายการ/จำนวนต่างจากเดิม
- 413: payload เกินขนาด; 415: content type ไม่ถูกต้อง
- 500: ข้อผิดพลาดภายใน; client retry ด้วย key เดิม

ส่งเฉพาะ `variantId` และ `quantity` ฝั่ง server ใช้ราคาจากฐานข้อมูล ไม่เชื่อราคาจาก browser
API ไม่เปิดเผยรายการ Order สาธารณะ และไม่มี endpoint reset ฐานข้อมูล
ในเดโมนี้ key เป็น UUID แบบสุ่มทั่วระบบ; production ควรผูกกับ customer/session ที่ยืนยันตัวตนแล้ว

## หลักการที่ใช้จริง

- Next.js App Router + React + TypeScript; Route Handlers รัน Node.js runtime
- SQLite เก็บ `products`, `variants`, `inventory`, `orders`, `order_items`
- หนึ่งขนาด × หนึ่งรส = หนึ่ง SKU, มี UNIQUE constraint ป้องกันตัวเลือกซ้ำ
- จำนวนและเงินใช้ integer; money อยู่ในหน่วยสตางค์
- `CHECK (available >= 0)` เป็นแนวป้องกันอีกชั้น
- Order items เก็บ snapshot ชื่อสินค้า ขนาด รสชาติ SKU และราคาตอนซื้อ
- `BEGIN IMMEDIATE` + conditional UPDATE `available >= quantity` + Order insert ใน transaction เดียว
- รวม SKU ซ้ำก่อนตรวจ limit และเรียง SKU ก่อนเขียน
- Idempotency key มี unique constraint และ canonical request hash ภายใน transaction เดียวกัน
- เมื่อผล HTTP ไม่แน่นอน client เก็บ key/รายการเดิมใน sessionStorage และหยุดแก้ตะกร้าจนตรวจผลสำเร็จ
- เก็บเฉพาะตะกร้าใน localStorage เพื่อให้ reload ได้; stock/ราคา/Order authoritative อยู่บน server
- SSR ข้อมูลเริ่มต้น ช่วยไม่ต้องรอ API round trip ก่อนเห็นสินค้า
- โหลดตัวเลือกครบในครั้งเดียว เปลี่ยน size/flavour โดย lookup ฝั่ง client
- catalog มี cache ใน process 30 วินาที; stock อ่านสดด้วย query เดียว ไม่ทำ N+1
- poll ทุก 3 วินาทีเฉพาะแท็บที่ visible; refresh เมื่อกลับมา focus; มี timeout และป้องกัน overlapping polls
- Next Image ย่อและบีบอัดภาพ local; รูปหลัก preload; CSS responsive พร้อม keyboard focus และ live announcements

## ความแตกต่างจากแบบ production ที่อธิบายไว้ก่อนหน้า

เดโมนี้ใช้ SQLite แทน PostgreSQL เพื่อเปิดใช้งานได้ทันทีโดยไม่ต้องตั้งบริการเพิ่ม และใช้ catalog cache ใน process แทน Redis
สต็อกอ่านสดจาก SQLite จึงยังไม่มี stock cache/outbox/event invalidation ที่ต้อง deploy เพิ่ม
Order `confirmed_demo` จะตัด available ทันที ไม่ใช่การ reserve รอ payment จึงยังไม่มี reservation expiry/cancellation workflow

SQLite รองรับ concurrent readers ด้วย WAL แต่ serialize writer; `DatabaseSync` เป็น synchronous และบล็อก event loop ระหว่าง query
จึงเหมาะกับเดโมเครื่องเดียว ไม่ได้อ้างว่าเป็นระบบรองรับ high traffic หรือ benchmark ของ production

ก่อน deploy หลาย instance ให้ย้าย repository layer ไป PostgreSQL ด้วย connection pool และ row-level conditional updates
เพิ่ม Redis สำหรับ shared catalog/stock cache, outbox worker, authentication/session scope, rate limit, observability,
payment/reservation lifecycle และ price quote/version validation ก่อนยืนยันราคาเปลี่ยน
ควรเลือก cache TTL/SLO จาก load test บน infrastructure จริง ไม่ใช้ตัวเลข latency ของเดโมเป็นข้อสรุป production

## ตรวจสอบ

```bash
npm test
npm run build
npm run test:api
```

`npm test` ตรวจ persistence, idempotency, invalid quantities, duplicate SKU aggregation,
rollback เมื่อ SKU หลังสุดไม่พอ, rollback เมื่อ insert Order item ล้มเหลว และ 20 worker connections แย่งชิ้นสุดท้าย

`npm run test:api` เปิด production server ชั่วคราวที่ 127.0.0.1:3107 และใช้ฐานข้อมูลใน temporary directory แยกจากเดโม
ตรวจ pages/API/error codes, 10 requests key เดียว -> 1 Order, และ 30 requests แย่งชิ้นสุดท้าย -> 1 success / 29 conflicts
เปลี่ยน port ทดสอบได้ด้วย `TEST_PORT` และจะปิด server/ลบ test DB หลังจบ

ข้อมูลเดโมอยู่ใน `data/store.sqlite` (ไม่รวมใน source control) เปลี่ยนด้วย `DB_PATH`
หากต้องการเริ่มเดโมใหม่ ให้หยุด server แล้วรัน:

```bash
npm run db:reset -- --confirm
npm run dev
```

คำสั่ง reset ลบ Order เดโมทั้งหมดและคืน stock ค่าเริ่มต้น; ล้างรายการตะกร้าผ่านหน้าเว็บด้วยหากมีรายการค้าง

## ที่มาภาพและเอกสารอ้างอิง

- ภาพประกอบสินค้าจาก https://fitwhey.com/product/BAAM-100-MY-WHEY/
- ไฟล์ต้นฉบับภาพ: https://bucket.fitwhey.com/products/6a0bf5570771f.webp
- แบรนด์และรูปภาพเป็นของเจ้าของเดิม ใช้ประกอบเดโมส่วนบุคคลตามโจทย์ ไม่ใช่ร้าน Fitwhey อย่างเป็นทางการ
- https://nextjs.org/docs/app/getting-started/route-handlers
- https://nodejs.org/api/sqlite.html
- ใช้ system fonts และภาพ local ไม่ต้องโหลด Google Fonts หรือ CDN เพื่อใช้งานเดโม

## โครงสร้าง

```text
app/page.tsx                         หน้าสินค้า
app/cart/page.tsx                    ตะกร้าและผลคำสั่งซื้อ
app/api/products/[id]/route.ts       GET product API
app/api/orders/route.ts              POST order API
components/shop-provider.tsx        ตะกร้า, refresh, idempotent checkout
lib/store.mjs                       schema, seed, queries, transaction
tests/store.test.mjs                database integration tests
scripts/test-api.mjs                HTTP integration tests
```
