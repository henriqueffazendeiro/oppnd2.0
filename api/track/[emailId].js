export default async function handler(req, res) {
  const { emailId } = req.query;
  const clientId = req.query.u;

  if (!emailId) {
    return res.status(400).json({ error: 'Missing emailId' });
  }

  console.log(`Email read: ${emailId} by client: ${clientId}`);

  // Return JavaScript that posts a message to notify the extension
  const script = `
    <script>
      try {
        window.parent.postMessage({
          type: 'GMAIL_TICKS_EMAIL_READ',
          trackingId: '${emailId}',
          clientId: '${clientId || ''}'
        }, '*');
      } catch(e) {}
    </script>
    <img width="1" height="1" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hTBx4wAAAABJRU5ErkJggg==" />
  `;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Access-Control-Allow-Origin', 'https://mail.google.com');
  res.send(script);
}