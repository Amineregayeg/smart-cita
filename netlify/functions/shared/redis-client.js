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

/**
 * Get stats for admin dashboard
 * @returns {Promise<object>} - Stats object
 */
async function getAdminStats() {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const today = new Date().toISOString().split('T')[0];
    const pipeline = client.pipeline();

    // Get message counts
    pipeline.get('chatbot:stats:messages:total');
    pipeline.get(`chatbot:stats:messages:${today}`);

    // Get token count for today
    pipeline.get(`chatbot:stats:tokens:${today}`);

    // Get response time stats
    pipeline.get('chatbot:stats:response_time:sum');
    pipeline.get('chatbot:stats:response_time:count');

    // Get platform breakdown
    pipeline.get('chatbot:stats:platform:whatsapp');
    pipeline.get('chatbot:stats:platform:messenger');
    pipeline.get('chatbot:stats:platform:instagram');

    // Get daily messages for last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      pipeline.get(`chatbot:stats:messages:${dateStr}`);
    }

    // Get daily tokens for last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      pipeline.get(`chatbot:stats:tokens:${dateStr}`);
    }

    const results = await pipeline.exec();

    // Parse results
    const messagesTotal = parseInt(results[0][1]) || 0;
    const messagesToday = parseInt(results[1][1]) || 0;
    const tokensToday = parseInt(results[2][1]) || 0;
    const responseTimeSum = parseInt(results[3][1]) || 0;
    const responseTimeCount = parseInt(results[4][1]) || 1;
    const platformWhatsApp = parseInt(results[5][1]) || 0;
    const platformMessenger = parseInt(results[6][1]) || 0;
    const platformInstagram = parseInt(results[7][1]) || 0;

    // Calculate daily messages
    const dailyMessages = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMessages.push({
        date: dateStr,
        count: parseInt(results[8 + i][1]) || 0
      });
    }

    // Calculate daily tokens
    const dailyTokens = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyTokens.push({
        date: dateStr,
        tokens: parseInt(results[15 + i][1]) || 0
      });
    }

    // GPT-5 Nano pricing
    const costPerInputToken = 0.05 / 1000000;
    const costPerOutputToken = 0.40 / 1000000;
    // Estimate: 70% input, 30% output tokens
    const estimatedCost = tokensToday * (0.7 * costPerInputToken + 0.3 * costPerOutputToken);

    return {
      messagesTotal,
      messagesToday,
      tokensToday,
      costToday: Math.round(estimatedCost * 100) / 100,
      avgResponseTime: Math.round(responseTimeSum / responseTimeCount),
      platformBreakdown: {
        whatsapp: platformWhatsApp,
        messenger: platformMessenger,
        instagram: platformInstagram
      },
      dailyMessages: dailyMessages.reverse(),
      dailyTokens: dailyTokens.reverse()
    };
  } catch (error) {
    console.error('[REDIS] Get stats error:', error.message);
    return null;
  }
}

/**
 * Get conversation logs for admin dashboard
 * @param {object} options - Query options
 * @returns {Promise<object>} - Logs with pagination
 */
async function getConversationLogs(options = {}) {
  const client = await getRedisClient();
  if (!client) return { conversations: [], total: 0, page: 1, pages: 1 };

  try {
    const { page = 1, limit = 20, platform, search } = options;
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // Get total count
    const total = await client.llen('chatbot:logs:recent');

    // Get logs
    const logs = await client.lrange('chatbot:logs:recent', start, end);
    let conversations = logs.map(log => JSON.parse(log));

    // Filter by platform if specified
    if (platform) {
      conversations = conversations.filter(c => c.platform === platform);
    }

    // Filter by search term if specified
    if (search) {
      const searchLower = search.toLowerCase();
      conversations = conversations.filter(c =>
        c.userMessage?.toLowerCase().includes(searchLower) ||
        c.botResponse?.toLowerCase().includes(searchLower)
      );
    }

    return {
      conversations,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  } catch (error) {
    console.error('[REDIS] Get logs error:', error.message);
    return { conversations: [], total: 0, page: 1, pages: 1 };
  }
}

/**
 * Store admin session token
 * @param {string} token - Session token
 * @param {number} ttlSeconds - Time to live (default: 24h)
 */
async function setAdminSession(token, ttlSeconds = 86400) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.setex(`admin:session:${token}`, ttlSeconds, '1');
  } catch (error) {
    console.error('[REDIS] Admin session set error:', error.message);
  }
}

/**
 * Validate admin session token
 * @param {string} token - Session token
 * @returns {Promise<boolean>} - True if valid
 */
async function validateAdminSession(token) {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    const exists = await client.get(`admin:session:${token}`);
    return exists === '1';
  } catch (error) {
    console.error('[REDIS] Admin session validate error:', error.message);
    return false;
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
  getTokenUsage,
  getAdminStats,
  getConversationLogs,
  setAdminSession,
  validateAdminSession
};
