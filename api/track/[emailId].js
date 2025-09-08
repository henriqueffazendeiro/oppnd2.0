import { readMap } from '../_storage.js';

// 1x1 PNG
const PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=', 'base64');

export default function handler(req, res) {
  const { emailId } = req.query;
  if (!emailId) return res.status(400).send('Missing id');

  // marca como lido
  readMap.set(emailId, { status: 'read', readAt: Date.now() });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', 'https://mail.google.com');
  res.send(PX);
}