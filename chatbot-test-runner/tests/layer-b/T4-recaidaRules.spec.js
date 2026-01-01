/**
 * T4: Recaida Rules Tests
 * Verifies recaida appointment restrictions are enforced
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');
const smartAgenda = require('../../lib/smartAgendaClient');

/**
 * T4.1: Recaida only for tabaco/cannabis
 */
const testRecaidaAllowedServices = defineTest(
  'T4.1-RECAIDA-SERVICES',
  'Recaida only allowed for tabaco and cannabis',
  'recaida',
  async ({ policy }) => {
    const allowedServices = policy.recaida.allowedServices;
    const forbiddenServices = policy.recaida.forbiddenServices;

    // Test asking for recaida for forbidden service
    for (const service of forbiddenServices) {
      const result = await chatbot.conversation([
        `Tuve una recaída con ${service}, necesito otra cita`
      ]);

      const response = result.lastResponse.assistant.toLowerCase();

      // Should not offer recaida booking for forbidden services
      const offersRecaida =
        response.includes('recaída') &&
        (response.includes('disponible') || response.includes('cita'));

      if (offersRecaida && response.includes(service)) {
        return {
          passed: false,
          error: `Offered recaida for forbidden service: ${service}`,
          expected: 'Recaida not available for azucar/duo',
          actual: response.substring(0, 200)
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T4.2: Max 2 recaidas per day per center
 */
const testRecaidaMaxPerDay = defineTest(
  'T4.2-RECAIDA-MAX-PER-DAY',
  'Maximum 2 recaidas per day per center enforced',
  'recaida',
  async ({ policy }) => {
    const center = 'chamartin';
    const centerConfig = policy.centers[center];
    const recaidaTypeId = policy.appointmentTypes[centerConfig.agendaId]?.recaida;
    const maxPerDay = policy.recaida.maxPerDayPerCenter;

    // Get a day with availability
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const slots = await smartAgenda.getAvailability(
      centerConfig.agendaId,
      recaidaTypeId,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    if (slots.length === 0) {
      return { passed: true }; // No recaida slots to test
    }

    // Check current recaida count for each day
    for (const day of slots) {
      const count = await smartAgenda.countRecaidasForDay(
        centerConfig.agendaId,
        day.date,
        recaidaTypeId
      );

      // If we're at max and still showing slots, that's a problem
      if (count >= maxPerDay && day.times.length > 0) {
        return {
          passed: false,
          error: `Day ${day.date} has ${count} recaidas but still shows ${day.times.length} available slots`,
          expected: `No slots when at max ${maxPerDay}`,
          actual: `${count} recaidas, ${day.times.length} slots available`
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T4.3: No recaidas on weekends
 */
const testNoWeekendRecaidas = defineTest(
  'T4.3-NO-WEEKEND-RECAIDA',
  'Recaidas not available on weekends',
  'recaida',
  async ({ policy }) => {
    const center = 'chamartin';
    const centerConfig = policy.centers[center];
    const recaidaTypeId = policy.appointmentTypes[centerConfig.agendaId]?.recaida;
    const forbiddenDays = policy.recaida.forbiddenWeekdays || ['sat', 'sun'];

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 30);

    const slots = await smartAgenda.getAvailability(
      centerConfig.agendaId,
      recaidaTypeId,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const dayMap = {
      0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
    };

    for (const day of slots) {
      const date = new Date(day.date);
      const dayOfWeek = dayMap[date.getDay()];

      if (forbiddenDays.includes(dayOfWeek) && day.times.length > 0) {
        return {
          passed: false,
          error: `Recaida slots on ${dayOfWeek}: ${day.date}`,
          expected: 'No weekend recaidas',
          actual: day.times
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T4.4: Recaida requires previous treatment
 */
const testRecaidaRequiresPrevious = defineTest(
  'T4.4-RECAIDA-REQUIRES-PREVIOUS',
  'Recaida conversation asks about previous treatment',
  'recaida',
  async () => {
    const result = await chatbot.conversation([
      'He recaído, necesito ayuda'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should ask about or acknowledge previous treatment
    const asksAboutPrevious =
      response.includes('anterior') ||
      response.includes('previa') ||
      response.includes('tratamiento') ||
      response.includes('cuándo') ||
      response.includes('sesión');

    return assert.isTrue(
      asksAboutPrevious,
      'Should ask about or reference previous treatment for recaida'
    );
  }
);

/**
 * T4.5: Recaida free of charge messaging
 */
const testRecaidaFreeMessaging = defineTest(
  'T4.5-RECAIDA-FREE',
  'Recaida mentions it is free/included',
  'recaida',
  async () => {
    const result = await chatbot.conversation([
      'Tuve una recaída con el tabaco, necesito otra sesión'
    ]);

    const response = result.lastResponse.assistant.toLowerCase();

    // Should mention it's free or included
    const mentionsFree =
      response.includes('gratis') ||
      response.includes('gratuita') ||
      response.includes('sin coste') ||
      response.includes('incluida') ||
      response.includes('garantía');

    return assert.isTrue(
      mentionsFree,
      'Recaida should mention it is free/included in guarantee'
    );
  }
);

/**
 * T4.6: Recaida count tracked correctly
 */
const testRecaidaCountAccurate = defineTest(
  'T4.6-RECAIDA-COUNT',
  'Recaida count per day is accurate',
  'recaida',
  async ({ policy }) => {
    const center = 'chamartin';
    const centerConfig = policy.centers[center];
    const recaidaTypeId = policy.appointmentTypes[centerConfig.agendaId]?.recaida;

    // Get today's bookings
    const today = new Date().toISOString().split('T')[0];
    const bookings = await smartAgenda.getAllBookings(today, today);

    // Count recaidas manually
    const manualCount = bookings.filter(b =>
      b.equipe_id === centerConfig.agendaId &&
      b.presta_id === recaidaTypeId
    ).length;

    // Compare with API count function
    const apiCount = await smartAgenda.countRecaidasForDay(
      centerConfig.agendaId,
      today,
      recaidaTypeId
    );

    return assert.equals(
      apiCount,
      manualCount,
      `Recaida count should match: API ${apiCount} vs Manual ${manualCount}`
    );
  }
);

module.exports = {
  name: 'T4 - Recaida Rules',
  tests: [
    testRecaidaAllowedServices,
    testRecaidaMaxPerDay,
    testNoWeekendRecaidas,
    testRecaidaRequiresPrevious,
    testRecaidaFreeMessaging,
    testRecaidaCountAccurate
  ]
};
