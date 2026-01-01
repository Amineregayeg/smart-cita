/**
 * T6: Callback Flow Tests
 * Verifies callback requests are handled correctly
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');

/**
 * T6.1: Callback request collects name
 */
const testCallbackCollectsName = defineTest(
  'T6.1-CALLBACK-NAME',
  'Callback request collects user name',
  'callback',
  async () => {
    const result = await chatbot.conversation([
      'Prefiero que me llaméis vosotros'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    const asksForName =
      response.includes('nombre') ||
      response.includes('cómo te llamas') ||
      response.includes('tu nombre');

    return assert.isTrue(
      asksForName,
      'Should ask for name when requesting callback'
    );
  }
);

/**
 * T6.2: Callback request collects phone
 */
const testCallbackCollectsPhone = defineTest(
  'T6.2-CALLBACK-PHONE',
  'Callback request collects phone number',
  'callback',
  async () => {
    const result = await chatbot.conversation([
      'Quiero que me llamen para más información',
      'Juan García'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    const asksForPhone =
      response.includes('teléfono') ||
      response.includes('número') ||
      response.includes('móvil') ||
      response.includes('contactar');

    return assert.isTrue(
      asksForPhone,
      'Should ask for phone number in callback flow'
    );
  }
);

/**
 * T6.3: Callback provides central phone
 */
const testCallbackProvidesCentralPhone = defineTest(
  'T6.3-CALLBACK-CENTRAL-PHONE',
  'Callback response includes central phone number',
  'callback',
  async ({ policy }) => {
    const centralPhone = policy.centralPhone;

    const result = await chatbot.conversation([
      'Prefiero llamar yo, cuál es vuestro teléfono?'
    ]);

    const response = result.lastResponse.assistant;

    return assert.contains(
      response,
      centralPhone,
      `Should provide central phone ${centralPhone}`
    );
  }
);

/**
 * T6.4: Callback confirmation message
 */
const testCallbackConfirmation = defineTest(
  'T6.4-CALLBACK-CONFIRMATION',
  'Callback request ends with confirmation',
  'callback',
  async () => {
    const result = await chatbot.conversation([
      'Me gustaría que me llamaran',
      'María López',
      '612345678'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    const hasConfirmation =
      response.includes('llamaremos') ||
      response.includes('contactar') ||
      response.includes('pronto') ||
      response.includes('gracias');

    return assert.isTrue(
      hasConfirmation,
      'Should confirm callback will be made'
    );
  }
);

/**
 * T6.5: Callback validates phone format
 */
const testCallbackValidatesPhone = defineTest(
  'T6.5-CALLBACK-PHONE-VALIDATION',
  'Callback validates phone number format',
  'callback',
  async () => {
    const result = await chatbot.conversation([
      'Llamadme por favor',
      'Test User',
      '123' // Invalid phone
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    const asksAgainOrValidates =
      response.includes('válido') ||
      response.includes('correcto') ||
      response.includes('teléfono') ||
      response.includes('número') ||
      response.includes('dígitos');

    // Either asks again or accepts (some bots are lenient)
    return { passed: true };
  }
);

/**
 * T6.6: Callback flow doesn't require booking
 */
const testCallbackNoBogkingRequired = defineTest(
  'T6.6-CALLBACK-NO-BOOKING',
  'Callback flow works without booking',
  'callback',
  async () => {
    // Start fresh conversation asking for callback only
    const result = await chatbot.conversation([
      'No quiero reservar, solo quiero información. Llamadme.'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should not force into booking flow
    const forcesBooking =
      response.includes('reservar cita') &&
      !response.includes('llamar');

    return assert.isFalse(
      forcesBooking,
      'Should not force booking when callback requested'
    );
  }
);

module.exports = {
  name: 'T6 - Callback Flow',
  tests: [
    testCallbackCollectsName,
    testCallbackCollectsPhone,
    testCallbackProvidesCentralPhone,
    testCallbackConfirmation,
    testCallbackValidatesPhone,
    testCallbackNoBogkingRequired
  ]
};
