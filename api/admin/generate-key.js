import { Redis } from '@vercel/kv';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { secret, limit, name, unlimited } = req.query;

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  try {
    const apiKey = 'key_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    
    const keyData = {
      limit: unlimited === 'true' ? 0 : parseInt(limit || '100'),
      used: 0,
      unlimited: unlimited === 'true',
      createdAt: Date.now(),
      name: name || 'Unknown',
      isActive: true
    };

    await redis.hset(`apikey:${apiKey}`, keyData);
    await redis.sadd('api_keys_index', apiKey);

    res.status(200).json({
      success: true,
      message: 'API key generated successfully',
      api_key: apiKey,
      details: keyData
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
