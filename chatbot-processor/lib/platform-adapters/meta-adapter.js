/**
 * Meta (Facebook Messenger / Instagram) API Adapter
 * Handles sending messages via Meta Graph API
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

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
    const accessToken = this.getAccessToken(platform);

    if (!accessToken) {
      console.error(`[META] Missing access token for ${platform}`);
      throw new Error('Meta API not configured');
    }

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

    console.log(`[META] Sending ${platform} message to ${to}`);

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
   * Get access token for platform
   * @param {string} platform - 'messenger' or 'instagram'
   * @returns {string|null}
   */
  getAccessToken(platform) {
    if (platform === 'instagram') {
      return process.env.META_INSTAGRAM_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN;
    }
    return process.env.META_PAGE_ACCESS_TOKEN;
  }
}

module.exports = MetaAdapter;
