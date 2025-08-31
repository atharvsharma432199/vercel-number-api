import { validateApiKey } from '../lib/auth.js';
import { getNumberInfo } from '../lib/database.js';
import { rateLimit } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  const { number } = req.query;
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  try {
    const keyValidation = await validateApiKey(apiKey);
    if (!keyValidation.valid) {
      return res.status(401).json({ error: keyValidation.error, details: keyValidation.details });
    }

    const rateLimitCheck = await rateLimit(apiKey);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ error: 'Too many requests', retryAfter: rateLimitCheck.retryAfter });
    }

    if (!number || !number.match(/^[6-9]\d{9}$/)) {
      return res.status(400).json({ error: 'Valid Indian number required' });
    }

    const numberInfo = await getNumberInfo(number);
    
    if (!numberInfo) {
      return res.status(404).json({ error: 'Number not found', number });
    }

    const responseTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      data: numberInfo,
      meta: {
        cached: numberInfo.cached || false,
        response_time: `${responseTime}ms`,
        requests_remaining: keyValidation.data.unlimited ? 'Unlimited' : keyValidation.data.limit - keyValidation.data.used
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
    }
