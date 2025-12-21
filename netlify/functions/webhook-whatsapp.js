/**
 * WhatsApp Business API Webhook Handler
 * Receives incoming messages from WhatsApp and queues them for processing
 *
 * Webhook URL: https://[your-netlify-site]/webhook/whatsapp
 */

const { verifyWhatsAppSignature, isTimestampValid } = require('./shared/crypto-utils');
const { pushToQueue, isMessageProcessed, checkRateLimit } = require('./shared/redis-client');

// CORS headers for responses
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Extract message data from WhatsApp webhook payload
 * @param {object} body - Parsed webhook body
 * @returns {Array} - Array of message objects
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
          // Only process text messages for now
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
    console.error('[WEBHOOK-WHATSAPP] Error extracting messages:', error.message);
  }

  return messages;
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
    console.log('[WEBHOOK-WHATSAPP] Verification request received');

    const params = event.queryStringParameters || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[WEBHOOK-WHATSAPP] Verification successful');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: challenge
      };
    }

    console.error('[WEBHOOK-WHATSAPP] Verification failed - token mismatch');
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Verification failed' })
    };
  }

  // ========== MESSAGE HANDLING (POST) ==========
  if (event.httpMethod === 'POST') {
    console.log('[WEBHOOK-WHATSAPP] Incoming webhook');

    try {
      // Step 1: Verify signature
      const signature = event.headers['x-hub-signature-256'];
      const appSecret = process.env.WHATSAPP_APP_SECRET;

      if (!verifyWhatsAppSignature(event.body, signature, appSecret)) {
        console.error('[WEBHOOK-WHATSAPP] Invalid signature');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid signature' })
        };
      }

      console.log('[WEBHOOK-WHATSAPP] Signature verified');

      // Step 2: Parse body and extract messages
      const body = JSON.parse(event.body);
      const messages = extractMessages(body);

      if (messages.length === 0) {
        // No messages to process (might be status update, etc.)
        console.log('[WEBHOOK-WHATSAPP] No text messages in payload');
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', messages: 0 }) };
      }

      console.log(`[WEBHOOK-WHATSAPP] Extracted ${messages.length} message(s)`);

      // Step 3: Process each message
      let queuedCount = 0;

      for (const message of messages) {
        // Check timestamp validity (reject messages older than 5 minutes)
        if (!isTimestampValid(message.timestamp)) {
          console.log(`[WEBHOOK-WHATSAPP] Message ${message.id} too old - skipping`);
          continue;
        }

        // Check idempotency (skip if already processed)
        if (await isMessageProcessed(message.id)) {
          continue;
        }

        // Check rate limit
        if (!(await checkRateLimit(message.from, 'whatsapp'))) {
          console.log(`[WEBHOOK-WHATSAPP] Rate limit exceeded for ${message.from}`);
          continue;
        }

        // Queue message for processing
        const queued = await pushToQueue('whatsapp', message);
        if (queued) queuedCount++;
      }

      const processingTime = Date.now() - startTime;
      console.log(`[WEBHOOK-WHATSAPP] Queued ${queuedCount}/${messages.length} messages in ${processingTime}ms`);

      // Return 200 immediately (required by WhatsApp - must respond within 5 seconds)
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
      console.error('[WEBHOOK-WHATSAPP] Error processing webhook:', error.message);

      // Still return 200 to prevent WhatsApp from retrying
      // Log error for debugging but don't expose details
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'error', message: 'Internal processing error' })
      };
    }
  }

  // Unsupported method
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
