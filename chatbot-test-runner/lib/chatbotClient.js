/**
 * Chatbot API Client
 * Handles admin authentication and chat message sending
 */

require('dotenv').config();
const crypto = require('crypto');

const ADMIN_API_URL = process.env.ADMIN_API_URL;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Session token cache
let sessionCache = {
  token: null,
  expiry: null
};

/**
 * Get admin session token
 */
async function getAdminToken() {
  // Check if cached session is still valid (with 1 hour buffer)
  if (sessionCache.token && sessionCache.expiry && Date.now() < sessionCache.expiry - 3600000) {
    return sessionCache.token;
  }

  const response = await fetch(`${ADMIN_API_URL}/api/admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      passwordHash: ADMIN_PASSWORD_HASH
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Admin auth failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  sessionCache = {
    token: data.token,
    expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };

  return sessionCache.token;
}

/**
 * Send a message to the chatbot
 */
async function sendMessage(message, conversationHistory = []) {
  const token = await getAdminToken();

  const response = await fetch(`${ADMIN_API_URL}/api/admin-test-chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      conversationHistory
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Chat request failed: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Have a multi-turn conversation
 */
async function conversation(messages) {
  const results = [];
  let conversationHistory = [];

  for (const userMessage of messages) {
    const response = await sendMessage(userMessage, conversationHistory);

    results.push({
      user: userMessage,
      assistant: response.response,
      tokens: response.tokens,
      responseTime: response.responseTime,
      bookingCreated: response.bookingCreated,
      appointmentId: response.appointmentId,
      debug: response.debug
    });

    // Update conversation history
    conversationHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: response.response }
    );
  }

  return {
    messages: results,
    lastResponse: results[results.length - 1]
  };
}

/**
 * Complete a full booking flow with test data
 */
async function completeBookingFlow(options) {
  const {
    center,
    treatment = 'tabaco',
    date,
    time,
    testData = true
  } = options;

  const timestamp = Date.now();
  const testEmail = testData ? `test-automated-${timestamp}@laserostop-test.com` : options.email;
  const testName = testData ? `Test Automatizado ${timestamp}` : options.name;
  const testPhone = testData ? `600000${String(timestamp).slice(-3)}` : options.phone;

  const messages = [
    `Quiero reservar una cita en ${center}`,
    treatment,
    date && time ? `El ${date} a las ${time}` : 'La primera disponible',
    testName,
    testEmail,
    testPhone,
    'Sí, confirmo'
  ];

  const result = await conversation(messages);

  return {
    ...result.lastResponse,
    conversationHistory: result.messages,
    testData: { email: testEmail, name: testName, phone: testPhone }
  };
}

/**
 * Extract slots from bot response text
 */
function extractSlotsFromResponse(responseText) {
  const slots = [];

  // Match patterns like "Lunes 6 enero: 10:00, 11:00, 12:00"
  const dayPattern = /(\w+)\s+(\d{1,2})\s+(?:de\s+)?(\w+)(?:\s+de\s+\d{4})?[:\s]+([0-9:,\s]+)/gi;

  let match;
  while ((match = dayPattern.exec(responseText)) !== null) {
    const times = match[4].match(/\d{1,2}:\d{2}/g) || [];
    if (times.length > 0) {
      slots.push({
        dayName: match[1],
        day: match[2],
        month: match[3],
        times: times
      });
    }
  }

  // Also match simple time patterns
  const simpleTimePattern = /(\d{1,2}:\d{2})/g;
  const allTimes = responseText.match(simpleTimePattern) || [];

  return {
    structured: slots,
    allTimes: allTimes
  };
}

/**
 * Check if response contains forbidden content
 */
function containsForbiddenContent(responseText, forbiddenList) {
  const lowerText = responseText.toLowerCase();
  for (const forbidden of forbiddenList) {
    if (lowerText.includes(forbidden.toLowerCase())) {
      return { found: true, content: forbidden };
    }
  }
  return { found: false };
}

/**
 * Check if response contains required phrases
 */
function containsRequiredPhrases(responseText, requiredList) {
  const lowerText = responseText.toLowerCase();
  const missing = [];

  for (const required of requiredList) {
    if (!lowerText.includes(required.toLowerCase())) {
      missing.push(required);
    }
  }

  return {
    allPresent: missing.length === 0,
    missing: missing
  };
}

module.exports = {
  getAdminToken,
  sendMessage,
  conversation,
  completeBookingFlow,
  extractSlotsFromResponse,
  containsForbiddenContent,
  containsRequiredPhrases
};
