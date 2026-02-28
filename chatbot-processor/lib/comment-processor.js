/**
 * Comment Processor
 * Handles Facebook/Instagram comment auto-replies
 * Generates short responses directing users to DM with their phone number
 * Inspired by Tunisia Messenger phone collection system (phone-collector.js)
 */

const OpenAI = require('openai');
const { getRedisClient } = require('./redis-client');
const MetaAdapter = require('./platform-adapters/meta-adapter');
const { v4: uuidv4 } = require('uuid');
const {
  GPT_CONFIG_COMMENTS,
  SYSTEM_PROMPT_COMMENTS_ESPANA,
  SYSTEM_PROMPT_COMMENTS_TUNIS
} = require('../config/prompts-comments');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const adapter = new MetaAdapter();

// Settings keys (reuse same approval settings as DM chatbot)
const ESPANA_SETTINGS_KEY = 'chatbot:settings';
const TUNIS_SETTINGS_KEY = 'chatbot:tunis:settings';
const ESPANA_PENDING_COMMENTS = 'chatbot:pending:comments';
const TUNIS_PENDING_COMMENTS = 'chatbot:tunis:pending:comments';
const COMMENTS_HISTORY = 'chatbot:comments:history';

/**
 * Get settings for a region
 */
async function getSettings(region) {
  try {
    const redis = await getRedisClient();
    if (!redis) return { manualApproval: true };
    const key = region === 'tunis' ? TUNIS_SETTINGS_KEY : ESPANA_SETTINGS_KEY;
    const settings = await redis.get(key);
    return settings ? JSON.parse(settings) : { manualApproval: region === 'tunis' };
  } catch (e) {
    return { manualApproval: true };
  }
}

/**
 * Generate a comment reply using GPT-5 Nano
 */
async function generateCommentReply(commentText, commenterName, region) {
  try {
    const systemPrompt = region === 'tunis'
      ? SYSTEM_PROMPT_COMMENTS_TUNIS
      : SYSTEM_PROMPT_COMMENTS_ESPANA;

    const completion = await openai.chat.completions.create({
      model: GPT_CONFIG_COMMENTS.model,
      max_completion_tokens: GPT_CONFIG_COMMENTS.max_completion_tokens,
      reasoning_effort: GPT_CONFIG_COMMENTS.reasoning_effort,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Commentaire de ${commenterName}: "${commentText}"` }
      ]
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('[COMMENTS] GPT error:', error.message);
    return null;
  }
}

/**
 * Get fallback response when GPT fails
 */
function getFallbackReply(region) {
  if (region === 'tunis') {
    return 'Merci pour votre commentaire ! Envoyez-nous un message privé avec votre numéro de téléphone et un conseiller vous rappellera 😊';
  }
  return 'Gracias por tu comentario! Escríbenos por mensaje privado con tu número de teléfono y te llamamos 😊';
}

/**
 * Process a comment event
 */
async function processComment(queueItem) {
  const { comment, region, receivedAt } = queueItem;
  const {
    commentId,
    postId,
    pageId,
    commenterName,
    commenterUserId,
    commentText,
    verb
  } = comment;

  // Only reply to new comments (verb: "add")
  if (verb !== 'add') {
    console.log(`[COMMENTS] Skipping non-add verb: ${verb}`);
    return;
  }

  // Skip empty comments
  if (!commentText || commentText.trim().length === 0) {
    console.log('[COMMENTS] Skipping empty comment');
    return;
  }

  // Skip comments from the page itself (our own replies)
  if (commenterUserId === pageId) {
    console.log('[COMMENTS] Skipping own page comment');
    return;
  }

  const pageName = MetaAdapter.getPageName(pageId) || 'Unknown';
  console.log(`[COMMENTS] Processing comment from ${commenterName} on ${pageName}: "${commentText.substring(0, 80)}"`);

  // Check if already processed (dedup)
  const redis = await getRedisClient();
  if (redis) {
    const dedupKey = `chatbot:comment:processed:${commentId}`;
    const exists = await redis.get(dedupKey);
    if (exists) {
      console.log('[COMMENTS] Comment already processed');
      return;
    }
    await redis.setex(dedupKey, 86400, '1');
  }

  // Generate reply
  let reply = await generateCommentReply(commentText, commenterName, region);
  if (!reply) {
    reply = getFallbackReply(region);
  }

  console.log(`[COMMENTS] Generated reply: "${reply.substring(0, 80)}"`);

  // Check manual approval setting
  const settings = await getSettings(region);

  if (settings.manualApproval) {
    // Queue for admin approval
    const pendingComment = {
      id: uuidv4(),
      type: 'comment_reply',
      region,
      pageId,
      pageName,
      postId,
      commentId,
      commenterName,
      commenterUserId,
      commentText,
      botResponse: reply,
      createdAt: Date.now(),
      status: 'pending'
    };

    if (redis) {
      const pendingQueue = region === 'tunis' ? TUNIS_PENDING_COMMENTS : ESPANA_PENDING_COMMENTS;
      await redis.lpush(pendingQueue, JSON.stringify(pendingComment));
      console.log(`[COMMENTS] Reply queued for ${region.toUpperCase()} approval: ${pendingComment.id}`);
    }
  } else {
    // Send directly
    try {
      await adapter.replyToComment(commentId, reply, pageId);
      console.log(`[COMMENTS] Reply sent directly to comment ${commentId}`);

      // Log to history
      if (redis) {
        const historyEntry = {
          id: uuidv4(),
          type: 'comment_reply',
          region,
          pageId,
          pageName,
          postId,
          commentId,
          commenterName,
          commentText,
          botResponse: reply,
          createdAt: Date.now(),
          sentAt: Date.now(),
          status: 'auto_sent'
        };
        await redis.lpush(COMMENTS_HISTORY, JSON.stringify(historyEntry));
        await redis.ltrim(COMMENTS_HISTORY, 0, 499);
      }
    } catch (sendErr) {
      console.error(`[COMMENTS] Failed to reply: ${sendErr.message}`);
    }
  }

  const totalTime = Date.now() - receivedAt;
  console.log(`[COMMENTS] Processed in ${totalTime}ms`);
}

module.exports = { processComment };
