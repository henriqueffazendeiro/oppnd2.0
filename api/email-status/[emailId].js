export default function handler(req, res) {
  const { emailId } = req.query;
  
  if (!emailId) {
    return res.status(400).json({ error: 'Missing emailId' });
  }
  
  // Simple in-memory tracking (use database in production)
  // For now, assume all tracked emails are "read" after being accessed
  console.log(`Status check for: ${emailId}`);
  
  res.setHeader('Access-Control-Allow-Origin', 'https://mail.google.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');
  
  res.json({ status: 'read' });
}