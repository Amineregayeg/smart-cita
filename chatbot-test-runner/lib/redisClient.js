/**
 * Redis Client for Test Results Storage
 * Stores test results, metrics, and alerts
 */

require('dotenv').config();
const Redis = require('ioredis');

let redisClient = null;

/**
 * Get Redis client (singleton)
 */
async function getRedisClient() {
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis(process.env.UPSTASH_REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100
    });

    redisClient.on('error', (err) => {
      console.error('[REDIS] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[REDIS] Connected successfully');
    });

    return redisClient;
  } catch (error) {
    console.error('[REDIS] Failed to connect:', error.message);
    return null;
  }
}

/**
 * Store test result
 */
async function storeTestResult(result) {
  const redis = await getRedisClient();
  if (!redis) return false;

  const date = new Date().toISOString().split('T')[0];
  const timestamp = Date.now();

  // Store latest result for this test
  await redis.hset('test:results:latest', result.testId, JSON.stringify({
    ...result,
    timestamp
  }));

  // Add to history
  await redis.lpush(`test:results:history:${date}`, JSON.stringify({
    ...result,
    timestamp
  }));

  // Trim history to last 1000 entries per day
  await redis.ltrim(`test:results:history:${date}`, 0, 999);

  return true;
}

/**
 * Store run summary
 */
async function storeRunSummary(runId, summary) {
  const redis = await getRedisClient();
  if (!redis) return false;

  await redis.hset('test:runs', runId, JSON.stringify(summary));

  // Store latest run ID
  await redis.set('test:runs:latest', runId);

  // Store metrics
  const date = new Date().toISOString().split('T')[0];
  await redis.set(`test:metrics:pass_rate:${date}`, summary.passRate);
  await redis.set(`test:metrics:avg_time:${date}`, summary.avgResponseTime);
  await redis.set(`test:metrics:error_count:${date}`, summary.failedCount);

  return true;
}

/**
 * Get latest test results
 */
async function getLatestResults() {
  const redis = await getRedisClient();
  if (!redis) return null;

  const results = await redis.hgetall('test:results:latest');

  const parsed = {};
  for (const [key, value] of Object.entries(results)) {
    parsed[key] = JSON.parse(value);
  }

  return parsed;
}

/**
 * Get latest run summary
 */
async function getLatestRunSummary() {
  const redis = await getRedisClient();
  if (!redis) return null;

  const latestRunId = await redis.get('test:runs:latest');
  if (!latestRunId) return null;

  const summary = await redis.hget('test:runs', latestRunId);
  return summary ? JSON.parse(summary) : null;
}

/**
 * Get historical metrics
 */
async function getMetricsHistory(days = 7) {
  const redis = await getRedisClient();
  if (!redis) return [];

  const metrics = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const passRate = await redis.get(`test:metrics:pass_rate:${dateStr}`);
    const avgTime = await redis.get(`test:metrics:avg_time:${dateStr}`);
    const errorCount = await redis.get(`test:metrics:error_count:${dateStr}`);

    if (passRate !== null) {
      metrics.push({
        date: dateStr,
        passRate: parseFloat(passRate),
        avgTime: parseFloat(avgTime),
        errorCount: parseInt(errorCount)
      });
    }
  }

  return metrics.reverse();
}

/**
 * Add alert to queue
 */
async function addAlert(alert) {
  const redis = await getRedisClient();
  if (!redis) return false;

  await redis.lpush('test:alerts:pending', JSON.stringify({
    ...alert,
    timestamp: Date.now()
  }));

  return true;
}

/**
 * Get pending alerts
 */
async function getPendingAlerts() {
  const redis = await getRedisClient();
  if (!redis) return [];

  const alerts = await redis.lrange('test:alerts:pending', 0, -1);
  return alerts.map(a => JSON.parse(a));
}

/**
 * Clear pending alerts
 */
async function clearAlerts() {
  const redis = await getRedisClient();
  if (!redis) return false;

  await redis.del('test:alerts:pending');
  return true;
}

/**
 * Close Redis connection
 */
async function closeConnection() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

module.exports = {
  getRedisClient,
  storeTestResult,
  storeRunSummary,
  getLatestResults,
  getLatestRunSummary,
  getMetricsHistory,
  addAlert,
  getPendingAlerts,
  clearAlerts,
  closeConnection
};
