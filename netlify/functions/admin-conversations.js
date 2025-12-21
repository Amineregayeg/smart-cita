/**
 * Admin Conversations Endpoint
 * GET /api/admin-conversations
 */

const { validateAdminSession, getConversationLogs } = require('./shared/redis-client');

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
    // Parse query parameters
    const params = event.queryStringParameters || {};
    const page = parseInt(params.page) || 1;
    const limit = Math.min(parseInt(params.limit) || 20, 100);
    const platform = params.platform || null;
    const search = params.search || null;

    const logs = await getConversationLogs({ page, limit, platform, search });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logs)
    };

  } catch (error) {
    console.error('[ADMIN-CONVERSATIONS] Error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch conversations' })
    };
  }
};
