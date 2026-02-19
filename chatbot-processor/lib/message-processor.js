/**
 * Message Processor v2
 * With Manual Approval Support
 */

const { GPTHandler } = require('./gpt-handler');
const { getSessionContext, setSessionContext, logMessageStats, getRedisClient, isPlatformEnabled } = require('./redis-client');
const WhatsAppAdapter = require('./platform-adapters/whatsapp-adapter');
const MetaAdapter = require('./platform-adapters/meta-adapter');
const { v4: uuidv4 } = require('uuid');

// Initialize handlers
const gptHandler = new GPTHandler();
const adapters = {
  whatsapp: new WhatsAppAdapter(),
  meta: new MetaAdapter(),
  messenger: new MetaAdapter(),
  instagram: new MetaAdapter()
};

// Settings keys
const SETTINGS_KEY = 'chatbot:settings';
const PENDING_QUEUE = 'chatbot:pending:approval';

/**
 * Get chatbot settings from Redis
 */
async function getSettings() {
  try {
    const redis = await getRedisClient();
    if (!redis) return { manualApproval: false };
    const settings = await redis.get(SETTINGS_KEY);
    return settings ? JSON.parse(settings) : { manualApproval: false };
  } catch (e) {
    console.error('[SETTINGS] Error loading settings:', e.message);
    return { manualApproval: false };
  }
}

/**
 * Process a queued message
 */
async function processMessage(queueItem) {
  const { platform, message, receivedAt } = queueItem;
  // Check if platform is enabled
  const platformEnabled = await isPlatformEnabled(platform);
  if (!platformEnabled) {
    console.log(`[PROCESSOR] Platform '${platform}' is disabled - ignoring message`);
    return;
  }

  const queueDelay = Date.now() - receivedAt;
  console.log(`[PROCESSOR] Message queued for ${queueDelay}ms`);

  const adapter = adapters[platform];
  if (!adapter) {
    console.error(`[PROCESSOR] Unknown platform: ${platform}`);
    return;
  }

  const userId = message.from;
  const userText = message.text;
  const contactName = message.contactName || 'Unknown';

  console.log(`[PROCESSOR] Processing: "${userText.substring(0, 50)}${userText.length > 50 ? '...' : ''}"`);

  try {
    // Step 1: Load session context
    let session = await getSessionContext(platform, userId);
    if (!session) {
      session = {
        conversationHistory: [],
        startedAt: Date.now(),
        messageCount: 0
      };
    }

    // Step 2: Add user message to history
    session.conversationHistory.push({
      role: 'user',
      content: userText,
      timestamp: Date.now()
    });

    if (session.conversationHistory.length > 8) {
      session.conversationHistory = session.conversationHistory.slice(-8);
    }

    // Step 3: Generate response with GPT
    const response = await gptHandler.generateResponse(userText, session.conversationHistory, session, platform);

    // Step 4: Add assistant response to history
    session.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });

    session.messageCount++;
    session.lastMessageAt = Date.now();

    // Step 5: Save updated session
    await setSessionContext(platform, userId, session);

    // Step 6: Check if manual approval is enabled
    const settings = await getSettings();

    if (settings.manualApproval) {
      // Store for manual approval
      const pendingMessage = {
        id: uuidv4(),
        platform,
        userId,
        contactName,
        userMessage: userText,
        botResponse: response,
        originalMessage: message,
        createdAt: Date.now(),
        status: 'pending'
      };

      const redis = await getRedisClient();
      if (redis) {
        await redis.lpush(PENDING_QUEUE, JSON.stringify(pendingMessage));
        console.log(`[PROCESSOR] Response queued for approval: ${pendingMessage.id}`);
      }
    } else {
      // Send directly
      await adapter.sendMessage(userId, response, message);
      console.log(`[PROCESSOR] Response sent directly`);
    }

    const totalTime = Date.now() - receivedAt;
    console.log(`[PROCESSOR] Processed in ${totalTime}ms total`);

    // Log stats
    await logMessageStats({
      platform,
      responseTime: totalTime,
      tokens: gptHandler.lastTokenCount || 0,
      logEntry: {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        platform,
        userId: userId.slice(-4),
        userMessage: userText,
        botResponse: response,
        tokens: gptHandler.lastTokenCount || 0,
        responseTime: totalTime,
        manualApproval: settings.manualApproval
      }
    });

  } catch (error) {
    console.error(`[PROCESSOR] Error:`, error.message);

    // Check if we should send error message
    const settings = await getSettings();
    if (!settings.manualApproval) {
      try {
        const errorResponse = 'Lo siento, ha ocurrido un error. Por favor, contacta con nosotros por WhatsApp: +34 689 560 130';
        await adapter.sendMessage(userId, errorResponse, message);
      } catch (sendError) {
        console.error(`[PROCESSOR] Failed to send error message:`, sendError.message);
      }
    }

    throw error;
  }
}

module.exports = { processMessage, getSettings };
