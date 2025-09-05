// API route for tracking email opens
export default async function handler(req, res) {
  const { emailId } = req.query;
  
  if (!emailId) {
    return res.status(400).json({ error: 'Email ID required' });
  }

  try {
    // Update email status to 'read'
    await updateEmailStatus(emailId, 'read');
    
    // Return a 1x1 transparent pixel
    const pixel = Buffer.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00,
      0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
      0x0C, 0x0A, 0x00, 0x3B
    ]);
    
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(pixel);
    
  } catch (error) {
    console.error('Error tracking email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateEmailStatus(emailId, status) {
  // Using Vercel KV or simple storage mechanism
  // For simplicity, using environment variables or external storage
  
  try {
    // This would typically use a database like Redis, MongoDB, or Vercel KV
    // For now, we'll use a simple in-memory store that persists via Vercel Edge Config
    const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/email-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ emailId, status, timestamp: Date.now() })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to update email status:', error);
    return false;
  }
}