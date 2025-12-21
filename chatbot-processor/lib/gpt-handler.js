/**
 * GPT Handler
 * Integrates with OpenAI GPT-5 Nano for response generation
 * Implements RAG with knowledge base injection
 */

const OpenAI = require('openai');
const crypto = require('crypto');
const { KnowledgeBaseLoader } = require('./knowledge-loader');
const { incrementTokenCounter, getCachedResponse, setCachedResponse } = require('./redis-client');
const { SYSTEM_PROMPT_TEMPLATE, GPT_CONFIG } = require('../config/prompts');

class GPTHandler {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.kbLoader = new KnowledgeBaseLoader();

    if (!process.env.OPENAI_API_KEY) {
      console.warn('[GPT] OPENAI_API_KEY not configured - responses will fail');
    }
  }

  /**
   * Generate a response using GPT-5 Nano
   * @param {string} userMessage - User's message text
   * @param {Array} conversationHistory - Previous messages for context
   * @returns {Promise<string>} - Generated response
   */
  async generateResponse(userMessage, conversationHistory = []) {
    const startTime = Date.now();

    try {
      // Step 1: Check cache for common questions
      const questionHash = this.hashQuestion(userMessage);
      const cachedResponse = await getCachedResponse(questionHash);

      if (cachedResponse) {
        console.log('[GPT] Cache hit - returning cached response');
        return cachedResponse;
      }

      // Step 2: Load and extract relevant knowledge base sections
      const relevantKB = await this.kbLoader.getRelevantSections(userMessage);

      // Step 3: Build system prompt with KB injection
      const systemPrompt = this.buildSystemPrompt(relevantKB);

      // Step 4: Build messages array
      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history (last 3 exchanges = 6 messages)
      const recentHistory = conversationHistory.slice(-6);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }

      // Add current user message if not already in history
      if (!recentHistory.some(m => m.content === userMessage && m.role === 'user')) {
        messages.push({ role: 'user', content: userMessage });
      }

      // Step 5: Call OpenAI API
      console.log('[GPT] Calling GPT-5 Nano...');

      const completion = await this.openai.chat.completions.create({
        model: GPT_CONFIG.model,
        messages,
        max_tokens: GPT_CONFIG.max_tokens,
        temperature: GPT_CONFIG.temperature,
        top_p: GPT_CONFIG.top_p,
        frequency_penalty: GPT_CONFIG.frequency_penalty,
        presence_penalty: GPT_CONFIG.presence_penalty
      });

      const response = completion.choices[0]?.message?.content || '';
      const usage = completion.usage || {};

      // Step 6: Track token usage
      await incrementTokenCounter(usage.prompt_tokens || 0, usage.completion_tokens || 0);

      const processingTime = Date.now() - startTime;
      console.log(`[GPT] Response generated in ${processingTime}ms (${usage.total_tokens || 0} tokens)`);

      // Step 7: Cache response for common questions
      if (this.isCommonQuestion(userMessage)) {
        await setCachedResponse(questionHash, response);
        console.log('[GPT] Response cached for future use');
      }

      return response;

    } catch (error) {
      console.error('[GPT] Error generating response:', error.message);

      // Return fallback response
      return this.getFallbackResponse(userMessage);
    }
  }

  /**
   * Build system prompt with knowledge base injection
   * @param {string} knowledgeBase - Relevant KB sections
   * @returns {string} - Complete system prompt
   */
  buildSystemPrompt(knowledgeBase) {
    return SYSTEM_PROMPT_TEMPLATE.replace('{KNOWLEDGE_BASE}', knowledgeBase);
  }

  /**
   * Hash question for caching
   * @param {string} question - User question
   * @returns {string} - SHA256 hash
   */
  hashQuestion(question) {
    const normalized = question.toLowerCase().trim();
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if question is common (should be cached)
   * @param {string} question - User question
   * @returns {boolean}
   */
  isCommonQuestion(question) {
    const commonPatterns = [
      /precio/i,
      /cu[aá]nto cuesta/i,
      /horario/i,
      /d[oó]nde est[aá]/i,
      /direcci[oó]n/i,
      /c[oó]mo funciona/i,
      /efectos secundarios/i,
      /garant[ií]a/i,
      /recaida/i,
      /cancelar/i,
      /pago/i
    ];

    return commonPatterns.some(pattern => pattern.test(question));
  }

  /**
   * Get fallback response when GPT fails
   * @param {string} userMessage - Original user message
   * @returns {string}
   */
  getFallbackResponse(userMessage) {
    // Provide basic response based on keywords
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('precio') || lowerMessage.includes('cuanto')) {
      return 'El tratamiento individual para dejar de fumar cuesta 170€ si reservas online (190€ en centro). Para más información, contacta con nosotros por WhatsApp: +34 689 560 130';
    }

    if (lowerMessage.includes('centro') || lowerMessage.includes('donde')) {
      return 'Tenemos centros en Barcelona, Madrid (Atocha, Chamartín, Majadahonda, Torrejón) y Sevilla. Reserva en: https://laserostop-bf.netlify.app';
    }

    if (lowerMessage.includes('reservar') || lowerMessage.includes('cita')) {
      return 'Puedes reservar tu cita aquí: https://laserostop-bf.netlify.app o llamar al +34 689 560 130';
    }

    // Generic fallback
    return 'Gracias por tu mensaje. Para una respuesta más completa, contacta con nuestro equipo por WhatsApp: +34 689 560 130 o reserva tu cita en https://laserostop-bf.netlify.app';
  }
}

module.exports = { GPTHandler };
