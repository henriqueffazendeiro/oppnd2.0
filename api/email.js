export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { emailId, to, subject, clientId } = req.body;

  if (!emailId) {
    return res.status(400).json({ error: 'Missing emailId' });
  }

  // Store email info (you can save to database here)
  console.log(`Email sent: ${emailId} to ${to} subject: ${subject} client: ${clientId}`);
  
  res.setHeader('Access-Control-Allow-Origin', 'https://mail.google.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  res.json({ 
    success: true, 
    emailId,
    message: 'Email tracking registered' 
  });
}