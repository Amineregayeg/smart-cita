/**
 * GPT Handler - Tunisia
 * Simplified handler for LaserOstop Tunisie chatbot
 * No tool calling - just knowledge-based Q&A + phone number detection
 */

const OpenAI = require('openai');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { incrementTokenCounter, getCachedResponse, setCachedResponse } = require('./redis-client');
const { GPT_CONFIG_TUNIS, SYSTEM_PROMPT_TUNIS } = require('../config/prompts-tunis');
const { detectPhoneNumber } = require('./phone-collector');

class GPTHandlerTunis {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.knowledgeBase = null;
    this.kbLastLoaded = null;
    this.lastTokenCount = 0;

    if (!process.env.OPENAI_API_KEY) {
      console.warn('[GPT-TUNIS] OPENAI_API_KEY not configured');
    }
  }

  /**
   * Load Tunisia knowledge base
   */
  loadKnowledgeBase() {
    if (this.knowledgeBase && this.kbLastLoaded && (Date.now() - this.kbLastLoaded < 3600000)) {
      return this.knowledgeBase;
    }

    try {
      const kbPath = path.join(__dirname, '../data/CHATBOT_KNOWLEDGE_BASE_TUNIS.md');
      this.knowledgeBase = fs.readFileSync(kbPath, 'utf-8');
      this.kbLastLoaded = Date.now();
      console.log('[GPT-TUNIS] Knowledge base loaded');
      return this.knowledgeBase;
    } catch (error) {
      console.error('[GPT-TUNIS] Failed to load KB:', error.message);
      return this.getEssentialInfo();
    }
  }

  /**
   * Generate a response using GPT
   * @param {string} userMessage - User's message text
   * @param {Array} conversationHistory - Previous messages for context
   * @returns {Promise<string>} - Generated response
   */
  async generateResponse(userMessage, conversationHistory = []) {
    const startTime = Date.now();

    try {
      // Check cache
      const questionHash = this.hashQuestion(userMessage);
      const phoneDetected = detectPhoneNumber(userMessage);

      // Don't use cache if phone number is detected (need specific confirmation)
      if (!phoneDetected) {
        const cachedResponse = await getCachedResponse('tunis:' + questionHash);
        if (cachedResponse) {
          console.log('[GPT-TUNIS] Cache hit');
          return cachedResponse;
        }
      }

      // Load knowledge base
      const kb = this.loadKnowledgeBase();

      // Build system prompt
      const systemPrompt = SYSTEM_PROMPT_TUNIS.replace('{KNOWLEDGE_BASE}', kb);

      // Build messages
      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history (last 8 messages)
      const recentHistory = conversationHistory.slice(-8);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }

      // Add current message if not in history
      if (!recentHistory.some(m => m.content === userMessage && m.role === 'user')) {
        // If phone number detected, add context hint
        if (phoneDetected) {
          messages.push({
            role: 'user',
            content: userMessage + '\n[SYSTÈME: Un numéro de téléphone a été détecté dans ce message. Confirme la réception du numéro.]'
          });
        } else {
          messages.push({ role: 'user', content: userMessage });
        }
      }

      // Call OpenAI (no tools)
      console.log('[GPT-TUNIS] Calling OpenAI...');

      const completion = await this.openai.chat.completions.create({
        model: GPT_CONFIG_TUNIS.model,
        messages,
        max_completion_tokens: GPT_CONFIG_TUNIS.max_completion_tokens,
        reasoning_effort: GPT_CONFIG_TUNIS.reasoning_effort
      });

      const response = completion.choices[0]?.message?.content || '';
      const totalTokens = completion.usage?.total_tokens || 0;
      this.lastTokenCount = totalTokens;

      // Track tokens
      await incrementTokenCounter(
        completion.usage?.prompt_tokens || 0,
        completion.usage?.completion_tokens || 0
      );

      const processingTime = Date.now() - startTime;
      console.log(`[GPT-TUNIS] Response in ${processingTime}ms (${totalTokens} tokens)`);

      // Cache common questions (not phone-related)
      if (!phoneDetected && this.isCommonQuestion(userMessage)) {
        await setCachedResponse('tunis:' + questionHash, response);
      }

      return response;

    } catch (error) {
      console.error('[GPT-TUNIS] Error:', error.message);
      return this.getFallbackResponse(userMessage);
    }
  }

  /**
   * Hash question for caching
   */
  hashQuestion(question) {
    const normalized = question.toLowerCase().trim();
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Check if question is common (cacheable)
   */
  isCommonQuestion(question) {
    const lower = question.toLowerCase();
    const commonPatterns = [
      /^prix$/i,
      /^adresse$/i,
      /combien/i,
      /^bonjour$/i,
      /comment.*fonctionne/i,
      /^tarif/i,
      /بشحال/,
      /قداش/,
      /وين/,
      /سعر/,
      /عنوان/
    ];
    return commonPatterns.some(p => p.test(question));
  }

  /**
   * Fallback response when GPT fails
   */
  getFallbackResponse(userMessage) {
    const lower = userMessage.toLowerCase();

    if (lower.includes('prix') || lower.includes('tarif') || lower.includes('combien') || /سعر|بشحال|قداش/.test(userMessage)) {
      return 'Le traitement tabac coûte 500 DT pour une séance de 55 minutes.\n|||\nPour les drogues, c\'est 1000 DT au total pour 3 séances (500 DT la première, puis 250 DT les deux suivantes).\n|||\nEn cas de rechute, une séance gratuite pendant une période de 12 mois.\n|||\nSouhaitez-vous être rappelé(e) ? Laissez-nous votre numéro de téléphone 📱';
    }

    if (lower.includes('adresse') || lower.includes('où') || /وين|فين|عنوان/.test(userMessage)) {
      return 'Notre centre Tunis est au Lac 1, Immeuble Ben Cheikh, 1er étage, cabinet N°3. Du Mardi au Samedi de 10h00 à 18h00 (et un lundi sur deux).\n|||\nNous avons aussi un centre à Sfax, Route de Tunis, Centre Al Istachfa, près de Dar Attabib.\n|||\nATTENTION ! Ne vous trompez pas de centre, nous sommes au LAC 1. WhatsApp : +216 51 321 500 📱';
    }

    if (lower.includes('rendez') || lower.includes('rdv') || /موعد/.test(userMessage)) {
      return 'Pour prendre rendez-vous, contactez-nous par WhatsApp au +216 51 321 500.\n|||\nOu laissez-nous votre numéro de téléphone et nous vous rappellerons 📱';
    }

    return 'Merci pour votre message.\n|||\nPour plus d\'informations, contactez-nous par WhatsApp : +216 51 321 500 📱';
  }

  /**
   * Essential info fallback
   */
  getEssentialInfo() {
    return `
## INFORMATIONS ESSENTIELLES

LaserOstop Tunisie - Traitement laser pour arrêter de fumer

Tarifs:
- Tabac: 500 DT (1 séance de 55 min)
- Drogues: 1000 DT (3 séances: 500 + 250 + 250)
- Rechute: Une séance gratuite pendant une période de 12 mois

Centres:
- Tunis Lac 1: Immeuble Ben Cheikh, 1er étage, cabinet N°3
- Sfax: Route de Tunis, Centre Al Istachfa, près de Dar Attabib
- Horaires: Du Mardi au Samedi de 10h00 à 18h00

WhatsApp: +216 51 321 500
    `.trim();
  }
}

module.exports = { GPTHandlerTunis };
