/**
 * T1: Availability Accuracy Tests
 * Verifies chatbot shows ONLY slots from Smart Agenda API
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');
const smartAgenda = require('../../lib/smartAgendaClient');

/**
 * T1.1: Madrid availability matches API
 */
const testMadridAvailability = defineTest(
  'T1.1-MADRID-AVAILABILITY',
  'Madrid: Chatbot slots match Smart Agenda API',
  'availability',
  async ({ policy }) => {
    const center = policy.centers['chamartin'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

    // Get availability from API
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const apiSlots = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Get chatbot response
    const result = await chatbot.conversation([
      'Quiero reservar una cita para dejar de fumar en Madrid',
      'tabaco'
    ]);

    const botResponse = result.lastResponse.assistant;
    const botSlots = chatbot.extractSlotsFromResponse(botResponse);

    // If no API slots, bot should say no availability
    if (apiSlots.length === 0) {
      return assert.contains(
        botResponse,
        'no hay disponibilidad',
        'Should indicate no availability when API returns none'
      );
    }

    // Verify bot doesn't show slots not in API
    for (const time of botSlots.allTimes) {
      const foundInApi = apiSlots.some(slot => slot.times.includes(time));
      if (!foundInApi) {
        return {
          passed: false,
          error: `Bot showed time ${time} not found in API response`,
          expected: 'Only times from API',
          actual: time
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T1.2: Barcelona availability matches API
 */
const testBarcelonaAvailability = defineTest(
  'T1.2-BARCELONA-AVAILABILITY',
  'Barcelona: Chatbot slots match Smart Agenda API',
  'availability',
  async ({ policy }) => {
    const center = policy.centers['barcelona'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const apiSlots = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const result = await chatbot.conversation([
      'Quiero reservar una cita en Barcelona',
      'tabaco'
    ]);

    const botResponse = result.lastResponse.assistant;
    const botSlots = chatbot.extractSlotsFromResponse(botResponse);

    if (apiSlots.length === 0) {
      return assert.contains(
        botResponse,
        'no hay disponibilidad',
        'Should indicate no availability when API returns none'
      );
    }

    for (const time of botSlots.allTimes) {
      const foundInApi = apiSlots.some(slot => slot.times.includes(time));
      if (!foundInApi) {
        return {
          passed: false,
          error: `Bot showed time ${time} not found in API response`,
          expected: 'Only times from API',
          actual: time
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T1.3: Sevilla availability matches API
 */
const testSevillaAvailability = defineTest(
  'T1.3-SEVILLA-AVAILABILITY',
  'Sevilla: Chatbot slots match Smart Agenda API',
  'availability',
  async ({ policy }) => {
    const center = policy.centers['sevilla'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const apiSlots = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const result = await chatbot.conversation([
      'Quiero una cita en Sevilla para dejar el tabaco'
    ]);

    const botResponse = result.lastResponse.assistant;
    const botSlots = chatbot.extractSlotsFromResponse(botResponse);

    if (apiSlots.length === 0) {
      return assert.contains(
        botResponse,
        'no hay disponibilidad',
        'Should indicate no availability when API returns none'
      );
    }

    for (const time of botSlots.allTimes) {
      const foundInApi = apiSlots.some(slot => slot.times.includes(time));
      if (!foundInApi) {
        return {
          passed: false,
          error: `Bot showed time ${time} not found in API response`,
          expected: 'Only times from API',
          actual: time
        };
      }
    }

    return { passed: true };
  }
);

/**
 * T1.4: Cannabis treatment availability
 */
const testCannabisAvailability = defineTest(
  'T1.4-CANNABIS-AVAILABILITY',
  'Cannabis treatment: Chatbot slots match API',
  'availability',
  async ({ policy }) => {
    const center = policy.centers['chamartin'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.cannabis;

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const apiSlots = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const result = await chatbot.conversation([
      'Quiero dejar el cannabis, tenéis citas en Madrid?'
    ]);

    const botResponse = result.lastResponse.assistant;

    if (apiSlots.length === 0) {
      return assert.contains(
        botResponse,
        'no hay disponibilidad',
        'Should indicate no availability when API returns none'
      );
    }

    return { passed: true };
  }
);

/**
 * T1.5: Azucar treatment availability
 */
const testAzucarAvailability = defineTest(
  'T1.5-AZUCAR-AVAILABILITY',
  'Azucar treatment: Chatbot slots match API',
  'availability',
  async ({ policy }) => {
    const center = policy.centers['chamartin'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.azucar;

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const apiSlots = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const result = await chatbot.conversation([
      'Quiero dejar el azúcar, hay citas disponibles en Madrid?'
    ]);

    const botResponse = result.lastResponse.assistant;

    if (apiSlots.length === 0) {
      return assert.contains(
        botResponse,
        'no hay disponibilidad',
        'Should indicate no availability when API returns none'
      );
    }

    return { passed: true };
  }
);

module.exports = {
  name: 'T1 - Availability Accuracy',
  tests: [
    testMadridAvailability,
    testBarcelonaAvailability,
    testSevillaAvailability,
    testCannabisAvailability,
    testAzucarAvailability
  ]
};
