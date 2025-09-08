import { metaMap } from './_storage.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { emailId, to, subject } = req.body || {};
  if (!emailId) return res.status(400).json({ error: 'Missing emailId' });
  
  metaMap.set(emailId, { to: to || '', subject: subject || '', createdAt: Date.now() });
  
  res.setHeader('Access-Control-Allow-Origin', 'https://mail.google.com');
  res.setHeader('Content-Type', 'application/json');
  res.json({ ok: true });
}