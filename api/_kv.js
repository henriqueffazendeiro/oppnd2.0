export const config = { runtime: 'edge' };

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvFetch(bodyArr) {
  if (!url || !token) {
    return { ok: false, error: 'Missing Upstash env vars' };
  }
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyArr),
  });
  if (!res.ok) return { ok: false, error: `KV ${res.status}` };
  const data = await res.json();
  return { ok: true, data };
}

export async function kvSetJSON(key, val, ttlSec = 60 * 60 * 24 * 14) { // 14 dias
  const v = JSON.stringify(val);
  const ops = [['SET', key, v], ['EXPIRE', key, String(ttlSec)]];
  return kvFetch(ops);
}

export async function kvGetJSON(key) {
  const r = await kvFetch([['GET', key]]);
  if (!r.ok) return null;
  const raw = r.data?.[0]?.result;
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}