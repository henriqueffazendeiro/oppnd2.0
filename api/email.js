// API route for storing email information
export default async function handler(req, res) {
  
  if (req.method === 'POST') {
    try {
      const { emailId, timestamp, status } = req.body;
      
      if (!emailId) {
        return res.status(400).json({ error: 'Email ID required' });
      }

      await storeEmailInfo(emailId, { timestamp, status: status || 'sent' });
      res.status(200).json({ success: true, emailId });
      
    } catch (error) {
      console.error('Error storing email:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const { emailId, status, timestamp } = req.body;
      
      if (!emailId || !status) {
        return res.status(400).json({ error: 'Email ID and status required' });
      }

      await updateEmailInfo(emailId, { status, lastUpdated: timestamp || Date.now() });
      res.status(200).json({ success: true, emailId, status });
      
    } catch (error) {
      console.error('Error updating email:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['POST', 'PUT']);
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function storeEmailInfo(emailId, data) {
  // In production, use a proper database
  // For Vercel, you can use:
  // - Vercel KV (Redis)
  // - MongoDB Atlas
  // - PlanetScale
  // - Supabase
  
  try {
    // Placeholder implementation using environment variables
    // This is NOT suitable for production
    const emailData = {
      ...data,
      createdAt: Date.now()
    };
    
    // In a real implementation, you'd store this in a database
    console.log(`Storing email ${emailId}:`, emailData);
    
    return true;
  } catch (error) {
    console.error('Failed to store email info:', error);
    throw error;
  }
}

async function updateEmailInfo(emailId, data) {
  try {
    // In a real implementation, you'd update this in a database
    console.log(`Updating email ${emailId}:`, data);
    
    return true;
  } catch (error) {
    console.error('Failed to update email info:', error);
    throw error;
  }
}