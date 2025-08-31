import { Redis } from '@vercel/kv';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function validateApiKey(apiKey) {
  if (!apiKey) {
    return { valid: false, error: 'API key is required' };
  }

  try {
    const keyData = await redis.hgetall(`apikey:${apiKey}`);
    
    if (!keyData || !keyData.limit) {
      return { valid: false, error: 'Invalid API key' };
    }

    const limit = parseInt(keyData.limit);
    const used = parseInt(keyData.used || 0);
    const unlimited = keyData.unlimited === 'true';

    if (!unlimited && used >= limit) {
      return { 
        valid: false, 
        error: 'API limit exceeded',
        details: `Used ${used}/${limit} requests` 
      };
    }

    await redis.hincrby(`apikey:${apiKey}`, 'used', 1);

    return { 
      valid: true, 
      data: { limit, used: used + 1, unlimited } 
    };

  } catch (error) {
    console.error('API key validation error:', error);
    return { valid: false, error: 'Authentication error' };
  }
}
