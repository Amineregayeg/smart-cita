/**
 * WhatsApp Business API Adapter
 * Handles sending messages via WhatsApp Cloud API
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

/**
 * Strip markdown formatting from text for plain WhatsApp display
 * @param {string} text - Text potentially containing markdown
 * @returns {string} - Clean text without markdown symbols
 */
function stripMarkdown(text) {
  if (!text) return text;

  return text
    // Remove bold **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    // Remove italic *text* or _text_ (but not single _ in words)
    .replace(/\*([^*\n]+)\*/g, '$1')
    // Remove headers # ## ###
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bullet points - and * at start of lines, keep content
    .replace(/^[\s]*[-*]\s+/gm, '')
    // Remove numbered list formatting but keep numbers
    .replace(/^(\d+)\.\s+/gm, '$1. ')
    // Remove code blocks ```
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code `text`
    .replace(/`([^`]+)`/g, '$1')
    // Remove blockquotes >
    .replace(/^>\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

class WhatsAppAdapter {
  constructor() {
    this.apiVersion = 'v18.0';
    this.baseUrl = 'https://graph.facebook.com';
  }

  /**
   * Send a text message to WhatsApp user
   * @param {string} to - Recipient phone number (WhatsApp ID)
   * @param {string} text - Message text
   * @param {object} originalMessage - Original incoming message for context
   */
  async sendMessage(to, text, originalMessage = {}) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = originalMessage.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.error('[WHATSAPP] Missing access token or phone number ID');
      throw new Error('WhatsApp API not configured');
    }

    // Strip any markdown formatting from the text
    const cleanText = stripMarkdown(text);

    const url = `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        preview_url: true, // Enable link previews
        body: cleanText
      }
    };

    console.log(`[WHATSAPP] Sending message to ${to}`);

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
        console.error('[WHATSAPP] API error:', JSON.stringify(data));
        throw new Error(data.error?.message || 'WhatsApp API error');
      }

      console.log(`[WHATSAPP] Message sent successfully: ${data.messages?.[0]?.id}`);
      return data;

    } catch (error) {
      console.error('[WHATSAPP] Failed to send message:', error.message);
      throw error;
    }
  }

  /**
   * Send a message with quick reply buttons
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @param {Array} buttons - Array of button objects [{id, title}]
   */
  async sendButtonMessage(to, text, buttons) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp API not configured');
    }

    const url = `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`;

    // WhatsApp allows max 3 buttons
    const limitedButtons = buttons.slice(0, 3).map(btn => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.title.substring(0, 20) // Max 20 chars
      }
    }));

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: text
        },
        action: {
          buttons: limitedButtons
        }
      }
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
        console.error('[WHATSAPP] Button message error:', JSON.stringify(data));
        throw new Error(data.error?.message || 'WhatsApp API error');
      }

      return data;

    } catch (error) {
      console.error('[WHATSAPP] Failed to send button message:', error.message);
      throw error;
    }
  }

  /**
   * Mark message as read
   * @param {string} messageId - Message ID to mark as read
   */
  async markAsRead(messageId) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) return;

    const url = `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        })
      });
    } catch (error) {
      // Non-critical, just log
      console.warn('[WHATSAPP] Failed to mark as read:', error.message);
    }
  }
}

module.exports = WhatsAppAdapter;
