/**
 * Meta (Facebook Messenger / Instagram) API Adapter
 * Handles sending messages via Meta Graph API
 * Supports multi-page token routing for España centers
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Page token mapping for España centers
const PAGE_TOKENS = {};
const PAGE_NAMES = {
  '961642687025824': 'LaserOstop - Centros antitabaco',
  '755909964271820': 'LaserOstop Valencia',
  '753892517805817': 'LaserOstop Sevilla',
  '692019233999955': 'LaserOstop Barcelona Sants'
};

function loadPageTokens() {
  // Load page-specific tokens from env
  const tokenEnvs = [
    { id: '961642687025824', env: 'META_PAGE_TOKEN_ESPANA' },
    { id: '755909964271820', env: 'META_PAGE_TOKEN_VALENCIA' },
    { id: '753892517805817', env: 'META_PAGE_TOKEN_SEVILLA' },
    { id: '692019233999955', env: 'META_PAGE_TOKEN_BARCELONA' }
  ];

  for (const { id, env } of tokenEnvs) {
    if (process.env[env]) {
      PAGE_TOKENS[id] = process.env[env];
    }
  }

  // Fallback: legacy single token
  if (process.env.META_PAGE_ACCESS_TOKEN) {
    PAGE_TOKENS._default = process.env.META_PAGE_ACCESS_TOKEN;
  }

  const loaded = Object.keys(PAGE_TOKENS).filter(k => k !== '_default').length;
  console.log(`[META] Loaded ${loaded} page tokens + ${PAGE_TOKENS._default ? '1 default' : 'no default'}`);
}

// Load on module init
loadPageTokens();

class MetaAdapter {
  constructor() {
    this.apiVersion = 'v18.0';
    this.baseUrl = 'https://graph.facebook.com';
  }

  /**
   * Send a text message to Facebook/Instagram user
   * @param {string} to - Recipient PSID (Page-Scoped User ID)
   * @param {string} text - Message text
   * @param {object} originalMessage - Original incoming message for context
   */
  async sendMessage(to, text, originalMessage = {}) {
    const platform = originalMessage.platform || 'messenger';
    const pageId = originalMessage.pageId;
    const accessToken = this.getAccessToken(platform, pageId);

    if (!accessToken) {
      console.error(`[META] Missing access token for ${platform} pageId=${pageId}`);
      throw new Error('Meta API not configured');
    }

    const pageName = PAGE_NAMES[pageId] || 'Unknown Page';
    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    const payload = {
      recipient: {
        id: to
      },
      message: {
        text: text
      },
      messaging_type: 'RESPONSE' // Responding to user message
    };

    console.log(`[META] Sending ${platform} message to ${to} via page ${pageName} (${pageId || 'default'})`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[META] API error:', JSON.stringify(data));
        throw new Error(data.error?.message || 'Meta API error');
      }

      console.log(`[META] Message sent successfully: ${data.message_id}`);
      return data;

    } catch (error) {
      console.error('[META] Failed to send message:', error.message);
      throw error;
    }
  }

  /**
   * Send a message with quick reply buttons
   * @param {string} to - Recipient PSID
   * @param {string} text - Message text
   * @param {Array} quickReplies - Array of quick reply objects [{title, payload}]
   * @param {string} platform - 'messenger' or 'instagram'
   */
  async sendQuickReplies(to, text, quickReplies, platform = 'messenger') {
    const accessToken = this.getAccessToken(platform);

    if (!accessToken) {
      throw new Error('Meta API not configured');
    }

    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    // Meta allows max 13 quick replies
    const limitedReplies = quickReplies.slice(0, 13).map(qr => ({
      content_type: 'text',
      title: qr.title.substring(0, 20), // Max 20 chars
      payload: qr.payload || qr.title
    }));

    const payload = {
      recipient: {
        id: to
      },
      message: {
        text: text,
        quick_replies: limitedReplies
      },
      messaging_type: 'RESPONSE'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[META] Quick reply error:', JSON.stringify(data));
        throw new Error(data.error?.message || 'Meta API error');
      }

      return data;

    } catch (error) {
      console.error('[META] Failed to send quick replies:', error.message);
      throw error;
    }
  }

  /**
   * Send a message with button template
   * @param {string} to - Recipient PSID
   * @param {string} text - Message text
   * @param {Array} buttons - Array of button objects
   * @param {string} platform - 'messenger' or 'instagram'
   */
  async sendButtonTemplate(to, text, buttons, platform = 'messenger') {
    const accessToken = this.getAccessToken(platform);

    if (!accessToken) {
      throw new Error('Meta API not configured');
    }

    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    // Max 3 buttons for button template
    const limitedButtons = buttons.slice(0, 3).map(btn => {
      if (btn.url) {
        return {
          type: 'web_url',
          url: btn.url,
          title: btn.title.substring(0, 20)
        };
      }
      return {
        type: 'postback',
        title: btn.title.substring(0, 20),
        payload: btn.payload || btn.title
      };
    });

    const payload = {
      recipient: {
        id: to
      },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: text.substring(0, 640), // Max 640 chars
            buttons: limitedButtons
          }
        }
      },
      messaging_type: 'RESPONSE'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[META] Button template error:', JSON.stringify(data));
        throw new Error(data.error?.message || 'Meta API error');
      }

      return data;

    } catch (error) {
      console.error('[META] Failed to send button template:', error.message);
      throw error;
    }
  }

  /**
   * Send typing indicator
   * @param {string} to - Recipient PSID
   * @param {boolean} on - Turn typing on/off
   * @param {string} platform - 'messenger' or 'instagram'
   */
  async sendTypingIndicator(to, on = true, platform = 'messenger') {
    const accessToken = this.getAccessToken(platform);

    if (!accessToken) return;

    const url = `${this.baseUrl}/${this.apiVersion}/me/messages`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient: { id: to },
          sender_action: on ? 'typing_on' : 'typing_off'
        })
      });
    } catch (error) {
      // Non-critical
      console.warn('[META] Typing indicator failed:', error.message);
    }
  }

  /**
   * Get access token for platform and page
   * @param {string} platform - 'messenger' or 'instagram'
   * @param {string} pageId - Facebook Page ID
   * @returns {string|null}
   */
  getAccessToken(platform, pageId) {
    if (platform === 'instagram') {
      return process.env.META_INSTAGRAM_ACCESS_TOKEN || PAGE_TOKENS._default;
    }
    // Use page-specific token if available
    if (pageId && PAGE_TOKENS[pageId]) {
      return PAGE_TOKENS[pageId];
    }
    return PAGE_TOKENS._default;
  }

  /**
   * Get page name from ID
   */
  static getPageName(pageId) {
    return PAGE_NAMES[pageId] || 'Unknown Page';
  }

  /**
   * Reload page tokens (e.g., after .env update)
   */
  static reloadTokens() {
    loadPageTokens();
  }
}

module.exports = MetaAdapter;
