/**
 * Cryptographic utilities for webhook signature verification
 * Used by WhatsApp and Meta webhook handlers
 */
const crypto = require('crypto');

/**
 * Verify WhatsApp webhook signature (SHA256 HMAC)
 * @param {string} payload - Raw request body
 * @param {string} signature - x-hub-signature-256 header value
 * @param {string} secret - WHATSAPP_APP_SECRET
 * @returns {boolean} - True if signature is valid
 */
function verifyWhatsAppSignature(payload, signature, secret) {
  if (!signature || !secret) {
    console.error('[CRYPTO] Missing signature or secret for WhatsApp verification');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('[CRYPTO] WhatsApp signature verification error:', error.message);
    return false;
  }
}

/**
 * Verify Meta (Facebook/Instagram) webhook signature (SHA256 HMAC)
 * @param {string} payload - Raw request body
 * @param {string} signature - x-hub-signature-256 header value
 * @param {string} secret - META_APP_SECRET
 * @returns {boolean} - True if signature is valid
 */
function verifyMetaSignature(payload, signature, secret) {
  if (!signature || !secret) {
    console.error('[CRYPTO] Missing signature or secret for Meta verification');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('[CRYPTO] Meta signature verification error:', error.message);
    return false;
  }
}

/**
 * Validate webhook timestamp to prevent replay attacks
 * @param {number} timestamp - Unix timestamp from webhook
 * @param {number} maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
 * @returns {boolean} - True if timestamp is within acceptable range
 */
function isTimestampValid(timestamp, maxAgeMs = 300000) {
  if (!timestamp) return false;

  const now = Date.now();
  const messageTime = timestamp * 1000; // Convert to milliseconds

  return Math.abs(now - messageTime) < maxAgeMs;
}

/**
 * Generate a hash for caching/idempotency purposes
 * @param {string} input - String to hash
 * @returns {string} - SHA256 hash
 */
function generateHash(input) {
  return crypto
    .createHash('sha256')
    .update(input)
    .digest('hex');
}

module.exports = {
  verifyWhatsAppSignature,
  verifyMetaSignature,
  isTimestampValid,
  generateHash
};
