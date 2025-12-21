/**
 * Redis client for chatbot processor
 * Uses Upstash Redis (serverless-compatible)
 */

const Redis = require('ioredis');

let redisClient = null;

/**
 * Get or create Redis client singleton
 * @returns {Promise<object>} - Redis client instance
 */
async function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    console.error('[REDIS] UPSTASH_REDIS_URL not configured');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: false
    });

    redisClient.on('error', (err) => {
      console.error('[REDIS] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[REDIS] Connected to Upstash Redis');
    });

    return redisClient;
  } catch (error) {
    console.error('[REDIS] Failed to create client:', error.message);
    return null;
  }
}

/**
 * Get session context for user
 * @param {string} platform - Platform name
 * @param {string} userId - User identifier
 * @returns {Promise<object|null>} - Session context or null
 */
async function getSessionContext(platform, userId) {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const key = `chatbot:session:${platform}:${userId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[REDIS] Session get error:', error.message);
    return null;
  }
}

/**
 * Update session context for user
 * @param {string} platform - Platform name
 * @param {string} userId - User identifier
 * @param {object} context - Session context
 * @param {number} ttlSeconds - Time to live (default: 24h)
 */
async function setSessionContext(platform, userId, context, ttlSeconds = 86400) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const key = `chatbot:session:${platform}:${userId}`;
    await client.setex(key, ttlSeconds, JSON.stringify(context));
  } catch (error) {
    console.error('[REDIS] Session set error:', error.message);
  }
}

/**
 * Increment token usage counter
 * @param {number} inputTokens - Input tokens used
 * @param {number} outputTokens - Output tokens used
 */
async function incrementTokenCounter(inputTokens, outputTokens) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `chatbot:gpt:tokens:${today}`;

    await client.hincrby(key, 'input', inputTokens);
    await client.hincrby(key, 'output', outputTokens);
    await client.expire(key, 604800); // 7 days TTL
  } catch (error) {
    console.error('[REDIS] Token counter error:', error.message);
  }
}

/**
 * Get cached response for common question
 * @param {string} questionHash - Hash of the question
 * @returns {Promise<string|null>} - Cached response or null
 */
async function getCachedResponse(questionHash) {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const key = `chatbot:cache:${questionHash}`;
    return await client.get(key);
  } catch (error) {
    console.error('[REDIS] Cache get error:', error.message);
    return null;
  }
}

/**
 * Cache response for common question
 * @param {string} questionHash - Hash of the question
 * @param {string} response - Response to cache
 * @param {number} ttlSeconds - Time to live (default: 24h)
 */
async function setCachedResponse(questionHash, response, ttlSeconds = 86400) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const key = `chatbot:cache:${questionHash}`;
    await client.setex(key, ttlSeconds, response);
  } catch (error) {
    console.error('[REDIS] Cache set error:', error.message);
  }
}

module.exports = {
  getRedisClient,
  getSessionContext,
  setSessionContext,
  incrementTokenCounter,
  getCachedResponse,
  setCachedResponse
};
