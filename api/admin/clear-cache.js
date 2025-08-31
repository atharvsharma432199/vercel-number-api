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

  const { secret } = req.query;

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  try {
    const keys = await redis.keys('num:*');
    const partitions = await redis.keys('part:*');
    
    if (keys.length > 0) await redis.del(keys);
    if (partitions.length > 0) await redis.del(partitions);

    res.status(200).json({
      success: true,
      message: `Cleared ${keys.length + partitions.length} cache entries`,
      cleared: { number_cache: keys.length, partitions: partitions.length }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
