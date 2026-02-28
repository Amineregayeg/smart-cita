/**
 * Message Processor - Tunisia
 * Processes Tunis page messages with phone number collection
 */

const { GPTHandlerTunis } = require('./gpt-handler-tunis');
const { getSessionContext, setSessionContext, getRedisClient, isPlatformEnabled } = require('./redis-client');
const MetaAdapter = require('./platform-adapters/meta-adapter');
const { AudioTranscriber } = require('./audio-transcriber');
const { detectPhoneNumber, storePhoneLead } = require('./phone-collector');
const { v4: uuidv4 } = require('uuid');

const gptHandler = new GPTHandlerTunis();
const adapter = new MetaAdapter();
const audioTranscriber = new AudioTranscriber();

const TUNIS_SETTINGS_KEY = 'chatbot:tunis:settings';
const TUNIS_PENDING_QUEUE = 'chatbot:tunis:pending:approval';

/**
 * Get Tunisia chatbot settings from Redis
 */
async function getTunisSettings() {
  try {
    const redis = await getRedisClient();
    if (!redis) return { manualApproval: true };
    const settings = await redis.get(TUNIS_SETTINGS_KEY);
    return settings ? JSON.parse(settings) : { manualApproval: true };
  } catch (e) {
    console.error('[TUNIS-SETTINGS] Error:', e.message);
    return { manualApproval: true };
  }
}

/**
 * Process a Tunisia message
 */
async function processMessageTunis(queueItem) {
  const { platform, message, receivedAt } = queueItem;

  // Check if platform is enabled
  const platformEnabled = await isPlatformEnabled(platform);
  if (!platformEnabled) {
    console.log(`[TUNIS] Platform '${platform}' disabled - ignoring`);
    return;
  }

  const queueDelay = Date.now() - receivedAt;
  console.log(`[TUNIS] Message queued for ${queueDelay}ms`);

  const userId = message.from;
  const contactName = message.contactName || 'Unknown';

  // Handle text, audio, and attachment messages
  let userText = message.text;
  let wasTranscribed = false;

  if (!userText && message.hasAudio && message.audioUrl) {
    try {
      console.log('[TUNIS] Voice message detected, transcribing...');
      userText = await audioTranscriber.transcribeFromUrl(message.audioUrl, message);
      wasTranscribed = true;
      console.log(`[TUNIS] Transcribed: "${userText.substring(0, 50)}..."`);
    } catch (transcribeErr) {
      console.error('[TUNIS] Transcription failed:', transcribeErr.message);
      userText = null;
    }
  }

  if (!userText && message.attachments && message.attachments.length > 0) {
    const attachmentType = message.attachments[0].type || 'unknown';
    const stickerId = message.attachments[0].stickerId;

    if (stickerId) {
      console.log(`[TUNIS] Sticker received from ${userId}, skipping`);
      return;
    }

    console.log(`[TUNIS] Attachment (${attachmentType}) without text from ${userId}`);

    const fallbackResponse = 'Je ne peux pas traiter ce type de message. Comment puis-je vous aider ? Envoyez-moi votre question par écrit.';
    const settings = await getTunisSettings();
    if (settings.manualApproval) {
      const pendingMessage = {
        id: uuidv4(),
        platform,
        userId,
        contactName,
        userMessage: `[${attachmentType === 'image' ? 'Image' : 'Fichier'} envoyé]`,
        botResponse: fallbackResponse,
        originalMessage: message,
        attachmentType,
        createdAt: Date.now(),
        status: 'pending',
        region: 'tunis'
      };
      const redis = await getRedisClient();
      if (redis) {
        await redis.lpush(TUNIS_PENDING_QUEUE, JSON.stringify(pendingMessage));
        console.log(`[TUNIS] Attachment fallback queued for approval: ${pendingMessage.id}`);
      }
    } else {
      await adapter.sendMessage(userId, fallbackResponse, message);
      console.log('[TUNIS] Attachment fallback sent directly');
    }
    return;
  }

  if (!userText) {
    console.log(`[TUNIS] No processable content from ${userId}, skipping`);
    return;
  }

  console.log(`[TUNIS] Processing: "${userText.substring(0, 50)}${userText.length > 50 ? '...' : ''}"`);

  try {
    // Step 1: Check for phone number in the message
    const detectedPhone = detectPhoneNumber(userText);
    if (detectedPhone) {
      console.log(`[TUNIS] Phone number detected: ${detectedPhone}`);
      await storePhoneLead({
        phone: detectedPhone,
        customerName: contactName,
        customerId: userId,
        platform,
        context: 'auto-detected from message',
        userMessage: userText
      });
    }

    // Step 2: Load session context
    let session = await getSessionContext('tunis_' + platform, userId);
    if (!session) {
      session = {
        conversationHistory: [],
        startedAt: Date.now(),
        messageCount: 0,
        phoneCollected: false
      };
    }

    // Mark if phone was collected
    if (detectedPhone) {
      session.phoneCollected = true;
    }

    // Step 3: Add user message to history
    session.conversationHistory.push({
      role: 'user',
      content: userText,
      timestamp: Date.now()
    });

    if (session.conversationHistory.length > 8) {
      session.conversationHistory = session.conversationHistory.slice(-8);
    }

    // Step 4: Generate response with GPT
    const response = await gptHandler.generateResponse(userText, session.conversationHistory);

    // Step 5: Add assistant response to history
    session.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });

    session.messageCount++;
    session.lastMessageAt = Date.now();

    // Step 6: Save session
    await setSessionContext('tunis_' + platform, userId, session);

    // Step 7: Check manual approval
    const settings = await getTunisSettings();

    if (settings.manualApproval) {
      const pendingMessage = {
        id: uuidv4(),
        platform,
        userId,
        contactName,
        userMessage: wasTranscribed ? `[🎤 Voice] ${userText}` : userText,
        botResponse: response,
        originalMessage: message,
        phoneDetected: detectedPhone || null,
        wasTranscribed,
        createdAt: Date.now(),
        status: 'pending',
        region: 'tunis'
      };

      const redis = await getRedisClient();
      if (redis) {
        await redis.lpush(TUNIS_PENDING_QUEUE, JSON.stringify(pendingMessage));
        console.log(`[TUNIS] Response queued for approval: ${pendingMessage.id}`);
      }
    } else {
      // Send as multiple messages split by |||
      const parts = response.split('|||').map(p => p.trim()).filter(p => p.length > 0);
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          // Small delay between messages to feel human
          await new Promise(r => setTimeout(r, 800 + Math.random() * 700));
        }
        await adapter.sendMessage(userId, parts[i], message);
      }
      console.log(`[TUNIS] Response sent directly (${parts.length} messages)`);

      // Also log to history so admin can see all sent messages
      const autoEntry = {
        id: uuidv4(),
        platform,
        userId,
        contactName,
        userMessage: wasTranscribed ? `[🎤 Voice] ${userText}` : userText,
        botResponse: response,
        phoneDetected: detectedPhone || null,
        wasTranscribed,
        createdAt: Date.now(),
        status: 'auto_sent',
        sentAt: Date.now(),
        region: 'tunis'
      };
      const redisH = await getRedisClient();
      if (redisH) {
        await redisH.lpush('chatbot:tunis:approval:history', JSON.stringify(autoEntry));
        await redisH.ltrim('chatbot:tunis:approval:history', 0, 199);
      }
    }

    const totalTime = Date.now() - receivedAt;
    console.log(`[TUNIS] Processed in ${totalTime}ms`);

    // Log stats
    const redis = await getRedisClient();
    if (redis) {
      const logEntry = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        platform,
        userId: userId.slice(-4),
        userMessage: userText,
        botResponse: response,
        tokens: gptHandler.lastTokenCount || 0,
        responseTime: totalTime,
        phoneDetected: detectedPhone || null,
        region: 'tunis'
      };
      await redis.lpush('chatbot:tunis:logs:recent', JSON.stringify(logEntry));
      await redis.ltrim('chatbot:tunis:logs:recent', 0, 199);
    }

  } catch (error) {
    console.error('[TUNIS] Error:', error.message);

    const settings = await getTunisSettings();
    if (!settings.manualApproval) {
      try {
        const errorResponse = 'Désolé, une erreur est survenue. Contactez-nous par WhatsApp : +216 51 321 500';
        await adapter.sendMessage(userId, errorResponse, message);
      } catch (sendError) {
        console.error('[TUNIS] Failed to send error message:', sendError.message);
      }
    }

    throw error;
  }
}

module.exports = { processMessageTunis, getTunisSettings };
