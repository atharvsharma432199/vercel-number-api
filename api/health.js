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
    const healthChecks = [];

    // 1. Check Redis Connection
    healthChecks.push(await checkRedisConnection());

    // 2. Check Database Connections
    healthChecks.push(await checkDatabases());

    // 3. Check System Health
    healthChecks.push(await checkSystemHealth());

    // 4. Check API Status
    healthChecks.push(await checkApiStatus());

    // Determine overall status
    const allHealthy = healthChecks.every(check => check.status === 'healthy');
    const overallStatus = allHealthy ? 'healthy' : 'degraded';

    const responseTime = Date.now() - startTime;

    // Prepare response
    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      response_time: `${responseTime}ms`,
      version: '1.0.0',
      service: 'Number Lookup API',
      
      checks: healthChecks,
      
      system: {
        node_version: process.version,
        platform: process.platform,
        architecture: process.arch,
        uptime: `${Math.floor(process.uptime())} seconds`,
        memory_usage: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
        environment: process.env.NODE_ENV || 'development'
      },
      
      endpoints: {
        number_lookup: '/api/number?number=XXXXXXXXXX',
        search: '/api/search?q=query',
        health: '/api/health',
        status: '/api/status',
        db_status: '/api/db-status',
        admin_panel: '/api/admin'
      }
    };

    res.status(allHealthy ? 200 : 503).json(healthResponse);

  } catch (error) {
    console.error('Health check error:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      checks: [
        {
          name: 'api_server',
          status: 'unhealthy',
          error: 'Server error occurred',
          timestamp: new Date().toISOString()
        }
      ]
    });
  }
}

// Health check functions
async function checkRedisConnection() {
  const checkStart = Date.now();
  
  try {
    // Test Redis connection
    await redis.ping();
    const dbSize = await redis.dbsize();
    
    return {
      name: 'redis_connection',
      status: 'healthy',
      response_time: `${Date.now() - checkStart}ms`,
      timestamp: new Date().toISOString(),
      details: {
        connected: true,
        database_size: dbSize,
        estimated_records: dbSize * 150
      }
    };
  } catch (error) {
    return {
      name: 'redis_connection',
      status: 'unhealthy',
      response_time: `${Date.now() - checkStart}ms`,
      timestamp: new Date().toISOString(),
      error: error.message,
      details: {
        connected: false,
        database_size: 0
      }
    };
  }
}

async function checkDatabases() {
  const checkStart = Date.now();
  
  try {
    const enabledDbs = getEnabledDatabases();
    const databaseStatus = [];

    for (const db of enabledDbs) {
      // Simple check if database has been accessed recently
      const lastAccessKey = `db:last_access:${db.id}`;
      const lastAccess = await redis.get(lastAccessKey);
      
      databaseStatus.push({
        id: db.id,
        name: db.name,
        status: lastAccess ? 'available' : 'unknown',
        last_access: lastAccess || 'never'
      });
    }

    return {
      name: 'databases',
      status: 'healthy',
      response_time: `${Date.now() - checkStart}ms`,
      timestamp: new Date().toISOString(),
      details: {
        total_databases: 14,
        enabled_databases: enabledDbs.length,
        databases: databaseStatus
      }
    };
  } catch (error) {
    return {
      name: 'databases',
      status: 'degraded',
      response_time: `${Date.now() - checkStart}ms`,
      timestamp: new Date().toISOString(),
      error: error.message,
      details: {
        total_databases: 14,
        enabled_databases: 0,
        databases: []
      }
    };
  }
}

async function checkSystemHealth() {
  const checkStart = Date.now();
  
  try {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      name: 'system_health',
      status: 'healthy',
      response_time: `${Date.now() - checkStart}ms`,
      timestamp: new Date().toISOString(),
      details: {
        uptime: `${Math.floor(uptime)} seconds`,
        memory: {
          rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
          heap_total: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          heap_used: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
        },
        cpu: {
          usage: 'normal',
          architecture: process.arch
        }
      }
    };
  } catch (error) {
    return {
      name: 'system_health',
      status: 'degraded',
      response_time: `${Date.now() - checkStart}ms`,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

async function checkApiStatus() {
  const checkStart = Date.now();
  
  try {
    // Get API usage statistics
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

    return {
      name: 'api_status',
      status: 'healthy',
      response_time: `${Date.now() - checkStart}ms`,
      timestamp: new Date().toISOString(),
      details: {
        total_requests: totalRequests,
        active_api_keys: activeKeys,
        total_api_keys: apiKeys.length,
        rate_limit: `${process.env.MAX_REQUESTS_PER_MINUTE || 60} requests/minute`
      }
    };
  } catch (error) {
    return {
      name: 'api_status',
      status: 'degraded',
      response_time: `${Date.now() - checkStart}ms`,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

// Additional function for external health checks
export async function getHealthStatus() {
  try {
    // Test all connections
    await redis.ping();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: 'connected',
        api: 'operational',
        databases: 'available'
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
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
