// Server-Sent Events endpoint for Gmail Ticks
const connections = new Map(); // clientId -> response
const readEmails = new Set(); // emailIds that have been read

export default function handler(req, res) {
  const clientId = req.query.u;
  if (!clientId) {
    return res.status(400).json({ error: 'Missing clientId' });
  }

  // Setup SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': 'https://mail.google.com',
    'Access-Control-Allow-Credentials': 'true'
  });

  // Send initial connection message
  res.write('event: connected\n');
  res.write(`data: {"clientId":"${clientId}"}\n\n`);

  // Store connection
  connections.set(clientId, res);
  console.log(`SSE connected: ${clientId}`);

  // Keep alive ping every 30s
  const ping = setInterval(() => {
    try {
      res.write('event: ping\n');
      res.write('data: {}\n\n');
    } catch (e) {
      clearInterval(ping);
      connections.delete(clientId);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(ping);
    connections.delete(clientId);
    console.log(`SSE disconnected: ${clientId}`);
  });
}

// Export connections and readEmails for other endpoints to use
export { connections, readEmails };