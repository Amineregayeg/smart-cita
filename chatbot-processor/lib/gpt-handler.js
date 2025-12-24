/**
 * GPT Handler
 * Integrates with OpenAI GPT for response generation
 * Now with tool calling for availability checking and booking
 */

const OpenAI = require('openai');
const crypto = require('crypto');
const { KnowledgeBaseLoader } = require('./knowledge-loader');
const { SmartAgendaService } = require('./smart-agenda-service');
const { incrementTokenCounter, getCachedResponse, setCachedResponse } = require('./redis-client');
const { generateSystemPrompt, GPT_CONFIG } = require('../config/prompts');
const { CHATBOT_TOOLS, executeToolCall } = require('../config/tools');

class GPTHandler {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.kbLoader = new KnowledgeBaseLoader();
    this.smartAgenda = new SmartAgendaService();
    this.lastTokenCount = 0;

    if (!process.env.OPENAI_API_KEY) {
      console.warn('[GPT] OPENAI_API_KEY not configured - responses will fail');
    }
  }

  /**
   * Generate a response using GPT with tool calling
   * @param {string} userMessage - User's message text
   * @param {Array} conversationHistory - Previous messages for context
   * @param {object} session - Session context (optional)
   * @param {string} platform - Platform identifier for booking stats
   * @returns {Promise<string>} - Generated response
   */
  async generateResponse(userMessage, conversationHistory = [], session = {}, platform = 'unknown') {
    const startTime = Date.now();

    try {
      // Step 1: Check cache for common questions (only for non-booking queries)
      const isBookingIntent = this.isBookingIntent(userMessage);
      if (!isBookingIntent) {
        const questionHash = this.hashQuestion(userMessage);
        const cachedResponse = await getCachedResponse(questionHash);

        if (cachedResponse) {
          console.log('[GPT] Cache hit - returning cached response');
          return cachedResponse;
        }
      }

      // Step 2: Load relevant knowledge base sections
      const relevantKB = await this.kbLoader.getRelevantSections(userMessage);

      // Step 3: Build system prompt
      const systemPrompt = this.buildSystemPrompt(relevantKB);

      // Step 4: Build messages array
      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history (last 8 messages for booking context)
      const recentHistory = conversationHistory.slice(-8);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }

      // Add current user message if not in history
      if (!recentHistory.some(m => m.content === userMessage && m.role === 'user')) {
        messages.push({ role: 'user', content: userMessage });
      }

      // Step 5: Call OpenAI with tools
      console.log('[GPT] Calling OpenAI with tools...');

      const completion = await this.openai.chat.completions.create({
        model: GPT_CONFIG.model,
        messages,
        max_tokens: GPT_CONFIG.max_tokens,
        temperature: GPT_CONFIG.temperature,
        top_p: GPT_CONFIG.top_p,
        frequency_penalty: GPT_CONFIG.frequency_penalty,
        presence_penalty: GPT_CONFIG.presence_penalty,
        tools: CHATBOT_TOOLS,
        tool_choice: 'auto'
      });

      const responseMessage = completion.choices[0]?.message;
      let totalTokens = completion.usage?.total_tokens || 0;

      // Step 6: Handle tool calls if present
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        console.log(`[GPT] Tool calls requested: ${responseMessage.tool_calls.length}`);
        const { response, tokens } = await this.handleToolCalls(responseMessage, messages, platform);
        totalTokens += tokens;
        this.lastTokenCount = totalTokens;
        await incrementTokenCounter(totalTokens * 0.7, totalTokens * 0.3);
        return response;
      }

      // Step 7: Regular text response
      const response = responseMessage.content || '';
      this.lastTokenCount = totalTokens;

      // Track token usage
      await incrementTokenCounter(
        completion.usage?.prompt_tokens || 0,
        completion.usage?.completion_tokens || 0
      );

      const processingTime = Date.now() - startTime;
      console.log(`[GPT] Response generated in ${processingTime}ms (${totalTokens} tokens)`);

      // Cache response for non-booking common questions
      if (!isBookingIntent && this.isCommonQuestion(userMessage)) {
        const questionHash = this.hashQuestion(userMessage);
        await setCachedResponse(questionHash, response);
        console.log('[GPT] Response cached');
      }

      return response;

    } catch (error) {
      console.error('[GPT] Error generating response:', error.message);
      return this.getFallbackResponse(userMessage);
    }
  }

  /**
   * Handle tool calls from GPT
   * @param {object} responseMessage - GPT response with tool calls
   * @param {Array} messages - Conversation messages
   * @param {string} platform - Platform identifier for stats
   * @returns {Promise<object>} - { response, tokens }
   */
  async handleToolCalls(responseMessage, messages, platform = 'unknown') {
    const toolResults = [];
    let toolTokens = 0;

    // Execute each tool call
    for (const toolCall of responseMessage.tool_calls) {
      const functionName = toolCall.function.name;
      let args;

      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('[GPT] Failed to parse tool arguments:', e.message);
        args = {};
      }

      console.log(`[GPT] Executing tool: ${functionName}`, args);

      // Execute the tool (pass platform for booking stats)
      const result = await executeToolCall(functionName, args, this.smartAgenda, platform);

      console.log(`[GPT] Tool result:`, result.success ? 'Success' : result.error);

      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        content: JSON.stringify(result)
      });
    }

    // Send tool results back to GPT for final response
    const finalMessages = [
      ...messages,
      responseMessage,
      ...toolResults
    ];

    console.log('[GPT] Sending tool results back to GPT...');

    const finalCompletion = await this.openai.chat.completions.create({
      model: GPT_CONFIG.model,
      messages: finalMessages,
      max_tokens: GPT_CONFIG.max_tokens,
      temperature: GPT_CONFIG.temperature
    });

    toolTokens = finalCompletion.usage?.total_tokens || 0;
    const finalResponse = finalCompletion.choices[0]?.message?.content || '';

    return {
      response: finalResponse,
      tokens: toolTokens
    };
  }

  /**
   * Build system prompt with knowledge base and dynamic date injection
   */
  buildSystemPrompt(knowledgeBase) {
    // generateSystemPrompt handles date calculations dynamically
    return generateSystemPrompt().replace('{KNOWLEDGE_BASE}', knowledgeBase);
  }

  /**
   * Check if message has booking intent
   */
  isBookingIntent(message) {
    const bookingPatterns = [
      /reserv/i,
      /cita/i,
      /disponib/i,
      /horario/i,
      /hora/i,
      /cuando/i,
      /fecha/i,
      /agendar/i,
      /pedir/i
    ];
    return bookingPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Hash question for caching
   */
  hashQuestion(question) {
    const normalized = question.toLowerCase().trim();
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if question is common (should be cached)
   */
  isCommonQuestion(question) {
    const commonPatterns = [
      /^precio/i,
      /^cu[aá]nto cuesta/i,
      /^c[oó]mo funciona/i,
      /^qu[eé] es/i,
      /efectos secundarios/i,
      /garant[ií]a/i,
      /duraci[oó]n/i,
      /^d[oó]nde/i
    ];
    return commonPatterns.some(pattern => pattern.test(question));
  }

  /**
   * Get fallback response when GPT fails
   */
  getFallbackResponse(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('precio') || lowerMessage.includes('cuanto')) {
      return 'El tratamiento individual para dejar de fumar cuesta 190€ en centro. Para dúo (2 personas) son 360€ total. Cannabis: 250€. Azúcar: 200€. ¿Te ayudo a reservar?';
    }

    if (lowerMessage.includes('centro') || lowerMessage.includes('donde')) {
      return 'Tenemos centros en Barcelona Sants, Sevilla, y Madrid (Chamartín, Atocha, Majadahonda, Torrejón). ¿Cuál te viene mejor?';
    }

    if (lowerMessage.includes('reservar') || lowerMessage.includes('cita')) {
      return 'Para reservar, dime en qué centro te viene mejor y consultamos disponibilidad. También puedes reservar en: https://smart-cita.com/laserostop_bf/';
    }

    return 'Gracias por tu mensaje. Para más información, contacta por WhatsApp: +34 689 560 130 o reserva en https://smart-cita.com/laserostop_bf/';
  }
}

module.exports = { GPTHandler };
