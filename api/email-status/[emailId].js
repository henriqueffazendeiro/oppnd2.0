import { readEmails } from '../events.js';

export default function handler(req, res) {
  const { emailId } = req.query;
  
  if (!emailId) {
    return res.status(400).json({ error: 'Missing emailId' });
  }
  
  // Check if email has been read by checking our tracking set
  const status = readEmails.has(emailId) ? 'read' : 'sent';
  console.log(`Status check for: ${emailId} - ${status}`);
  
  res.setHeader('Access-Control-Allow-Origin', 'https://mail.google.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');
  
  res.json({ status });
}