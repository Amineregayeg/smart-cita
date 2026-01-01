/**
 * Layer C Tests: Database Verification
 * Verifies booking data integrity and consistency
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const smartAgenda = require('../../lib/smartAgendaClient');
const testDataManager = require('../../lib/testDataManager');

/**
 * C1: Booking persists correctly
 */
const testBookingPersists = defineTest(
  'C1-BOOKING-PERSISTS',
  'Created booking can be retrieved',
  'db-verification',
  async ({ policy }) => {
    // Create a test booking
    const booking = await testDataManager.createTestBooking({
      center: 'chamartin',
      treatment: 'tabaco'
    });

    if (!booking.appointmentId) {
      return {
        passed: false,
        error: 'Failed to create test booking',
        expected: 'Booking ID',
        actual: null
      };
    }

    const bookingId = booking.appointmentId;

    try {
      // Retrieve and verify
      const retrieved = await smartAgenda.getBooking(bookingId);

      if (!retrieved) {
        return {
          passed: false,
          error: 'Booking not found after creation',
          expected: 'Booking exists',
          actual: 'Not found'
        };
      }

      return { passed: true, bookingId };
    } finally {
      await testDataManager.deleteTestBooking(bookingId);
    }
  }
);

/**
 * C2: Booking deletion works
 */
const testBookingDeletion = defineTest(
  'C2-BOOKING-DELETION',
  'Deleted booking is removed from DB',
  'db-verification',
  async ({ policy }) => {
    // Create a test booking
    const booking = await testDataManager.createTestBooking({
      center: 'chamartin',
      treatment: 'tabaco'
    });

    const bookingId = booking.appointmentId;

    // Delete it
    await testDataManager.deleteTestBooking(bookingId);

    // Verify it's gone
    const retrieved = await smartAgenda.getBooking(bookingId);

    if (retrieved) {
      return {
        passed: false,
        error: 'Booking still exists after deletion',
        expected: 'Not found',
        actual: 'Still exists'
      };
    }

    return { passed: true };
  }
);

/**
 * C3: Client data stored correctly
 */
const testClientDataStored = defineTest(
  'C3-CLIENT-DATA',
  'Client data stored correctly in booking',
  'db-verification',
  async ({ policy }) => {
    const booking = await testDataManager.createTestBooking({
      center: 'barcelona',
      treatment: 'tabaco'
    });

    const bookingId = booking.appointmentId;

    try {
      const retrieved = await smartAgenda.getBooking(bookingId);

      // Verify test data matches
      const testEmail = booking.testData.email;
      if (retrieved.client_mail !== testEmail) {
        return {
          passed: false,
          error: 'Client email mismatch',
          expected: testEmail,
          actual: retrieved.client_mail
        };
      }

      return { passed: true, bookingId };
    } finally {
      await testDataManager.deleteTestBooking(bookingId);
    }
  }
);

/**
 * C4: Booking date/time correct
 */
const testBookingDateTime = defineTest(
  'C4-BOOKING-DATETIME',
  'Booking date and time stored correctly',
  'db-verification',
  async ({ policy }) => {
    const center = 'chamartin';
    const centerConfig = policy.centers[center];
    const treatmentType = policy.appointmentTypes[centerConfig.agendaId]?.tabaco;

    // Get first available slot
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const slots = await smartAgenda.getAvailability(
      centerConfig.agendaId,
      treatmentType,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    if (slots.length === 0 || slots[0].times.length === 0) {
      return { passed: true }; // Skip if no availability
    }

    const targetDate = slots[0].date;
    const targetTime = slots[0].times[0];

    const booking = await testDataManager.createTestBooking({
      center: center,
      treatment: 'tabaco',
      date: targetDate,
      time: targetTime
    });

    const bookingId = booking.appointmentId;

    try {
      const retrieved = await smartAgenda.getBooking(bookingId);

      const storedDate = retrieved.start_date?.split('T')[0];
      const storedTime = retrieved.start_date?.split('T')[1]?.substring(0, 5);

      if (storedDate !== targetDate) {
        return {
          passed: false,
          error: 'Date mismatch',
          expected: targetDate,
          actual: storedDate
        };
      }

      if (storedTime !== targetTime) {
        return {
          passed: false,
          error: 'Time mismatch',
          expected: targetTime,
          actual: storedTime
        };
      }

      return { passed: true, bookingId };
    } finally {
      await testDataManager.deleteTestBooking(bookingId);
    }
  }
);

/**
 * C5: Correct agenda/center association
 */
const testAgendaAssociation = defineTest(
  'C5-AGENDA-ASSOCIATION',
  'Booking associated with correct agenda',
  'db-verification',
  async ({ policy }) => {
    const centers = ['chamartin', 'barcelona', 'sevilla'];

    for (const center of centers) {
      const centerConfig = policy.centers[center];
      if (!centerConfig) continue;

      const booking = await testDataManager.createTestBooking({
        center: center,
        treatment: 'tabaco'
      });

      const bookingId = booking.appointmentId;

      try {
        const retrieved = await smartAgenda.getBooking(bookingId);

        if (retrieved.equipe_id !== centerConfig.agendaId) {
          await testDataManager.deleteTestBooking(bookingId);
          return {
            passed: false,
            error: `Wrong agenda for ${center}`,
            expected: centerConfig.agendaId,
            actual: retrieved.equipe_id
          };
        }
      } finally {
        await testDataManager.deleteTestBooking(bookingId);
      }
    }

    return { passed: true };
  }
);

/**
 * C6: Correct treatment type stored
 */
const testTreatmentTypeStored = defineTest(
  'C6-TREATMENT-TYPE',
  'Treatment type stored correctly',
  'db-verification',
  async ({ policy }) => {
    const center = 'chamartin';
    const centerConfig = policy.centers[center];
    const treatments = ['tabaco', 'cannabis', 'azucar'];

    for (const treatment of treatments) {
      const expectedTypeId = policy.appointmentTypes[centerConfig.agendaId]?.[treatment];
      if (!expectedTypeId) continue;

      const booking = await testDataManager.createTestBooking({
        center: center,
        treatment: treatment
      });

      const bookingId = booking.appointmentId;

      try {
        const retrieved = await smartAgenda.getBooking(bookingId);

        if (retrieved.presta_id !== expectedTypeId) {
          await testDataManager.deleteTestBooking(bookingId);
          return {
            passed: false,
            error: `Wrong treatment type for ${treatment}`,
            expected: expectedTypeId,
            actual: retrieved.presta_id
          };
        }
      } finally {
        await testDataManager.deleteTestBooking(bookingId);
      }
    }

    return { passed: true };
  }
);

/**
 * C7: Test data cleanup verification
 */
const testCleanupWorks = defineTest(
  'C7-CLEANUP-VERIFICATION',
  'Test data cleanup removes only test bookings',
  'db-verification',
  async ({ policy }) => {
    // Create multiple test bookings
    const bookings = [];

    for (let i = 0; i < 3; i++) {
      const booking = await testDataManager.createTestBooking({
        center: 'chamartin',
        treatment: 'tabaco'
      });
      bookings.push(booking.appointmentId);
      // Small delay
      await new Promise(r => setTimeout(r, 300));
    }

    // Count test bookings before cleanup
    const countBefore = await testDataManager.countTestBookings();

    // Delete all created test bookings
    for (const id of bookings) {
      await testDataManager.deleteTestBooking(id);
    }

    // Count after
    const countAfter = await testDataManager.countTestBookings();

    // Should have removed our test bookings
    const removed = countBefore - countAfter;

    if (removed < bookings.length) {
      return {
        passed: false,
        error: 'Not all test bookings were removed',
        expected: `${bookings.length} removed`,
        actual: `${removed} removed`
      };
    }

    return { passed: true };
  }
);

/**
 * C8: Booking status verification
 */
const testBookingStatus = defineTest(
  'C8-BOOKING-STATUS',
  'New bookings have confirmed status',
  'db-verification',
  async ({ policy }) => {
    const booking = await testDataManager.createTestBooking({
      center: 'chamartin',
      treatment: 'tabaco'
    });

    const bookingId = booking.appointmentId;

    try {
      const retrieved = await smartAgenda.getBooking(bookingId);

      // Status should be 'C' for confirmed
      if (retrieved.statut !== 'C') {
        return {
          passed: false,
          error: 'Booking not in confirmed status',
          expected: 'C (Confirmed)',
          actual: retrieved.statut
        };
      }

      return { passed: true, bookingId };
    } finally {
      await testDataManager.deleteTestBooking(bookingId);
    }
  }
);

module.exports = {
  name: 'Layer C - Database Verification',
  tests: [
    testBookingPersists,
    testBookingDeletion,
    testClientDataStored,
    testBookingDateTime,
    testAgendaAssociation,
    testTreatmentTypeStored,
    testCleanupWorks,
    testBookingStatus
  ]
};
