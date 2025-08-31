import { Redis } from '@vercel/kv';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use GET.' 
    });
  }

  const { secret, page = 1, limit = 50, search } = req.query;
  const authHeader = req.headers.authorization;
  const adminSecret = secret || (authHeader && authHeader.replace('Bearer ', ''));

  // Validate admin secret
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ 
      success: false,
      error: 'Invalid admin secret' 
    });
  }

  try {
    const startTime = Date.now();

    // Get all API keys from index
    const allKeys = await redis.smembers('api_keys_index') || [];
    
    // Get details for each key with pagination and search
    const keysData = [];
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;

    let filteredKeys = allKeys;

    // Apply search filter if provided
    if (search) {
      filteredKeys = allKeys.filter(key => {
        return key.toLowerCase().includes(search.toLowerCase());
      });
    }

    // Get paginated keys
    const paginatedKeys = filteredKeys.slice(startIndex, endIndex);

    for (const key of paginatedKeys) {
      const keyData = await redis.hgetall(`apikey:${key}`);
      if (keyData) {
        const isUnlimited = keyData.unlimited === 'true';
        const limit = parseInt(keyData.limit || 0);
        const used = parseInt(keyData.used || 0);
        
        keysData.push({
          api_key: key,
          limit: isUnlimited ? 'Unlimited' : limit,
          used: used,
          remaining: isUnlimited ? 'Unlimited' : (limit - used),
          unlimited: isUnlimited,
          created_at: keyData.createdAt ? new Date(parseInt(keyData.createdAt)).toLocaleString() : 'Unknown',
          name: keyData.name || 'Unknown',
          email: keyData.email || '',
          is_active: keyData.isActive === 'true',
          last_used: keyData.lastUsed ? new Date(parseInt(keyData.lastUsed)).toLocaleString() : 'Never'
        });
      }
    }

    // Sort by creation date (newest first)
    keysData.sort((a, b) => {
      const dateA = a.created_at === 'Unknown' ? 0 : new Date(a.created_at).getTime();
      const dateB = b.created_at === 'Unknown' ? 0 : new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    const totalPages = Math.ceil(filteredKeys.length / limitNum);
    const responseTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      data: {
        keys: keysData,
        pagination: {
          current_page: pageNum,
          total_pages: totalPages,
          total_keys: filteredKeys.length,
          keys_per_page: limitNum,
          has_next: endIndex < filteredKeys.length,
          has_prev: pageNum > 1
        },
        summary: {
          total_keys: allKeys.length,
          active_keys: keysData.filter(k => k.is_active).length,
          unlimited_keys: keysData.filter(k => k.unlimited).length,
          total_requests: keysData.reduce((sum, key) => sum + key.used, 0)
        }
      },
      meta: {
        response_time: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('List keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve API keys',
      details: error.message
    });
  }
}
