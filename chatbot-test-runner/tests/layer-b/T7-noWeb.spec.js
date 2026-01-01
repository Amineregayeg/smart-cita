/**
 * T7: No Website Messaging Tests
 * Verifies chatbot never mentions external websites
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');

/**
 * T7.1: No website in availability response
 */
const testNoWebAvailability = defineTest(
  'T7.1-NO-WEB-AVAILABILITY',
  'No website mentioned when showing availability',
  'no-web',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'Quiero reservar una cita en Madrid'
    ]);

    const response = result.lastResponse.assistant;

    return assert.noForbiddenContent(
      response,
      policy.noWeb.forbiddenPatterns,
      'Should not mention websites in availability response'
    );
  }
);

/**
 * T7.2: No website in booking confirmation
 */
const testNoWebBookingConfirmation = defineTest(
  'T7.2-NO-WEB-CONFIRMATION',
  'No website in booking confirmation',
  'no-web',
  async ({ policy }) => {
    const result = await chatbot.completeBookingFlow({
      center: 'chamartin',
      treatment: 'tabaco',
      testData: true
    });

    const response = result.assistant || '';

    // Clean up booking first
    if (result.appointmentId) {
      const testDataManager = require('../../lib/testDataManager');
      await testDataManager.deleteTestBooking(result.appointmentId);
    }

    return assert.noForbiddenContent(
      response,
      policy.noWeb.forbiddenPatterns,
      'Should not mention websites in confirmation'
    );
  }
);

/**
 * T7.3: No website when asked about more info
 */
const testNoWebMoreInfo = defineTest(
  'T7.3-NO-WEB-MORE-INFO',
  'No website when user asks for more info',
  'no-web',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'Dónde puedo encontrar más información sobre el tratamiento?'
    ]);

    const response = result.lastResponse.assistant;

    return assert.noForbiddenContent(
      response,
      policy.noWeb.forbiddenPatterns,
      'Should not suggest visiting websites'
    );
  }
);

/**
 * T7.4: No website when asked about prices
 */
const testNoWebPrices = defineTest(
  'T7.4-NO-WEB-PRICES',
  'No website when discussing prices',
  'no-web',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'Cuánto cuesta el tratamiento para dejar de fumar?'
    ]);

    const response = result.lastResponse.assistant;

    return assert.noForbiddenContent(
      response,
      policy.noWeb.forbiddenPatterns,
      'Should not mention websites for pricing info'
    );
  }
);

/**
 * T7.5: No website when user mentions having seen website
 */
const testNoWebAfterMention = defineTest(
  'T7.5-NO-WEB-AFTER-MENTION',
  'No website even when user mentions it',
  'no-web',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'He visto vuestra web pero no encuentro los precios'
    ]);

    const response = result.lastResponse.assistant;

    // Should not encourage going back to website
    const directsToWeb =
      response.toLowerCase().includes('visita la web') ||
      response.toLowerCase().includes('en nuestra web') ||
      response.toLowerCase().includes('en la página');

    return assert.isFalse(
      directsToWeb,
      'Should not direct user to website even when they mention it'
    );
  }
);

/**
 * T7.6: No URL patterns in responses
 */
const testNoUrlPatterns = defineTest(
  'T7.6-NO-URL-PATTERNS',
  'No URL patterns in any response',
  'no-web',
  async ({ policy }) => {
    const questions = [
      'Cómo funciona el tratamiento?',
      'Tenéis página web?',
      'Dónde puedo ver testimonios?',
      'Queréis más información sobre vuestros servicios'
    ];

    for (const question of questions) {
      const result = await chatbot.sendMessage(question, []);
      const response = result.response;

      // Check for URL patterns
      const urlPattern = /https?:\/\/|www\.|\.com|\.es|\.org/i;
      if (urlPattern.test(response)) {
        return {
          passed: false,
          error: `URL pattern found in response to "${question}"`,
          expected: 'No URLs',
          actual: response.substring(0, 200)
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T7.7: Alternative contact method provided (phone)
 */
const testAlternativeContactProvided = defineTest(
  'T7.7-ALTERNATIVE-CONTACT',
  'Phone provided as alternative to web',
  'no-web',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'No puedo reservar ahora, hay otra forma de contactaros?'
    ]);

    const response = result.lastResponse.assistant;
    const centralPhone = policy.centralPhone;

    const providesAlternative =
      response.includes(centralPhone) ||
      response.toLowerCase().includes('llam') ||
      response.toLowerCase().includes('teléfono');

    return assert.isTrue(
      providesAlternative,
      'Should provide phone as alternative contact'
    );
  }
);

module.exports = {
  name: 'T7 - No Website Messaging',
  tests: [
    testNoWebAvailability,
    testNoWebBookingConfirmation,
    testNoWebMoreInfo,
    testNoWebPrices,
    testNoWebAfterMention,
    testNoUrlPatterns,
    testAlternativeContactProvided
  ]
};
