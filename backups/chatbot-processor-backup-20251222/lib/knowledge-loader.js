/**
 * Knowledge Base Loader
 * Loads and manages the chatbot knowledge base for RAG
 */

const fs = require('fs');
const path = require('path');

class KnowledgeBaseLoader {
  constructor() {
    this.knowledgeBase = null;
    this.sections = null;
    this.lastLoaded = null;
    this.cacheDuration = 3600000; // 1 hour cache
  }

  /**
   * Load knowledge base from file
   * @returns {Promise<string>} - Full knowledge base content
   */
  async load() {
    // Return cached if still valid
    if (this.knowledgeBase && this.lastLoaded && (Date.now() - this.lastLoaded < this.cacheDuration)) {
      return this.knowledgeBase;
    }

    try {
      const kbPath = path.join(__dirname, '../data/CHATBOT_KNOWLEDGE_BASE.md');
      this.knowledgeBase = fs.readFileSync(kbPath, 'utf-8');
      this.sections = this.parseSections(this.knowledgeBase);
      this.lastLoaded = Date.now();

      console.log(`[KB] Loaded knowledge base (${this.sections.length} sections)`);
      return this.knowledgeBase;
    } catch (error) {
      console.error('[KB] Failed to load knowledge base:', error.message);
      return this.getDefaultKB();
    }
  }

  /**
   * Parse knowledge base into sections
   * @param {string} content - Full KB content
   * @returns {Array} - Array of section objects
   */
  parseSections(content) {
    const sections = [];
    const parts = content.split('---');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Extract section title
      const titleMatch = trimmed.match(/^##\s*\d*\.?\s*(.+)/m);
      const title = titleMatch ? titleMatch[1].toUpperCase() : 'GENERAL';

      sections.push({
        title,
        content: trimmed,
        keywords: this.extractKeywords(trimmed)
      });
    }

    return sections;
  }

  /**
   * Extract keywords from section content
   * @param {string} content - Section content
   * @returns {Array} - Array of keywords
   */
  extractKeywords(content) {
    const keywords = [];
    const lowerContent = content.toLowerCase();

    // Map keywords to topics
    const keywordMap = {
      precios: ['precio', 'euro', '€', 'coste', 'pago', 'cuota'],
      centros: ['centro', 'dirección', 'ubicación', 'barcelona', 'madrid', 'sevilla', 'atocha', 'chamartín'],
      tratamiento: ['tratamiento', 'sesión', 'láser', 'funciona', 'proceso'],
      garantia: ['garantía', 'recaída', 'gratis', 'año'],
      contacto: ['teléfono', 'whatsapp', 'email', 'contacto'],
      faq: ['pregunta', 'dolor', 'efectos', 'secundarios', 'cancelar'],
      servicios: ['tabaco', 'fumar', 'cannabis', 'azúcar', 'dúo', 'individual']
    };

    for (const [topic, words] of Object.entries(keywordMap)) {
      if (words.some(word => lowerContent.includes(word))) {
        keywords.push(topic);
      }
    }

    return keywords;
  }

  /**
   * Get relevant sections based on user query
   * @param {string} query - User query
   * @returns {Promise<string>} - Relevant KB sections (optimized for tokens)
   */
  async getRelevantSections(query) {
    await this.load();

    if (!this.sections || this.sections.length === 0) {
      return this.getDefaultKB();
    }

    const lowerQuery = query.toLowerCase();
    const relevantSections = [];

    // Scoring based on keyword matches
    const sectionScores = this.sections.map(section => {
      let score = 0;

      // Check for keyword matches in query
      for (const keyword of section.keywords) {
        if (lowerQuery.includes(keyword)) {
          score += 2;
        }
      }

      // Check for direct content matches
      const queryWords = lowerQuery.split(/\s+/);
      for (const word of queryWords) {
        if (word.length > 3 && section.content.toLowerCase().includes(word)) {
          score += 1;
        }
      }

      return { section, score };
    });

    // Sort by score and take top 2-3 sections
    sectionScores.sort((a, b) => b.score - a.score);

    const topSections = sectionScores
      .filter(s => s.score > 0)
      .slice(0, 3)
      .map(s => s.section.content);

    // If no relevant sections found, return essential info
    if (topSections.length === 0) {
      return this.getEssentialInfo();
    }

    // Combine sections (limit to ~500 tokens)
    let combined = topSections.join('\n\n');
    if (combined.length > 2000) {
      combined = combined.substring(0, 2000) + '...';
    }

    return combined;
  }

  /**
   * Get essential business info (fallback)
   * @returns {string}
   */
  getEssentialInfo() {
    return `
## INFORMACIÓN ESENCIAL

**LaserOstop España** - Tratamiento láser para dejar de fumar

**Servicios:**
- Individual (Tabaco): 190€ centro / 170€ online
- Dúo (2 personas): 360€ centro / 340€ online
- Cannabis: 250€ centro / 230€ online
- Azúcar: 200€ centro / 180€ online
- Recaída: GRATIS durante 1 año

**Centros:**
- Barcelona Sants: +34 689 560 130
- Madrid Atocha: +34 613 255 948
- Madrid Chamartín: +34 919 305 313
- Majadahonda: +34 919 305 313
- Torrejón: +34 919 305 313
- Sevilla: +34 689 560 130

**Reservas:** https://laserostop-bf.netlify.app
**WhatsApp:** +34 689 560 130
    `.trim();
  }

  /**
   * Get default KB when file not available
   * @returns {string}
   */
  getDefaultKB() {
    return this.getEssentialInfo();
  }
}

module.exports = { KnowledgeBaseLoader };
