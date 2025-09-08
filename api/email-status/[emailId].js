export const config = { runtime: 'edge' };
import { kvGetJSON } from '../_kv.js';

export default async function handler(req, ctx) {
  const { emailId } = ctx.params || {};
  if (!emailId) return new Response(JSON.stringify({ error: 'Missing id' }), {
    status: 400, headers: { 'Content-Type': 'application/json' }
  });

  const rec = await kvGetJSON(`read:${emailId}`);
  const status = rec?.status === 'read' ? 'read' : 'sent';
  const body = { status, readAt: rec?.readAt || null };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://mail.google.com',
      'Cache-Control': 'no-store'
    }
  });
}