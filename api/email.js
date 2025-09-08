export const config = { runtime: 'edge' };
import { kvSetJSON } from './_kv.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const body = await req.json().catch(() => ({}));
  const { emailId, to, subject } = body || {};
  if (!emailId) return new Response('Missing emailId', { status: 400 });

  await kvSetJSON(`meta:${emailId}`, { to: to || '', subject: subject || '', createdAt: Date.now() }, 60*60*24*30);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}