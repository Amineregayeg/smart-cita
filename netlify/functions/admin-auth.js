/**
 * Admin Authentication Endpoint
 * POST /api/admin-auth
 */

const crypto = require('crypto');
const { setAdminSession } = require('./shared/redis-client');

// Rate limiting for auth attempts
const authAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60000; // 1 minute

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Check rate limiting
  const clientIP = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const attempts = authAttempts.get(clientIP) || { count: 0, lockUntil: 0 };

  if (Date.now() < attempts.lockUntil) {
    const remainingSeconds = Math.ceil((attempts.lockUntil - Date.now()) / 1000);
    return {
      statusCode: 429,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: `Demasiados intentos. Espera ${remainingSeconds} segundos.`
      })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { passwordHash } = body;

    if (!passwordHash) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Password hash required' })
      };
    }

    // Get expected password hash from environment
    const expectedHash = process.env.ADMIN_PASSWORD_HASH;

    if (!expectedHash) {
      console.error('[ADMIN-AUTH] ADMIN_PASSWORD_HASH not configured');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Server configuration error' })
      };
    }

    // Timing-safe comparison
    const passwordBuffer = Buffer.from(passwordHash.toLowerCase());
    const expectedBuffer = Buffer.from(expectedHash.toLowerCase());

    let isValid = false;
    if (passwordBuffer.length === expectedBuffer.length) {
      isValid = crypto.timingSafeEqual(passwordBuffer, expectedBuffer);
    }

    if (!isValid) {
      // Increment failed attempts
      attempts.count++;
      if (attempts.count >= MAX_ATTEMPTS) {
        attempts.lockUntil = Date.now() + LOCKOUT_DURATION;
        attempts.count = 0;
      }
      authAttempts.set(clientIP, attempts);

      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Contrasena incorrecta' })
      };
    }

    // Reset attempts on success
    authAttempts.delete(clientIP);

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Store in Redis
    const sessionStored = await setAdminSession(token);
    console.log('[ADMIN-AUTH] Session storage result:', sessionStored);

    console.log('[ADMIN-AUTH] Login successful from', clientIP);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        token,
        expiresAt
      })
    };

  } catch (error) {
    console.error('[ADMIN-AUTH] Error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Server error' })
    };
  }
};
