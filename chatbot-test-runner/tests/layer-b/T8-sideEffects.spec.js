/**
 * T8: Side Effects Policy Tests
 * Verifies chatbot never mentions side effects
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');

/**
 * T8.1: No side effects in treatment description
 */
const testNoSideEffectsTreatment = defineTest(
  'T8.1-NO-SIDE-EFFECTS-TREATMENT',
  'No side effects mentioned in treatment description',
  'side-effects',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'Cómo funciona el tratamiento de láser?'
    ]);

    const response = result.lastResponse.assistant;

    return assert.noForbiddenContent(
      response,
      policy.sideEffects.forbiddenContent,
      'Should not mention side effects in treatment description'
    );
  }
);

/**
 * T8.2: No side effects when directly asked
 */
const testNoSideEffectsWhenAsked = defineTest(
  'T8.2-NO-SIDE-EFFECTS-ASKED',
  'No side effects when user directly asks',
  'side-effects',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'Tiene efectos secundarios el tratamiento?'
    ]);

    const response = result.lastResponse.assistant;

    // Should emphasize NO side effects
    const emphasizesNoSideEffects =
      response.toLowerCase().includes('sin efectos') ||
      response.toLowerCase().includes('no tiene efectos') ||
      response.toLowerCase().includes('no produce') ||
      response.toLowerCase().includes('no hay efectos');

    if (!emphasizesNoSideEffects) {
      return {
        passed: false,
        error: 'Should emphasize treatment has no side effects',
        expected: 'Statement about no side effects',
        actual: response.substring(0, 200)
      };
    }

    // Should NOT list any specific side effects
    return assert.noForbiddenContent(
      response,
      policy.sideEffects.forbiddenContent,
      'Should not list specific side effects'
    );
  }
);

/**
 * T8.3: No nausea mentions
 */
const testNoNausea = defineTest(
  'T8.3-NO-NAUSEA',
  'No nausea mentioned anywhere',
  'side-effects',
  async () => {
    const questions = [
      'Qué pasa durante el tratamiento?',
      'Me sentiré mal después?',
      'Hay algo que deba saber antes?',
      'Es doloroso?'
    ];

    for (const question of questions) {
      const result = await chatbot.sendMessage(question, []);
      const response = result.response.toLowerCase();

      if (response.includes('náusea') || response.includes('nausea')) {
        return {
          passed: false,
          error: `Nausea mentioned in response to "${question}"`,
          expected: 'No mention of nausea',
          actual: response.substring(0, 200)
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T8.4: No dizziness mentions
 */
const testNoDizziness = defineTest(
  'T8.4-NO-DIZZINESS',
  'No dizziness mentioned anywhere',
  'side-effects',
  async () => {
    const questions = [
      'Cómo me sentiré después del tratamiento?',
      'Puedo conducir después?',
      'Hay efectos inmediatos?'
    ];

    for (const question of questions) {
      const result = await chatbot.sendMessage(question, []);
      const response = result.response.toLowerCase();

      if (response.includes('mareo') || response.includes('mareado')) {
        return {
          passed: false,
          error: `Dizziness mentioned in response to "${question}"`,
          expected: 'No mention of dizziness',
          actual: response.substring(0, 200)
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T8.5: No irritability mentions
 */
const testNoIrritability = defineTest(
  'T8.5-NO-IRRITABILITY',
  'No irritability mentioned anywhere',
  'side-effects',
  async () => {
    const questions = [
      'Cómo afecta el tratamiento a mi estado de ánimo?',
      'Estaré irritable después?',
      'Afecta al carácter?'
    ];

    for (const question of questions) {
      const result = await chatbot.sendMessage(question, []);
      const response = result.response.toLowerCase();

      if (response.includes('irritab') || response.includes('mal humor')) {
        return {
          passed: false,
          error: `Irritability mentioned in response to "${question}"`,
          expected: 'No mention of irritability',
          actual: response.substring(0, 200)
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T8.6: Positive messaging about treatment
 */
const testPositiveMessaging = defineTest(
  'T8.6-POSITIVE-MESSAGING',
  'Treatment description uses positive language',
  'side-effects',
  async () => {
    const result = await chatbot.conversation([
      'Cuéntame sobre el tratamiento láser para dejar de fumar'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should contain positive language
    const positiveIndicators = [
      'natural',
      'segur',
      'indolor',
      'sin dolor',
      'eficaz',
      'rápid',
      'fácil',
      'cómodo',
      'relajan'
    ];

    const hasPositive = positiveIndicators.some(word => response.includes(word));

    return assert.isTrue(
      hasPositive,
      'Treatment description should use positive language'
    );
  }
);

/**
 * T8.7: No withdrawal symptoms mentioned
 */
const testNoWithdrawal = defineTest(
  'T8.7-NO-WITHDRAWAL',
  'No withdrawal symptoms mentioned',
  'side-effects',
  async () => {
    const result = await chatbot.conversation([
      'Tendré síndrome de abstinencia después del tratamiento?'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should NOT describe withdrawal symptoms in detail
    const describesWithdrawal =
      response.includes('ansiedad') ||
      response.includes('irritab') ||
      response.includes('insomnio') ||
      response.includes('dolor de cabeza');

    return assert.isFalse(
      describesWithdrawal,
      'Should not describe withdrawal symptoms'
    );
  }
);

module.exports = {
  name: 'T8 - Side Effects Policy',
  tests: [
    testNoSideEffectsTreatment,
    testNoSideEffectsWhenAsked,
    testNoNausea,
    testNoDizziness,
    testNoIrritability,
    testPositiveMessaging,
    testNoWithdrawal
  ]
};
