/**
 * WhatsApp Business API Webhook Handler
 * Receives incoming messages from WhatsApp and queues them for processing
 *
 * Webhook URL: https://[your-netlify-site]/webhook/whatsapp
 */

const crypto = require('crypto');

// CORS headers for responses
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Verify WhatsApp webhook signature (SHA256 HMAC)
 */
function verifySignature(payload, signature, secret) {
  if (!signature || !secret) {
    console.error('[WEBHOOK] Missing signature or secret');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('[WEBHOOK] Signature verification error:', error.message);
    return false;
  }
}

/**
 * Extract message data from WhatsApp webhook payload
 */
function extractMessages(body) {
  const messages = [];

  try {
    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value || {};
        const messageList = value.messages || [];
        const contacts = value.contacts || [];

        for (const message of messageList) {
          if (message.type === 'text') {
            const contact = contacts.find(c => c.wa_id === message.from) || {};

            messages.push({
              id: message.id,
              from: message.from,
              timestamp: parseInt(message.timestamp),
              text: message.text?.body || '',
              contactName: contact.profile?.name || 'Unknown',
              phoneNumberId: value.metadata?.phone_number_id
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[WEBHOOK] Error extracting messages:', error.message);
  }

  return messages;
}

/**
 * Lazy load Redis client only when needed
 */
let redisModule = null;
async function getRedisClient() {
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    console.warn('[WEBHOOK] UPSTASH_REDIS_URL not configured');
    return null;
  }

  try {
    if (!redisModule) {
      redisModule = require('ioredis');
    }

    const client = new redisModule(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      commandTimeout: 5000,
      tls: { rejectUnauthorized: false }
    });

    return client;
  } catch (error) {
    console.error('[WEBHOOK] Redis connection error:', error.message);
    return null;
  }
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // ========== WEBHOOK VERIFICATION (GET) ==========
  if (event.httpMethod === 'GET') {
    console.log('[WEBHOOK] Verification request received');

    const params = event.queryStringParameters || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    console.log('[WEBHOOK] Mode:', mode, 'Token match:', token === verifyToken);

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[WEBHOOK] Verification successful');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: challenge
      };
    }

    console.error('[WEBHOOK] Verification failed');
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Verification failed' })
    };
  }

  // ========== MESSAGE HANDLING (POST) ==========
  if (event.httpMethod === 'POST') {
    console.log('[WEBHOOK] Incoming message webhook');

    try {
      // Step 1: Verify signature
      const signature = event.headers['x-hub-signature-256'];
      const appSecret = process.env.WHATSAPP_APP_SECRET;

      if (!verifySignature(event.body, signature, appSecret)) {
        console.error('[WEBHOOK] Invalid signature');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid signature' })
        };
      }

      console.log('[WEBHOOK] Signature verified');

      // Step 2: Parse body and extract messages
      const body = JSON.parse(event.body);
      const messages = extractMessages(body);

      if (messages.length === 0) {
        console.log('[WEBHOOK] No text messages in payload');
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', messages: 0 }) };
      }

      console.log(`[WEBHOOK] Extracted ${messages.length} message(s)`);

      // Step 3: Queue messages for processing (if Redis available)
      let queuedCount = 0;
      const client = await getRedisClient();

      if (client) {
        try {
          for (const message of messages) {
            // Skip old messages (older than 5 minutes)
            const messageAge = Date.now() - (message.timestamp * 1000);
            if (messageAge > 300000) {
              console.log(`[WEBHOOK] Message ${message.id} too old - skipping`);
              continue;
            }

            // Check if already processed
            const processedKey = `chatbot:processed:${message.id}`;
            const exists = await client.get(processedKey);
            if (exists) {
              console.log(`[WEBHOOK] Message ${message.id} already processed`);
              continue;
            }

            // Mark as processed
            await client.setex(processedKey, 86400, '1');

            // Queue message
            const queueItem = JSON.stringify({
              platform: 'whatsapp',
              message,
              receivedAt: Date.now()
            });
            await client.lpush('chatbot:messages:queue', queueItem);
            queuedCount++;
          }

          await client.quit();
        } catch (redisError) {
          console.error('[WEBHOOK] Redis error:', redisError.message);
          try { await client.quit(); } catch (e) { /* ignore */ }
        }
      } else {
        console.warn('[WEBHOOK] No Redis - messages not queued');
      }

      const processingTime = Date.now() - startTime;
      console.log(`[WEBHOOK] Queued ${queuedCount}/${messages.length} messages in ${processingTime}ms`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'ok',
          messagesReceived: messages.length,
          messagesQueued: queuedCount,
          processingTimeMs: processingTime
        })
      };

    } catch (error) {
      console.error('[WEBHOOK] Error processing webhook:', error.message);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'error', message: 'Internal processing error' })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
