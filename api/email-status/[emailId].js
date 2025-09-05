// API route for getting email status
export default async function handler(req, res) {
  const { emailId } = req.query;
  
  if (!emailId) {
    return res.status(400).json({ error: 'Email ID required' });
  }

  if (req.method === 'GET') {
    try {
      const status = await getEmailStatus(emailId);
      res.status(200).json({ emailId, status: status || 'sent' });
    } catch (error) {
      console.error('Error getting email status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getEmailStatus(emailId) {
  // In production, this would query a database
  // For now, we'll use Vercel Edge Config or KV store
  
  try {
    // This is a placeholder - you'll need to implement actual storage
    // Options: Vercel KV, Redis, MongoDB, etc.
    
    // Simple fallback using environment variables (not recommended for production)
    const statusData = process.env[`EMAIL_${emailId}`];
    if (statusData) {
      return JSON.parse(statusData).status;
    }
    
    return 'sent'; // Default status
  } catch (error) {
    console.error('Failed to get email status:', error);
    return 'sent';
  }
}