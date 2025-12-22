/**
 * Message Processor
 * Orchestrates message handling: context loading, GPT generation, response sending
 */

const { GPTHandler } = require('./gpt-handler');
const { getSessionContext, setSessionContext, logMessageStats } = require('./redis-client');
const WhatsAppAdapter = require('./platform-adapters/whatsapp-adapter');
const MetaAdapter = require('./platform-adapters/meta-adapter');
const { v4: uuidv4 } = require('uuid');

// Initialize handlers
const gptHandler = new GPTHandler();
const adapters = {
  whatsapp: new WhatsAppAdapter(),
  meta: new MetaAdapter(),
  messenger: new MetaAdapter(), // Alias for meta
  instagram: new MetaAdapter()  // Alias for meta
};

/**
 * Process a queued message
 * @param {object} queueItem - Item from Redis queue
 */
async function processMessage(queueItem) {
  const { platform, message, receivedAt } = queueItem;

  // Calculate queue delay
  const queueDelay = Date.now() - receivedAt;
  console.log(`[PROCESSOR] Message queued for ${queueDelay}ms`);

  // Get platform adapter
  const adapter = adapters[platform];
  if (!adapter) {
    console.error(`[PROCESSOR] Unknown platform: ${platform}`);
    return;
  }

  const userId = message.from;
  const userText = message.text;

  console.log(`[PROCESSOR] Processing: "${userText.substring(0, 50)}${userText.length > 50 ? '...' : ''}"`);

  try {
    // Step 1: Load session context (conversation history)
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

    // Keep only last 6 messages (3 exchanges) for context
    if (session.conversationHistory.length > 6) {
      session.conversationHistory = session.conversationHistory.slice(-6);
    }

    // Step 3: Generate response with GPT
    const response = await gptHandler.generateResponse(userText, session.conversationHistory);

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

    // Step 6: Send response via platform adapter
    await adapter.sendMessage(userId, response, message);

    const totalTime = Date.now() - receivedAt;
    console.log(`[PROCESSOR] Response sent in ${totalTime}ms total`);

    // Step 7: Log stats for admin dashboard
    await logMessageStats({
      platform: platform,
      responseTime: totalTime,
      tokens: gptHandler.lastTokenCount || 0,
      logEntry: {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        platform: platform,
        userId: userId.slice(-4), // Anonymize - last 4 chars only
        userMessage: userText,
        botResponse: response,
        tokens: gptHandler.lastTokenCount || 0,
        responseTime: totalTime
      }
    });

  } catch (error) {
    console.error(`[PROCESSOR] Error processing message:`, error.message);

    // Try to send error response to user
    try {
      const errorResponse = 'Lo siento, ha ocurrido un error. Por favor, contacta con nosotros por WhatsApp: +34 689 560 130';
      await adapter.sendMessage(userId, errorResponse, message);
    } catch (sendError) {
      console.error(`[PROCESSOR] Failed to send error message:`, sendError.message);
    }

    throw error;
  }
}

module.exports = { processMessage };
