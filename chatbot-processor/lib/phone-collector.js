/**
 * Phone Number Collector for Tunisia Chatbot
 * Detects phone numbers in messages and stores them in Redis
 */

const { getRedisClient } = require('./redis-client');
const { v4: uuidv4 } = require('uuid');

const PHONES_KEY = 'chatbot:tunis:phones';

// Tunisian phone number patterns
const PHONE_PATTERNS = [
  /\b(\d{8})\b/,                        // 8 digits: 51321500
  /\b(\d{2}\s?\d{3}\s?\d{3})\b/,        // spaced: 51 321 500
  /\+?216\s?(\d{2}\s?\d{3}\s?\d{3})\b/, // with country code: +216 51 321 500
  /\+?216\s?(\d{8})\b/                   // with country code compact: +21651321500
];

/**
 * Detect a phone number in a message
 * @param {string} text - Message text
 * @returns {string|null} - Normalized phone number or null
 */
function detectPhoneNumber(text) {
  if (!text) return null;

  for (const pattern of PHONE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Normalize: remove spaces, keep only digits
      const digits = (match[1] || match[0]).replace(/\s+/g, '').replace(/^\+?216/, '');
      // Tunisian numbers are 8 digits
      if (digits.length === 8 && /^\d{8}$/.test(digits)) {
        return digits;
      }
    }
  }
  return null;
}

/**
 * Store a collected phone number in Redis
 * @param {object} data - Phone lead data
 * @returns {Promise<string>} - Lead ID
 */
async function storePhoneLead(data) {
  const redis = await getRedisClient();
  if (!redis) {
    console.error('[PHONE] Redis unavailable - cannot store phone lead');
    return null;
  }

  const lead = {
    id: uuidv4(),
    phone: data.phone,
    customerName: data.customerName || 'Unknown',
    customerId: data.customerId || '',
    platform: data.platform || 'messenger',
    context: data.context || '',
    userMessage: data.userMessage || '',
    timestamp: Date.now(),
    status: 'new' // new, called, no_answer, converted
  };

  await redis.lpush(PHONES_KEY, JSON.stringify(lead));
  console.log(`[PHONE] Stored phone lead: ${lead.phone} from ${lead.customerName} (${lead.platform})`);
  return lead.id;
}

/**
 * Get all phone leads
 * @returns {Promise<Array>}
 */
async function getPhoneLeads() {
  const redis = await getRedisClient();
  if (!redis) return [];
  const items = await redis.lrange(PHONES_KEY, 0, -1);
  return items.map(item => JSON.parse(item));
}

/**
 * Update phone lead status
 * @param {string} id - Lead ID
 * @param {string} status - New status
 * @returns {Promise<boolean>}
 */
async function updatePhoneLeadStatus(id, status) {
  const redis = await getRedisClient();
  if (!redis) return false;

  const items = await redis.lrange(PHONES_KEY, 0, -1);
  for (let i = 0; i < items.length; i++) {
    const lead = JSON.parse(items[i]);
    if (lead.id === id) {
      lead.status = status;
      lead.updatedAt = Date.now();
      // Remove old, push updated
      await redis.lset(PHONES_KEY, i, JSON.stringify(lead));
      console.log(`[PHONE] Updated lead ${id} status to: ${status}`);
      return true;
    }
  }
  return false;
}

module.exports = {
  detectPhoneNumber,
  storePhoneLead,
  getPhoneLeads,
  updatePhoneLeadStatus
};
