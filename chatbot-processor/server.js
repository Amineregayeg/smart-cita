/**
 * LaserOstop Chatbot Processor - Background Worker
 * Polls Redis queue for incoming messages and processes them with GPT-5 Nano
 *
 * Deploy on Render.com as Web Service (with health endpoint for monitoring)
 */

require('dotenv').config();
const http = require('http');

const { getRedisClient } = require('./lib/redis-client');
const { processMessage } = require('./lib/message-processor');
const { processMessageTunis } = require('./lib/message-processor-tunis');

// HTTP Health Check Server (required for Render web service)
const PORT = process.env.PORT || 10000;
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      messagesProcessed,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

healthServer.listen(PORT, () => {
  console.log(`[HEALTH] Health check server running on port ${PORT}`);
});

// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 1000;
const QUEUE_NAME = 'chatbot:messages:queue';
const TUNIS_QUEUE_NAME = 'chatbot:tunis:messages:queue';

let isRunning = true;
let messagesProcessed = 0;
let startTime = Date.now();

/**
 * Main polling loop
 */
async function pollQueue() {
  const redis = await getRedisClient();

  if (!redis) {
    console.error('[WORKER] Failed to connect to Redis - exiting');
    process.exit(1);
  }

  console.log('[WORKER] LaserOstop Chatbot Processor started');
  console.log(`[WORKER] Polling queues: "${QUEUE_NAME}" + "${TUNIS_QUEUE_NAME}"`);

  while (isRunning) {
    try {
      // Use BRPOP on both queues (España + Tunisia)
      // Timeout after 5 seconds to allow graceful shutdown checks
      const result = await redis.brpop(QUEUE_NAME, TUNIS_QUEUE_NAME, 5);

      if (result) {
        const [queue, data] = result;
        const queueItem = JSON.parse(data);
        const isTunis = queue === TUNIS_QUEUE_NAME;
        const region = isTunis ? 'TUNIS' : 'ESPAÑA';

        console.log(`[WORKER] Processing ${region} ${queueItem.platform} message from ${queueItem.message?.from || 'unknown'}`);

        try {
          if (isTunis) {
            await processMessageTunis(queueItem);
          } else {
            await processMessage(queueItem);
          }
          messagesProcessed++;

          if (messagesProcessed % 10 === 0) {
            const uptime = Math.floor((Date.now() - startTime) / 1000);
            console.log(`[WORKER] Stats: ${messagesProcessed} messages processed in ${uptime}s`);
          }
        } catch (processError) {
          console.error(`[WORKER] Error processing ${region} message:`, processError.message);
        }
      }

      if (!result) {
        await sleep(POLL_INTERVAL_MS);
      }

    } catch (error) {
      console.error('[WORKER] Queue polling error:', error.message);
      await sleep(5000);
    }
  }

  console.log('[WORKER] Shutting down gracefully...');
  await redis.quit();
  process.exit(0);
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown handlers
 */
process.on('SIGTERM', () => {
  console.log('[WORKER] Received SIGTERM - initiating shutdown');
  isRunning = false;
});

process.on('SIGINT', () => {
  console.log('[WORKER] Received SIGINT - initiating shutdown');
  isRunning = false;
});

process.on('uncaughtException', (error) => {
  console.error('[WORKER] Uncaught exception:', error);
  isRunning = false;
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WORKER] Unhandled rejection at:', promise, 'reason:', reason);
});

// Start the worker
pollQueue().catch(error => {
  console.error('[WORKER] Fatal error:', error);
  process.exit(1);
});
