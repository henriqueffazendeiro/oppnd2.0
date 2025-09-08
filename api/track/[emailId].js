export const config = { runtime: 'edge' };
import { kvSetJSON } from '../_kv.js';

const PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

export default async function handler(req, ctx) {
  const { emailId } = ctx.params || {};
  if (!emailId) return new Response('Missing id', { status: 400 });

  // marca como lido com timestamp (idempotente)
  await kvSetJSON(`read:${emailId}`, { status: 'read', readAt: Date.now() });

  // devolve 1x1 PNG
  const bytes = Uint8Array.from(atob(PX), c => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': 'https://mail.google.com',
    }
  });
}