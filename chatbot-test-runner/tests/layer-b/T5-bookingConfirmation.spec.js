/**
 * T5: Booking Confirmation Tests
 * Verifies bookings are properly created in database
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');
const smartAgenda = require('../../lib/smartAgendaClient');
const testDataManager = require('../../lib/testDataManager');

/**
 * T5.1: Complete booking creates DB entry
 */
const testBookingCreatesEntry = defineTest(
  'T5.1-BOOKING-DB-ENTRY',
  'Completed booking creates database entry',
  'booking-confirmation',
  async ({ policy }) => {
    const center = 'madrid';
    const centerConfig = policy.centers[center];

    // Complete a full booking flow
    const result = await chatbot.completeBookingFlow({
      center: center,
      treatment: 'tabaco',
      testData: true
    });

    if (!result.bookingCreated || !result.appointmentId) {
      return {
        passed: false,
        error: 'Booking flow did not return appointmentId',
        expected: 'appointmentId returned',
        actual: result
      };
    }

    const bookingId = result.appointmentId;

    try {
      // Verify booking exists in database
      const booking = await smartAgenda.getBooking(bookingId);

      if (!booking) {
        return {
          passed: false,
          error: `Booking ${bookingId} not found in database`,
          expected: 'Booking exists',
          actual: 'Not found'
        };
      }

      // Verify booking has correct client data
      const testData = result.testData;
      const emailMatch = booking.client_mail === testData.email;

      if (!emailMatch) {
        return {
          passed: false,
          error: 'Booking email does not match',
          expected: testData.email,
          actual: booking.client_mail
        };
      }

      return { passed: true, bookingId };
    } finally {
      // Cleanup
      if (bookingId) {
        await testDataManager.deleteTestBooking(bookingId);
      }
    }
  }
);

/**
 * T5.2: Booking has correct center/agenda
 */
const testBookingCorrectCenter = defineTest(
  'T5.2-BOOKING-CORRECT-CENTER',
  'Booking is associated with correct center',
  'booking-confirmation',
  async ({ policy }) => {
    const center = 'barcelona';
    const centerConfig = policy.centers[center];

    const result = await chatbot.completeBookingFlow({
      center: center,
      treatment: 'tabaco',
      testData: true
    });

    if (!result.appointmentId) {
      return {
        passed: false,
        error: 'No appointment created',
        expected: 'Appointment ID',
        actual: null
      };
    }

    const bookingId = result.appointmentId;

    try {
      const booking = await smartAgenda.getBooking(bookingId);

      return assert.equals(
        booking.equipe_id,
        centerConfig.agendaId,
        `Booking should be for ${center} (agenda ${centerConfig.agendaId})`
      );
    } finally {
      if (bookingId) {
        await testDataManager.deleteTestBooking(bookingId);
      }
    }
  }
);

/**
 * T5.3: Booking has correct treatment type
 */
const testBookingCorrectTreatment = defineTest(
  'T5.3-BOOKING-CORRECT-TREATMENT',
  'Booking has correct treatment type',
  'booking-confirmation',
  async ({ policy }) => {
    const center = 'madrid';
    const treatment = 'cannabis';
    const centerConfig = policy.centers[center];
    const expectedTypeId = policy.appointmentTypes[centerConfig.agendaId]?.[treatment];

    const result = await chatbot.completeBookingFlow({
      center: center,
      treatment: treatment,
      testData: true
    });

    if (!result.appointmentId) {
      return {
        passed: false,
        error: 'No appointment created',
        expected: 'Appointment ID',
        actual: null
      };
    }

    const bookingId = result.appointmentId;

    try {
      const booking = await smartAgenda.getBooking(bookingId);

      return assert.equals(
        booking.presta_id,
        expectedTypeId,
        `Booking should have ${treatment} type (${expectedTypeId})`
      );
    } finally {
      if (bookingId) {
        await testDataManager.deleteTestBooking(bookingId);
      }
    }
  }
);

/**
 * T5.4: Booking has correct date/time
 */
const testBookingCorrectDateTime = defineTest(
  'T5.4-BOOKING-CORRECT-DATETIME',
  'Booking has correct date and time',
  'booking-confirmation',
  async ({ policy }) => {
    const center = 'madrid';
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

    const result = await chatbot.completeBookingFlow({
      center: center,
      treatment: 'tabaco',
      date: targetDate,
      time: targetTime,
      testData: true
    });

    if (!result.appointmentId) {
      return {
        passed: false,
        error: 'No appointment created',
        expected: 'Appointment ID',
        actual: null
      };
    }

    const bookingId = result.appointmentId;

    try {
      const booking = await smartAgenda.getBooking(bookingId);
      const bookingDate = booking.start_date?.split('T')[0];
      const bookingTime = booking.start_date?.split('T')[1]?.substring(0, 5);

      if (bookingDate !== targetDate) {
        return {
          passed: false,
          error: 'Booking date mismatch',
          expected: targetDate,
          actual: bookingDate
        };
      }

      if (bookingTime !== targetTime) {
        return {
          passed: false,
          error: 'Booking time mismatch',
          expected: targetTime,
          actual: bookingTime
        };
      }

      return { passed: true, bookingId };
    } finally {
      if (bookingId) {
        await testDataManager.deleteTestBooking(bookingId);
      }
    }
  }
);

/**
 * T5.5: Booking status is confirmed
 */
const testBookingStatusConfirmed = defineTest(
  'T5.5-BOOKING-STATUS',
  'Booking has confirmed status',
  'booking-confirmation',
  async ({ policy }) => {
    const center = 'madrid';

    const result = await chatbot.completeBookingFlow({
      center: center,
      treatment: 'tabaco',
      testData: true
    });

    if (!result.appointmentId) {
      return {
        passed: false,
        error: 'No appointment created',
        expected: 'Appointment ID',
        actual: null
      };
    }

    const bookingId = result.appointmentId;

    try {
      const booking = await smartAgenda.getBooking(bookingId);

      // Status should be 'C' for confirmed
      return assert.equals(
        booking.statut,
        'C',
        'Booking status should be Confirmed (C)'
      );
    } finally {
      if (bookingId) {
        await testDataManager.deleteTestBooking(bookingId);
      }
    }
  }
);

/**
 * T5.6: Confirmation message contains details
 */
const testConfirmationMessage = defineTest(
  'T5.6-CONFIRMATION-MESSAGE',
  'Confirmation message includes booking details',
  'booking-confirmation',
  async ({ policy }) => {
    const center = 'madrid';

    const result = await chatbot.completeBookingFlow({
      center: center,
      treatment: 'tabaco',
      testData: true
    });

    const response = result.assistant || '';

    // Confirmation should include key details
    const hasDate = /\d{1,2}.*(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i.test(response);
    const hasTime = /\d{1,2}:\d{2}/.test(response);
    const hasCenter = response.toLowerCase().includes('madrid');
    const hasConfirmation = response.toLowerCase().includes('confirmad') || response.toLowerCase().includes('reservad');

    if (!hasConfirmation) {
      return {
        passed: false,
        error: 'Confirmation message missing confirmation language',
        expected: 'confirmado/reservado',
        actual: response.substring(0, 200)
      };
    }

    if (result.appointmentId) {
      await testDataManager.deleteTestBooking(result.appointmentId);
    }

    return { passed: true, bookingId: result.appointmentId };
  }
);

module.exports = {
  name: 'T5 - Booking Confirmation',
  tests: [
    testBookingCreatesEntry,
    testBookingCorrectCenter,
    testBookingCorrectTreatment,
    testBookingCorrectDateTime,
    testBookingStatusConfirmed,
    testConfirmationMessage
  ]
};
