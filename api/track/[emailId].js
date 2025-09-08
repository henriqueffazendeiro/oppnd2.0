import { connections, readEmails } from '../events.js';

export default async function handler(req, res) {
  const { emailId } = req.query;
  const clientId = req.query.u;

  if (!emailId) {
    return res.status(400).json({ error: 'Missing emailId' });
  }

  // Mark as read (you can store in database here)
  readEmails.add(emailId);
  console.log(`Email read: ${emailId} by client: ${clientId}`);

  // Send SSE event to connected clients
  if (clientId && connections.has(clientId)) {
    const connection = connections.get(clientId);
    try {
      connection.write('event: emailRead\n');
      connection.write(`data: {"trackingId":"${emailId}"}\n\n`);
      console.log(`SSE sent emailRead to ${clientId}`);
    } catch (e) {
      connections.delete(clientId);
    }
  }

  // Return 1x1 transparent pixel
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hTBx4wAAAABJRU5ErkJggg==', 'base64');
  
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Access-Control-Allow-Origin', 'https://mail.google.com');
  res.send(pixel);
}