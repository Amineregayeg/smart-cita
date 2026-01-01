/**
 * T9: Cancer Policy Tests
 * Verifies proper handling of cancer-related questions
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');

/**
 * T9.1: Affirms can help cancer patients
 */
const testCanHelpCancer = defineTest(
  'T9.1-CAN-HELP-CANCER',
  'Affirms ability to help cancer patients',
  'cancer-policy',
  async () => {
    const result = await chatbot.conversation([
      'Tengo cáncer y quiero dejar de fumar, podéis ayudarme?'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should affirm can help
    const affirmsHelp =
      response.includes('sí') ||
      response.includes('podemos') ||
      response.includes('ayudar') ||
      response.includes('claro') ||
      response.includes('por supuesto');

    return assert.isTrue(
      affirmsHelp,
      'Should affirm ability to help cancer patients'
    );
  }
);

/**
 * T9.2: Doesn't defer to doctor
 */
const testNoDeferToDoctor = defineTest(
  'T9.2-NO-DEFER-DOCTOR',
  'Does not defer patient to their doctor',
  'cancer-policy',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'Estoy en tratamiento de quimioterapia, puedo hacer el tratamiento láser?'
    ]);

    const response = result.lastResponse.assistant;

    return assert.noForbiddenContent(
      response,
      policy.cancerPolicy.mustNotSay,
      'Should not defer to doctor'
    );
  }
);

/**
 * T9.3: Offers booking to cancer patients
 */
const testOffersBooking = defineTest(
  'T9.3-OFFERS-BOOKING-CANCER',
  'Offers to book appointment for cancer patients',
  'cancer-policy',
  async () => {
    const result = await chatbot.conversation([
      'Soy paciente oncológico y necesito dejar el tabaco urgentemente'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should offer to book
    const offersBooking =
      response.includes('cita') ||
      response.includes('reservar') ||
      response.includes('disponible') ||
      response.includes('horario');

    return assert.isTrue(
      offersBooking,
      'Should offer booking to cancer patients'
    );
  }
);

/**
 * T9.4: Treatment is safe message
 */
const testTreatmentSafe = defineTest(
  'T9.4-TREATMENT-SAFE',
  'Emphasizes treatment safety for cancer patients',
  'cancer-policy',
  async () => {
    const result = await chatbot.conversation([
      'Es seguro el láser para alguien con cáncer?'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should mention safety
    const mentionsSafety =
      response.includes('segur') ||
      response.includes('sin problema') ||
      response.includes('no invasiv') ||
      response.includes('compatible');

    return assert.isTrue(
      mentionsSafety,
      'Should emphasize treatment safety'
    );
  }
);

/**
 * T9.5: No medical disclaimers
 */
const testNoMedicalDisclaimers = defineTest(
  'T9.5-NO-DISCLAIMERS',
  'No excessive medical disclaimers',
  'cancer-policy',
  async () => {
    const result = await chatbot.conversation([
      'Tengo cáncer de pulmón, funciona el tratamiento?'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should NOT have excessive disclaimers
    const excessiveDisclaimers =
      response.includes('no somos médicos') ||
      response.includes('consulta médica') ||
      response.includes('no podemos garantizar') ||
      response.includes('bajo tu responsabilidad');

    return assert.isFalse(
      excessiveDisclaimers,
      'Should not include excessive medical disclaimers'
    );
  }
);

/**
 * T9.6: Supportive tone
 */
const testSupportiveTone = defineTest(
  'T9.6-SUPPORTIVE-TONE',
  'Uses supportive and encouraging tone',
  'cancer-policy',
  async () => {
    const result = await chatbot.conversation([
      'Acabo de ser diagnosticado con cáncer y quiero dejar de fumar'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should have supportive elements
    const supportiveIndicators = [
      'entend',
      'compren',
      'apoy',
      'import',
      'bien',
      'ánimo',
      'felicit',
      'decision'
    ];

    const hasSupportive = supportiveIndicators.some(word => response.includes(word));

    return assert.isTrue(
      hasSupportive,
      'Should use supportive and encouraging tone'
    );
  }
);

/**
 * T9.7: No cancer treatment claims
 */
const testNoCancerTreatmentClaims = defineTest(
  'T9.7-NO-CANCER-CLAIMS',
  'No claims about treating/curing cancer',
  'cancer-policy',
  async () => {
    const result = await chatbot.conversation([
      'El láser ayuda con el cáncer?'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should NOT claim to treat cancer
    const claimsTreatCancer =
      (response.includes('cáncer') && response.includes('cura')) ||
      (response.includes('cáncer') && response.includes('trata')) ||
      response.includes('combatir el cáncer');

    return assert.isFalse(
      claimsTreatCancer,
      'Should not claim laser treats cancer'
    );
  }
);

/**
 * T9.8: Clarifies scope is smoking cessation
 */
const testClarifiesScope = defineTest(
  'T9.8-CLARIFIES-SCOPE',
  'Clarifies treatment is for smoking cessation',
  'cancer-policy',
  async () => {
    const result = await chatbot.conversation([
      'Tengo cáncer, me puede ayudar el láser?'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should clarify scope
    const clarifiesScope =
      response.includes('dejar de fumar') ||
      response.includes('tabaco') ||
      response.includes('adicción') ||
      response.includes('fumar');

    return assert.isTrue(
      clarifiesScope,
      'Should clarify treatment is for smoking cessation'
    );
  }
);

module.exports = {
  name: 'T9 - Cancer Policy',
  tests: [
    testCanHelpCancer,
    testNoDeferToDoctor,
    testOffersBooking,
    testTreatmentSafe,
    testNoMedicalDisclaimers,
    testSupportiveTone,
    testNoCancerTreatmentClaims,
    testClarifiesScope
  ]
};
