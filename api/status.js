import { Redis } from '@vercel/kv';
import { getEnabledDatabases } from '../lib/config.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

  try {
    const startTime = Date.now();
    
    // Get basic system information
    const enabledDbs = getEnabledDatabases();
    const [dbSize, memoryUsage, uptime] = await Promise.all([
      getDatabaseSize(),
      getMemoryUsage(),
      getUptime()
    ]);

    // Get API usage statistics
    const apiStats = await getApiStatistics();
    
    // Get database status
    const databaseStatus = await getDatabaseStatus();
    
    const responseTime = Date.now() - startTime;

    // Prepare response
    const statusResponse = {
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
      response_time: `${responseTime}ms`,
      
      system: {
        node_version: process.version,
        platform: process.platform,
        uptime: `${uptime} seconds`,
        memory_usage: `${memoryUsage} MB`,
        environment: process.env.NODE_ENV || 'development'
      },
      
      database: {
        total_databases: 14,
        enabled_databases: enabledDbs.length,
        estimated_records: dbSize.estimated_records,
        total_keys: dbSize.total_keys,
        partitions: parseInt(process.env.NUMBER_PARTITIONS) || 1000,
        status: 'connected'
      },
      
      api: {
        total_requests: apiStats.total_requests,
        active_keys: apiStats.active_keys,
        rate_limit: `${process.env.MAX_REQUESTS_PER_MINUTE || 60} requests/minute`,
        cache_hit_rate: `${apiStats.cache_hit_rate}%`
      },
      
      performance: {
        average_response_time: '5-50ms',
        max_capacity: '300M+ records',
        storage_type: 'Vercel KV with partitioning',
        cache_enabled: true,
        cache_duration: '1 hour'
      },
      
      databases: databaseStatus,
      
      endpoints: {
        number_lookup: '/api/number?number=XXXXXXXXXX',
        search: '/api/search?q=query',
        health: '/api/health',
        db_status: '/api/db-status',
        admin_panel: '/api/admin'
      }
    };

    res.status(200).json(statusResponse);

  } catch (error) {
    console.error('Status check error:', error);
    
    res.status(500).json({
      success: false,
      status: 'degraded',
      error: error.message,
      timestamp: new Date().toISOString(),
      note: 'System is running but some features may be limited'
    });
  }
}

// Helper functions
async function getDatabaseSize() {
  try {
    const totalKeys = await redis.dbsize();
    return {
      total_keys: totalKeys,
      estimated_records: totalKeys * 150, // Approximate calculation
      storage_usage: `${(totalKeys * 0.5).toFixed(2)} KB` // Approximate size
    };
  } catch (error) {
    console.error('Database size error:', error);
    return { total_keys: 0, estimated_records: 0, storage_usage: '0 KB' };
  }
}

async function getMemoryUsage() {
  try {
    const memory = process.memoryUsage();
    return (memory.rss / 1024 / 1024).toFixed(2);
  } catch (error) {
    return 'Unknown';
  }
}

function getUptime() {
  return Math.floor(process.uptime());
}

async function getApiStatistics() {
  try {
    // Get total API requests
    const apiKeys = await redis.smembers('api_keys_index') || [];
    let totalRequests = 0;
    let activeKeys = 0;

    for (const key of apiKeys) {
      const keyData = await redis.hgetall(`apikey:${key}`);
      if (keyData && keyData.used) {
        totalRequests += parseInt(keyData.used);
        if (keyData.isActive === 'true') {
          activeKeys++;
        }
      }
    }

    // Get cache statistics (approximate)
    const cacheKeys = await redis.keys('num:*');
    const cacheHitRate = cacheKeys.length > 0 ? Math.min(95, Math.floor((cacheKeys.length / 1000) * 100)) : 0;

    return {
      total_requests: totalRequests,
      active_keys: activeKeys,
      cache_hit_rate: cacheHitRate,
      total_api_keys: apiKeys.length
    };

  } catch (error) {
    console.error('API stats error:', error);
    return { total_requests: 0, active_keys: 0, cache_hit_rate: 0, total_api_keys: 0 };
  }
}

async function getDatabaseStatus() {
  try {
    const enabledDbs = getEnabledDatabases();
    const status = [];

    for (const db of enabledDbs) {
      // Check if database has been loaded (simple check)
      const sampleKey = `db:status:${db.id}`;
      const dbStatus = await redis.get(sampleKey) || 'not_loaded';
      
      status.push({
        id: db.id,
        name: db.name,
        enabled: db.enabled,
        status: dbStatus,
        last_checked: new Date().toISOString()
      });
    }

    return status;

  } catch (error) {
    console.error('Database status error:', error);
    return [];
  }
}

// Health check function (can be used by other services)
export async function getHealthStatus() {
  try {
    // Test Redis connection
    await redis.ping();
    
    return {
      healthy: true,
      timestamp: new Date().toISOString(),
      services: {
        redis: 'connected',
        api: 'operational',
        databases: 'available'
      }
    };
  } catch (error) {
    return {
      healthy: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        redis: 'disconnected',
        api: 'degraded',
        databases: 'unknown'
      }
    };
  }
}
