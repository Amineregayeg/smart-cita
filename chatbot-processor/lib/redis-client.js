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

/**
 * Log message stats for admin dashboard
 * @param {object} stats - Stats object
 */
async function logMessageStats(stats) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const pipeline = client.pipeline();

    // Increment message counters
    pipeline.incr('chatbot:stats:messages:total');
    pipeline.incr(`chatbot:stats:messages:${today}`);
    pipeline.expire(`chatbot:stats:messages:${today}`, 604800); // 7 days TTL

    // Increment platform counter
    if (stats.platform) {
      pipeline.incr(`chatbot:stats:platform:${stats.platform}`);
    }

    // Update response time tracking
    if (stats.responseTime) {
      pipeline.incrby('chatbot:stats:response_time:sum', stats.responseTime);
      pipeline.incr('chatbot:stats:response_time:count');
    }

    // Track token usage for today
    if (stats.tokens) {
      pipeline.incrby(`chatbot:stats:tokens:${today}`, stats.tokens);
      pipeline.expire(`chatbot:stats:tokens:${today}`, 604800);
    }

    // Log conversation entry (keep last 1000)
    if (stats.logEntry) {
      const logJson = JSON.stringify(stats.logEntry);
      pipeline.lpush('chatbot:logs:recent', logJson);
      pipeline.ltrim('chatbot:logs:recent', 0, 999);
    }

    await pipeline.exec();
  } catch (error) {
    console.error('[REDIS] Stats logging error:', error.message);
  }
}

/**
 * Log booking stats for admin dashboard
 * @param {object} bookingData - Booking details
 */
async function logBookingStats(bookingData) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const pipeline = client.pipeline();

    // Increment booking counters
    pipeline.incr('chatbot:stats:bookings:total');
    pipeline.incr(`chatbot:stats:bookings:${today}`);
    pipeline.expire(`chatbot:stats:bookings:${today}`, 604800); // 7 days TTL

    // Track by center
    if (bookingData.center) {
      pipeline.incr(`chatbot:stats:bookings:center:${bookingData.center}`);
    }

    // Track by treatment
    if (bookingData.treatment) {
      pipeline.incr(`chatbot:stats:bookings:treatment:${bookingData.treatment}`);
    }

    // Log booking entry (keep last 100)
    const logEntry = {
      timestamp: new Date().toISOString(),
      center: bookingData.center,
      treatment: bookingData.treatment,
      date: bookingData.date,
      time: bookingData.time,
      eventId: bookingData.eventId,
      platform: bookingData.platform || 'unknown'
    };
    pipeline.lpush('chatbot:logs:bookings', JSON.stringify(logEntry));
    pipeline.ltrim('chatbot:logs:bookings', 0, 99);

    await pipeline.exec();
    console.log('[REDIS] Booking stats logged');
  } catch (error) {
    console.error('[REDIS] Booking stats error:', error.message);
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

module.exports = {
  getRedisClient,
  getSessionContext,
  setSessionContext,
  incrementTokenCounter,
  getCachedResponse,
  setCachedResponse,
  logMessageStats,
  logBookingStats,
  getAdminStats,
  getConversationLogs
};

/**
 * Check if a platform is enabled
 * @param {string} platform - Platform name (whatsapp, messenger, instagram)
 * @returns {Promise<boolean>} - True if enabled (default true if not set)
 */
async function isPlatformEnabled(platform) {
  const client = await getRedisClient();
  if (!client) return true; // Default to enabled if Redis unavailable

  try {
    const key = `chatbot:config:platform:${platform}:enabled`;
    const value = await client.get(key);
    // Default to enabled if not set
    if (value === null) return true;
    return value === "true" || value === "1";
  } catch (error) {
    console.error("[REDIS] Platform config error:", error.message);
    return true; // Default to enabled on error
  }
}

module.exports.isPlatformEnabled = isPlatformEnabled;
