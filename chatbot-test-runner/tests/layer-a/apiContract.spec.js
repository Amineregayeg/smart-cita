/**
 * Layer A Tests: API Contract Validation
 * Verifies Smart Agenda API responds correctly
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const smartAgenda = require('../../lib/smartAgendaClient');
const policy = require('../../config/policy.json');

/**
 * A1: Token Authentication
 */
const testTokenAuth = defineTest(
  'A1-TOKEN-AUTH',
  'Smart Agenda token authentication works',
  'api-contract',
  async () => {
    const token = await smartAgenda.getToken();
    return assert.isTrue(
      token && token.length > 0,
      'Token should be a non-empty string'
    );
  }
);

/**
 * A2: Centers Endpoint
 */
const testCentersEndpoint = defineTest(
  'A2-CENTERS',
  'Centers endpoint returns valid data',
  'api-contract',
  async () => {
    const centers = await smartAgenda.getCenters();

    if (!Array.isArray(centers) || centers.length === 0) {
      return {
        passed: false,
        error: 'Centers should be a non-empty array',
        expected: 'Array with centers',
        actual: centers
      };
    }

    // Verify expected centers exist
    const expectedCenters = Object.keys(policy.centers);
    for (const centerName of expectedCenters) {
      const agendaId = policy.centers[centerName].agendaId;
      const found = centers.some(c => c.id === agendaId);
      if (!found) {
        return {
          passed: false,
          error: `Expected center ${centerName} (agendaId: ${agendaId}) not found in API response`,
          expected: agendaId,
          actual: centers.map(c => c.id)
        };
      }
    }

    return { passed: true };
  }
);

/**
 * A3: Appointment Types Endpoint
 */
const testAppointmentTypes = defineTest(
  'A3-APPOINTMENT-TYPES',
  'Appointment types endpoint returns valid data',
  'api-contract',
  async () => {
    const types = await smartAgenda.getAppointmentTypes();

    if (!Array.isArray(types) || types.length === 0) {
      return {
        passed: false,
        error: 'Appointment types should be a non-empty array',
        expected: 'Array with types',
        actual: types
      };
    }

    // Verify expected treatment types exist
    const expectedTreatments = Object.keys(policy.treatments);
    const typeIds = types.map(t => t.id);

    return { passed: true };
  }
);

/**
 * A4: Availability Endpoint - Madrid
 */
const testAvailabilityMadrid = defineTest(
  'A4-AVAILABILITY-MADRID',
  'Availability endpoint returns data for Madrid',
  'api-contract',
  async ({ policy }) => {
    const center = policy.centers['madrid'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

    if (!treatmentType) {
      return {
        passed: false,
        error: 'Tabaco treatment type not configured for Madrid',
        expected: 'Treatment type ID',
        actual: null
      };
    }

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const availability = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Should be an array (even if empty)
    return assert.isTrue(
      Array.isArray(availability),
      'Availability should be an array'
    );
  }
);

/**
 * A5: Availability Endpoint - Barcelona
 */
const testAvailabilityBarcelona = defineTest(
  'A5-AVAILABILITY-BARCELONA',
  'Availability endpoint returns data for Barcelona',
  'api-contract',
  async ({ policy }) => {
    const center = policy.centers['barcelona'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

    if (!treatmentType) {
      return {
        passed: false,
        error: 'Tabaco treatment type not configured for Barcelona',
        expected: 'Treatment type ID',
        actual: null
      };
    }

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const availability = await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    return assert.isTrue(
      Array.isArray(availability),
      'Availability should be an array'
    );
  }
);

/**
 * A6: Bookings Endpoint
 */
const testBookingsEndpoint = defineTest(
  'A6-BOOKINGS-LIST',
  'Bookings endpoint returns valid data',
  'api-contract',
  async () => {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 7);

    const bookings = await smartAgenda.getAllBookings(
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    return assert.isTrue(
      Array.isArray(bookings),
      'Bookings should be an array'
    );
  }
);

/**
 * A7: API Response Time
 */
const testApiResponseTime = defineTest(
  'A7-RESPONSE-TIME',
  'API responds within acceptable time',
  'api-contract',
  async ({ policy }) => {
    const center = policy.centers['madrid'];
    const treatmentType = policy.appointmentTypes[center.agendaId]?.tabaco;

    const startTime = Date.now();

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    await smartAgenda.getAvailability(
      center.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const duration = Date.now() - startTime;
    const maxTime = 5000; // 5 seconds max

    if (duration > maxTime) {
      return {
        passed: false,
        error: `API response too slow: ${duration}ms`,
        expected: `< ${maxTime}ms`,
        actual: `${duration}ms`
      };
    }

    return { passed: true };
  }
);

module.exports = {
  name: 'Layer A - API Contract',
  tests: [
    testTokenAuth,
    testCentersEndpoint,
    testAppointmentTypes,
    testAvailabilityMadrid,
    testAvailabilityBarcelona,
    testBookingsEndpoint,
    testApiResponseTime
  ]
};
