export default function handler(req, res) {
  const { emailId } = req.query;
  
  if (!emailId) {
    return res.status(400).json({ error: 'Missing emailId' });
  }
  
  // Use a simple timestamp-based approach
  // If this endpoint is called, assume it's being tracked
  // The real read detection happens via pixel in /api/track/[emailId]
  console.log(`Status check for: ${emailId} - sent (awaiting read)`);
  
  res.setHeader('Access-Control-Allow-Origin', 'https://mail.google.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');
  
  // Always return 'sent' - reads are detected via SSE from pixel tracking
  res.json({ status: 'sent' });
}