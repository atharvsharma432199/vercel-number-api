import { Redis } from '@vercel/kv';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function rateLimit(apiKey, windowMs = 60000, maxRequests = 60) {
  const key = `ratelimit:${apiKey}`;
  const now = Date.now();
  
  try {
    const windowStart = now - windowMs;
    await redis.zremrangebyscore(key, 0, windowStart);
    
    const requestCount = await redis.zcard(key);
    
    if (requestCount >= maxRequests) {
      const oldest = await redis.zrange(key, 0, 0, { withScores: true });
      const retryAfter = Math.ceil((oldest[1] + windowMs - now) / 1000);
      
      return { allowed: false, retryAfter };
    }
    
    await redis.zadd(key, now, now);
    await redis.expire(key, Math.ceil(windowMs / 1000));
    
    return { allowed: true, remaining: maxRequests - requestCount - 1 };
    
  } catch (error) {
    console.error('Rate limit error:', error);
    return { allowed: true, remaining: maxRequests };
  }
}
