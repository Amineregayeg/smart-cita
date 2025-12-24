/**
 * Meta (Facebook Messenger / Instagram) Webhook Handler
 * Receives incoming messages from Facebook and Instagram and queues them for processing
 *
 * Webhook URL: https://[your-netlify-site]/webhook/meta
 * Handles both Facebook Messenger and Instagram Direct Messages (unified inbox)
 */

const { verifyMetaSignature, isTimestampValid } = require('./shared/crypto-utils');
const { pushToQueue, isMessageProcessed, checkRateLimit, isPlatformEnabled } = require('./shared/redis-client');

// CORS headers for responses
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Extract message data from Meta webhook payload
 * Handles both Facebook Messenger and Instagram DM formats
 * @param {object} body - Parsed webhook body
 * @returns {Array} - Array of message objects
 */
function extractMessages(body) {
  const messages = [];

  try {
    const entries = body.entry || [];

    for (const entry of entries) {
      // Facebook Messenger format
      const messaging = entry.messaging || [];

      for (const event of messaging) {
        // Only process message events (not delivery, read receipts, etc.)
        if (!event.message || event.message.is_echo) continue;

        const message = event.message;
        const senderId = event.sender?.id;
        const recipientId = event.recipient?.id;

        // Only process text messages
        if (message.text) {
          messages.push({
            id: message.mid,
            from: senderId,
            to: recipientId,
            timestamp: event.timestamp,
            text: message.text,
            platform: 'messenger',
            pageId: entry.id
          });
        }
      }

      // Instagram format (changes array)
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value || {};
        const messageList = value.messages || [];

        for (const message of messageList) {
          if (message.type === 'text') {
            messages.push({
              id: message.id,
              from: message.from?.id || value.sender?.id,
              timestamp: parseInt(message.timestamp) || Date.now(),
              text: message.text?.body || message.text,
              platform: 'instagram',
              pageId: entry.id
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('[WEBHOOK-META] Error extracting messages:', error.message);
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
    console.log('[WEBHOOK-META] Verification request received');

    const params = event.queryStringParameters || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    const verifyToken = process.env.META_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[WEBHOOK-META] Verification successful');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: challenge
      };
    }

    console.error('[WEBHOOK-META] Verification failed - token mismatch');
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Verification failed' })
    };
  }

  // ========== MESSAGE HANDLING (POST) ==========
  if (event.httpMethod === 'POST') {
    console.log('[WEBHOOK-META] Incoming webhook');

    try {
      // Step 1: Verify signature
      const signature = event.headers['x-hub-signature-256'];
      const appSecret = process.env.META_APP_SECRET;

      if (!verifyMetaSignature(event.body, signature, appSecret)) {
        console.error('[WEBHOOK-META] Invalid signature');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid signature' })
        };
      }

      console.log('[WEBHOOK-META] Signature verified');

      // Step 2: Parse body and extract messages
      const body = JSON.parse(event.body);
      const messages = extractMessages(body);

      if (messages.length === 0) {
        // No messages to process (might be status update, delivery receipt, etc.)
        console.log('[WEBHOOK-META] No text messages in payload');
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', messages: 0 }) };
      }

      console.log(`[WEBHOOK-META] Extracted ${messages.length} message(s)`);

      // Step 3: Process each message
      let queuedCount = 0;
      let skippedDisabled = 0;

      for (const message of messages) {
        // Check if platform is enabled
        const platformEnabled = await isPlatformEnabled(message.platform);
        if (!platformEnabled) {
          console.log(`[WEBHOOK-META] Platform ${message.platform} disabled - skipping message`);
          skippedDisabled++;
          continue;
        }

        // Check timestamp validity (reject messages older than 5 minutes)
        // Convert to seconds if timestamp is in milliseconds
        const timestamp = message.timestamp > 9999999999
          ? Math.floor(message.timestamp / 1000)
          : message.timestamp;

        if (!isTimestampValid(timestamp)) {
          console.log(`[WEBHOOK-META] Message ${message.id} too old - skipping`);
          continue;
        }

        // Check idempotency (skip if already processed)
        if (await isMessageProcessed(message.id)) {
          continue;
        }

        // Check rate limit
        if (!(await checkRateLimit(message.from, message.platform))) {
          console.log(`[WEBHOOK-META] Rate limit exceeded for ${message.from}`);
          continue;
        }

        // Queue message for processing
        const queued = await pushToQueue('meta', message);
        if (queued) queuedCount++;
      }

      if (skippedDisabled > 0) {
        console.log(`[WEBHOOK-META] Skipped ${skippedDisabled} messages due to disabled platform`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`[WEBHOOK-META] Queued ${queuedCount}/${messages.length} messages in ${processingTime}ms`);

      // Return 200 immediately (required by Meta - must respond quickly)
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
      console.error('[WEBHOOK-META] Error processing webhook:', error.message);

      // Still return 200 to prevent Meta from retrying excessively
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
