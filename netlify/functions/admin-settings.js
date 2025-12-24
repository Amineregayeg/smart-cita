/**
 * Admin Settings Endpoint
 * GET /api/admin-settings - Get platform configuration
 * POST /api/admin-settings - Update platform configuration
 */

const { validateAdminSession, getPlatformConfig, setPlatformConfig } = require('./shared/redis-client');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Validate session token
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Authorization required' })
    };
  }

  const isValid = await validateAdminSession(token);
  if (!isValid) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid or expired session' })
    };
  }

  try {
    // GET - Return current platform configuration
    if (event.httpMethod === 'GET') {
      const config = await getPlatformConfig();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          platforms: config
        })
      };
    }

    // POST - Update platform configuration
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { platform, enabled } = body;

      // Validate input
      const validPlatforms = ['whatsapp', 'messenger', 'instagram'];
      if (!platform || !validPlatforms.includes(platform)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid platform. Use: whatsapp, messenger, or instagram' })
        };
      }

      if (typeof enabled !== 'boolean') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'enabled must be a boolean' })
        };
      }

      const success = await setPlatformConfig(platform, enabled);
      if (!success) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to update platform configuration' })
        };
      }

      // Return updated config
      const config = await getPlatformConfig();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `${platform} ${enabled ? 'enabled' : 'disabled'}`,
          platforms: config
        })
      };
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('[ADMIN-SETTINGS] Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
