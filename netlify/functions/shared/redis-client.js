/**
 * Redis client for chatbot message queue and session management
 * Uses Upstash Redis (serverless-compatible)
 */

let Redis;
let redisClient = null;

/**
 * Get or create Redis client singleton
 * @returns {Promise<object>} - Redis client instance
 */
async function getRedisClient() {
  // Return cached client if available
  if (redisClient) {
    return redisClient;
  }

  // Check for required environment variable
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    console.warn('[REDIS] UPSTASH_REDIS_URL not configured - messages will not be queued');
    return null;
  }

  try {
    // Dynamic import for ioredis
    if (!Redis) {
      Redis = require('ioredis');
    }

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      lazyConnect: true
    });

    await redisClient.connect();
    console.log('[REDIS] Connected to Upstash Redis');

    return redisClient;
  } catch (error) {
    console.error('[REDIS] Connection error:', error.message);
    return null;
  }
}

/**
 * Push message to processing queue
 * @param {string} platform - 'whatsapp' or 'meta'
 * @param {object} message - Webhook payload
 * @returns {Promise<boolean>} - True if successful
 */
async function pushToQueue(platform, message) {
  const client = await getRedisClient();
  if (!client) {
    console.warn('[REDIS] No client available - message not queued');
    return false;
  }

  try {
    const queueItem = JSON.stringify({
      platform,
      message,
      receivedAt: Date.now()
    });

    await client.lpush('chatbot:messages:queue', queueItem);
    console.log(`[REDIS] Message queued for ${platform}`);
    return true;
  } catch (error) {
    console.error('[REDIS] Failed to queue message:', error.message);
    return false;
  }
}

/**
 * Check if message was already processed (idempotency)
 * @param {string} messageId - Unique message identifier
 * @returns {Promise<boolean>} - True if already processed
 */
async function isMessageProcessed(messageId) {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    const exists = await client.get(`chatbot:processed:${messageId}`);
    if (exists) {
      console.log(`[REDIS] Message ${messageId} already processed - skipping`);
      return true;
    }

    // Mark as processed with 24h TTL
    await client.setex(`chatbot:processed:${messageId}`, 86400, '1');
    return false;
  } catch (error) {
    console.error('[REDIS] Idempotency check error:', error.message);
    return false;
  }
}

/**
 * Check rate limit for user
 * @param {string} userId - User identifier
 * @param {string} platform - Platform name
 * @param {number} maxPerMinute - Maximum messages per minute (default: 10)
 * @returns {Promise<boolean>} - True if within rate limit
 */
async function checkRateLimit(userId, platform, maxPerMinute = 10) {
  const client = await getRedisClient();
  if (!client) return true; // Allow if Redis not available

  try {
    const key = `chatbot:ratelimit:${platform}:${userId}`;
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, 60); // 1 minute window
    }

    if (count > maxPerMinute) {
      console.log(`[REDIS] Rate limit exceeded for ${platform}:${userId}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[REDIS] Rate limit check error:', error.message);
    return true; // Allow on error
  }
}

/**
 * Store session context for user
 * @param {string} platform - Platform name
 * @param {string} userId - User identifier
 * @param {object} context - Session context object
 * @param {number} ttlSeconds - Time to live in seconds (default: 24h)
 */
async function setSessionContext(platform, userId, context, ttlSeconds = 86400) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const key = `chatbot:session:${platform}:${userId}`;
    await client.setex(key, ttlSeconds, JSON.stringify(context));
  } catch (error) {
    console.error('[REDIS] Session context set error:', error.message);
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
    console.error('[REDIS] Session context get error:', error.message);
    return null;
  }
}

/**
 * Increment daily token counter
 * @param {number} inputTokens - Number of input tokens used
 * @param {number} outputTokens - Number of output tokens used
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
 * Get daily token usage
 * @param {string} date - Date in YYYY-MM-DD format (default: today)
 * @returns {Promise<object>} - Token counts {input, output}
 */
async function getTokenUsage(date) {
  const client = await getRedisClient();
  if (!client) return { input: 0, output: 0 };

  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const key = `chatbot:gpt:tokens:${targetDate}`;

    const data = await client.hgetall(key);
    return {
      input: parseInt(data.input) || 0,
      output: parseInt(data.output) || 0
    };
  } catch (error) {
    console.error('[REDIS] Token usage get error:', error.message);
    return { input: 0, output: 0 };
  }
}

module.exports = {
  getRedisClient,
  pushToQueue,
  isMessageProcessed,
  checkRateLimit,
  setSessionContext,
  getSessionContext,
  incrementTokenCounter,
  getTokenUsage
};
