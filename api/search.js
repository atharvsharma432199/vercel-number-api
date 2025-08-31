import { validateApiKey } from '../lib/auth';
import { searchRecords } from '../lib/database';
import { rateLimit } from '../lib/rate-limit';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const { q: query, field, limit = 50, page = 1 } = req.query;
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  try {
    // Validate API key
    const keyValidation = await validateApiKey(apiKey);
    if (!keyValidation.valid) {
      return res.status(401).json({ 
        error: keyValidation.error,
        details: keyValidation.details 
      });
    }

    // Check rate limiting
    const rateLimitCheck = await rateLimit(apiKey);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: rateLimitCheck.retryAfter
      });
    }

    if (!query) {
      return res.status(400).json({ 
        error: 'Search query required',
        example: '/api/search?q=john&field=name'
      });
    }

    // Perform search
    const allResults = await searchRecords(query, field);
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = allResults.slice(startIndex, endIndex);

    const responseTime = Date.now() - startTime;

    res.status(200).json({
      search: {
        query: query,
        field: field || 'all_fields',
        total_results: allResults.length,
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(allResults.length / limit)
      },
      results: paginatedResults,
      response_time: `${responseTime}ms`
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
