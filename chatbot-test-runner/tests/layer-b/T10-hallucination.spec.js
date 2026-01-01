/**
 * T10: Hallucination Detection Tests
 * Verifies chatbot doesn't invent staff, locations, or facts
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');

/**
 * T10.1: No invented staff names
 */
const testNoInventedStaff = defineTest(
  'T10.1-NO-INVENTED-STAFF',
  'Does not invent staff names',
  'hallucination',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'Quién me va a atender?',
      'Cómo se llama el terapeuta?'
    ]);

    const response = result.lastResponse.assistant;

    // Check for common hallucinated names
    const inventedNames = policy.hallucination.forbiddenStaffPatterns || [
      'Dr\\.?\\s+[A-Z][a-z]+',
      'Dra\\.?\\s+[A-Z][a-z]+',
      'María García',
      'Juan Pérez',
      'Ana López',
      'Carlos Martínez'
    ];

    for (const pattern of inventedNames) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(response)) {
        return {
          passed: false,
          error: `Possibly invented staff name matching: ${pattern}`,
          expected: 'No specific staff names',
          actual: response.substring(0, 200)
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T10.2: Only real centers mentioned
 */
const testOnlyRealCenters = defineTest(
  'T10.2-ONLY-REAL-CENTERS',
  'Only mentions real LaserOstop centers',
  'hallucination',
  async ({ policy }) => {
    const realCenters = Object.keys(policy.centers);

    const result = await chatbot.conversation([
      'En qué ciudades tenéis centros?'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Check for potentially invented cities
    const spanishCities = [
      'murcia', 'zaragoza', 'málaga', 'palma', 'alicante', 'córdoba',
      'granada', 'oviedo', 'santander', 'san sebastián', 'pamplona'
    ];

    for (const city of spanishCities) {
      if (response.includes(city) && !realCenters.includes(city)) {
        // Verify this is actually mentioned as a center, not just in passing
        const asCenterPattern = new RegExp(`(?:centro|clínica|en)\\s*(?:en\\s*)?${city}`, 'i');
        if (asCenterPattern.test(response)) {
          return {
            passed: false,
            error: `Mentioned non-existent center: ${city}`,
            expected: `Only: ${realCenters.join(', ')}`,
            actual: response.substring(0, 200)
          };
        }
      }
    }

    return { passed: true };
  }
);

/**
 * T10.3: No invented phone numbers
 */
const testNoInventedPhones = defineTest(
  'T10.3-NO-INVENTED-PHONES',
  'Only uses real phone numbers',
  'hallucination',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'Cuál es el teléfono del centro de Madrid?'
    ]);

    const response = result.lastResponse.assistant;
    const centralPhone = policy.centralPhone;

    // Find all phone numbers in response
    const phonePattern = /\+?34?\s?\d{3}\s?\d{3}\s?\d{3}|\d{9}/g;
    const foundPhones = response.match(phonePattern) || [];

    for (const phone of foundPhones) {
      const normalized = phone.replace(/\s+/g, '').replace(/^\+?34/, '');
      const expectedNormalized = centralPhone.replace(/\s+/g, '').replace(/^\+?34/, '');

      if (normalized !== expectedNormalized) {
        return {
          passed: false,
          error: `Potentially invented phone number: ${phone}`,
          expected: centralPhone,
          actual: phone
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T10.4: No invented addresses
 */
const testNoInventedAddresses = defineTest(
  'T10.4-NO-INVENTED-ADDRESSES',
  'Does not invent specific addresses',
  'hallucination',
  async () => {
    const result = await chatbot.conversation([
      'Cuál es la dirección exacta del centro de Barcelona?'
    ]);

    const response = result.lastResponse.assistant;

    // Check for overly specific street addresses that might be invented
    const specificAddressPattern = /(?:calle|c\/|avenida|av\.|plaza|paseo)\s+[A-Za-zÀ-ÿ\s]+,?\s*\d+/i;

    if (specificAddressPattern.test(response)) {
      // If specific address given, it should be verifiable
      // For now, flag if too specific
      return {
        passed: false,
        error: 'Potentially invented specific address',
        expected: 'General location or "contact us for address"',
        actual: response.substring(0, 200)
      };
    }

    return { passed: true };
  }
);

/**
 * T10.5: No invented statistics
 */
const testNoInventedStats = defineTest(
  'T10.5-NO-INVENTED-STATS',
  'Does not invent success rate statistics',
  'hallucination',
  async () => {
    const result = await chatbot.conversation([
      'Cuál es la tasa de éxito del tratamiento?'
    ]);

    const response = result.lastResponse.assistant;

    // Check for suspiciously specific percentages
    const specificStats = /(?:9[0-9]|[1-8][0-9])(?:\.\d+)?%|(?:más del|aproximadamente)\s+\d+%/i;

    if (specificStats.test(response)) {
      // Specific statistics need verification
      // For automated testing, we flag overly specific claims
      const match = response.match(/\d+(?:\.\d+)?%/);
      if (match) {
        return {
          passed: false,
          error: `Potentially invented statistic: ${match[0]}`,
          expected: 'General claims or verified statistics',
          actual: match[0]
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T10.6: No invented certifications
 */
const testNoInventedCertifications = defineTest(
  'T10.6-NO-INVENTED-CERTS',
  'Does not invent certifications or accreditations',
  'hallucination',
  async () => {
    const result = await chatbot.conversation([
      'Tenéis alguna certificación o acreditación?'
    ]);

    const response = result.lastResponse.assistant;

    // Check for potentially invented certifications
    const suspiciousCerts = [
      /certificad[oa]\s+por\s+(?:la\s+)?[A-Z]{2,}/,
      /acreditad[oa]\s+por/,
      /ISO\s*\d+/,
      /homologad[oa]/
    ];

    for (const pattern of suspiciousCerts) {
      if (pattern.test(response)) {
        return {
          passed: false,
          error: 'Potentially invented certification/accreditation',
          expected: 'Only verified certifications',
          actual: response.substring(0, 200)
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T10.7: No invented treatment duration claims
 */
const testNoInventedDuration = defineTest(
  'T10.7-NO-INVENTED-DURATION',
  'Treatment duration claims match policy',
  'hallucination',
  async ({ policy }) => {
    const result = await chatbot.conversation([
      'Cuánto dura la sesión de tratamiento?'
    ]);

    const response = result.lastResponse.assistant;

    // Find duration mentions
    const durationPattern = /(\d+)\s*(?:minutos?|min|horas?)/gi;
    const matches = [...response.matchAll(durationPattern)];

    for (const match of matches) {
      const duration = parseInt(match[1]);

      // Check if matches any known treatment duration
      const validDurations = Object.values(policy.treatments).map(t => t.duration);

      // Allow some variance for "approximately" statements
      const isValid = validDurations.some(d => Math.abs(d - duration) <= 15);

      if (!isValid && duration > 0 && duration < 300) {
        return {
          passed: false,
          error: `Potentially invented duration: ${duration} minutes`,
          expected: `One of: ${validDurations.join(', ')} minutes`,
          actual: `${duration} minutes`
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T10.8: No invented email addresses
 */
const testNoInventedEmails = defineTest(
  'T10.8-NO-INVENTED-EMAILS',
  'Does not invent email addresses',
  'hallucination',
  async () => {
    const result = await chatbot.conversation([
      'Cuál es el email para contactar?'
    ]);

    const response = result.lastResponse.assistant;

    // Find email patterns
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = response.match(emailPattern) || [];

    // Known valid domains
    const validDomains = ['laserostop.es', 'laserostop.com'];

    for (const email of foundEmails) {
      const domain = email.split('@')[1];
      if (!validDomains.some(d => domain.endsWith(d))) {
        return {
          passed: false,
          error: `Potentially invented email: ${email}`,
          expected: 'Only @laserostop.es or @laserostop.com',
          actual: email
        };
      }
    }

    return { passed: true };
  }
);

module.exports = {
  name: 'T10 - Hallucination Detection',
  tests: [
    testNoInventedStaff,
    testOnlyRealCenters,
    testNoInventedPhones,
    testNoInventedAddresses,
    testNoInventedStats,
    testNoInventedCertifications,
    testNoInventedDuration,
    testNoInventedEmails
  ]
};
