import { store, errorResponse } from '@/lib/server';
import { StoreError } from '@/lib/store.mjs';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const origin = request.headers.get('origin');
    // Next may normalize request.url to localhost although the browser uses 127.0.0.1.
    // Host is the browser-facing authority; don't trust arbitrary forwarded headers.
    const expectedOrigin = `${new URL(request.url).protocol}//${request.headers.get('host')}`;
    if (origin && origin !== expectedOrigin) throw new StoreError('INVALID_ORIGIN', 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น', 403);
    if (!request.headers.get('content-type')?.includes('application/json')) throw new StoreError('INVALID_CONTENT_TYPE', 'ต้องส่ง application/json', 415);
    const text = await request.text();
    if (text.length > 8192) throw new StoreError('PAYLOAD_TOO_LARGE', 'ข้อมูลมีขนาดใหญ่เกินไป', 413);
    let body;
    try { body = JSON.parse(text); } catch { throw new StoreError('INVALID_JSON', 'JSON ไม่ถูกต้อง'); }
    const result = store.createOrder(body, request.headers.get('idempotency-key'));
    return Response.json({ data: result.order, meta: { replayed: result.replayed } }, { status: result.replayed ? 200 : 201, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
  } catch (error) { return errorResponse(error, requestId); }
}
