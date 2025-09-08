import { readMap } from '../_storage.js';

export default function handler(req, res) {
  const { emailId } = req.query;
  const entry = readMap.get(emailId);
  const status = entry?.status === 'read' ? 'read' : 'sent';
  
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', 'https://mail.google.com');
  res.setHeader('Content-Type', 'application/json');
  res.json({ status, readAt: entry?.readAt || null });
}