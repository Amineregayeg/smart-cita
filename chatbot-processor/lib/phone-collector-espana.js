/**
 * Phone Number Collector for España Chatbot
 * Detects Spanish phone numbers in messages and stores them in Redis
 */

const { getRedisClient } = require('./redis-client');
const { v4: uuidv4 } = require('uuid');

const PHONES_KEY = 'chatbot:phones';

// Spanish phone number patterns (9 digits, starting with 6 or 7 for mobile)
const PHONE_PATTERNS = [
  /\b([67]\d{8})\b/,
  /\b([67]\d{2}\s\d{3}\s\d{3})\b/,
  /\+?34\s?([67]\d{2}\s?\d{3}\s?\d{3})\b/,
  /\+?34\s?([67]\d{8})\b/
];

function detectPhoneNumber(text) {
  if (!text) return null;

  for (const pattern of PHONE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const digits = (match[1] || match[0]).replace(/\s+/g, '').replace(/^\+?34/, '');
      if (digits.length === 9 && /^[67]\d{8}$/.test(digits)) {
        return digits;
      }
    }
  }
  return null;
}

async function storePhoneLead(data) {
  const redis = await getRedisClient();
  if (!redis) return null;

  const lead = {
    id: uuidv4(),
    phone: data.phone,
    customerName: data.customerName || 'Unknown',
    customerId: data.customerId || '',
    platform: data.platform || 'messenger',
    context: data.context || '',
    userMessage: data.userMessage || '',
    timestamp: Date.now(),
    status: 'new'
  };

  await redis.lpush(PHONES_KEY, JSON.stringify(lead));
  console.log(`[PHONE-ES] Stored phone lead: ${lead.phone} from ${lead.customerName} (${lead.platform})`);
  return lead.id;
}

module.exports = { detectPhoneNumber, storePhoneLead, PHONES_KEY };
