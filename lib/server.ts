import { createStore } from './store.mjs';
const globalStore = globalThis as unknown as { fitwheyStore?: ReturnType<typeof createStore> };
export const store = globalStore.fitwheyStore ??= createStore();

export function errorResponse(error: unknown, requestId: string) {
  const e = error as { status?: number; code?: string; message?: string; details?: unknown };
  if (!e.status) console.error(`[${requestId}]`, error);
  return Response.json({ error: { code: e.code ?? 'INTERNAL_ERROR', message: e.status ? e.message : 'ระบบขัดข้อง กรุณาลองใหม่', details: e.details, requestId } }, {
    status: e.status ?? 500, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId }
  });
}
