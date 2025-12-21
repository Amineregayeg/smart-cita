/**
 * Admin Stats Endpoint
 * GET /api/admin-stats
 */

const { validateAdminSession, getAdminStats } = require('./shared/redis-client');

exports.handler = async (event) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate session token
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authorization required' })
    };
  }

  const isValid = await validateAdminSession(token);
  if (!isValid) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid or expired session' })
    };
  }

  try {
    const stats = await getAdminStats();

    if (!stats) {
      // Return default stats if Redis not available
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messagesTotal: 0,
          messagesToday: 0,
          tokensToday: 0,
          costToday: 0,
          avgResponseTime: 0,
          platformBreakdown: {
            whatsapp: 0,
            messenger: 0,
            instagram: 0
          },
          dailyMessages: [],
          dailyTokens: []
        })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats)
    };

  } catch (error) {
    console.error('[ADMIN-STATS] Error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch stats' })
    };
  }
};
