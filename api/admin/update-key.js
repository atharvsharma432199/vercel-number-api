import { Redis } from '@vercel/kv';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Allow both GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use GET or POST.' 
    });
  }

  const { secret, key, limit, unlimited, reset_usage, is_active, name, email } = req.method === 'GET' ? req.query : req.body;
  const authHeader = req.headers.authorization;
  const adminSecret = secret || (authHeader && authHeader.replace('Bearer ', ''));

  // Validate admin secret
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ 
      success: false,
      error: 'Invalid admin secret' 
    });
  }

  if (!key) {
    return res.status(400).json({ 
      success: false,
      error: 'API key parameter is required' 
    });
  }

  try {
    const startTime = Date.now();

    // Check if key exists
    const existingData = await redis.hgetall(`apikey:${key}`);
    if (!existingData || !existingData.limit) {
      return res.status(404).json({ 
        success: false,
        error: 'API key not found' 
      });
    }

    const updates = {};
    let updateMessage = 'API key updated: ';
    const updateParts = [];

    // Apply updates based on provided parameters
    if (limit !== undefined) {
      updates.limit = parseInt(limit);
      updateParts.push(`limit set to ${limit}`);
    }
    
    if (unlimited !== undefined) {
      updates.unlimited = unlimited === 'true' || unlimited === '1';
      if (updates.unlimited) {
        updates.limit = 0;
      }
      updateParts.push(`unlimited ${updates.unlimited ? 'enabled' : 'disabled'}`);
    }
    
    if (reset_usage === 'true' || reset_usage === '1') {
      updates.used = 0;
      updates.lastReset = Date.now();
      updateParts.push('usage reset to zero');
    }
    
    if (is_active !== undefined) {
      updates.isActive = is_active === 'true' || is_active === '1';
      updateParts.push(`status ${updates.isActive ? 'activated' : 'deactivated'}`);
    }
    
    if (name !== undefined) {
      updates.name = name;
      updateParts.push(`name updated to ${name}`);
    }
    
    if (email !== undefined) {
      updates.email = email;
      updateParts.push(`email updated to ${email}`);
    }

    // Add last updated timestamp
    updates.lastUpdated = Date.now();

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await redis.hset(`apikey:${key}`, updates);
      updateMessage += updateParts.join(', ');
    } else {
      updateMessage = 'No changes made to API key';
    }

    // Get updated data
    const updatedData = await redis.hgetall(`apikey:${key}`);
    const responseTime = Date.now() - startTime;

    // Prepare response
    const responseData = {
      api_key: key,
      limit: updatedData.unlimited === 'true' ? 'Unlimited' : parseInt(updatedData.limit),
      used: parseInt(updatedData.used || 0),
      remaining: updatedData.unlimited === 'true' ? 'Unlimited' : (parseInt(updatedData.limit) - parseInt(updatedData.used || 0)),
      unlimited: updatedData.unlimited === 'true',
      is_active: updatedData.isActive === 'true',
      name: updatedData.name || 'Unknown',
      email: updatedData.email || '',
      created_at: updatedData.createdAt ? new Date(parseInt(updatedData.createdAt)).toLocaleString() : 'Unknown',
      last_updated: new Date().toLocaleString()
    };

    res.status(200).json({
      success: true,
      message: updateMessage,
      data: responseData,
      meta: {
        response_time: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Update key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API key',
      details: error.message
    });
  }
}
