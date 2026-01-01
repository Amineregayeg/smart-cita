/**
 * T2: Overlap Prevention Tests
 * Verifies chatbot never books overlapping appointments
 */

const { defineTest, assert } = require('../../lib/testExecutor');
const chatbot = require('../../lib/chatbotClient');
const smartAgenda = require('../../lib/smartAgendaClient');
const testDataManager = require('../../lib/testDataManager');

/**
 * T2.1: No double-booking same slot
 */
const testNoDoubleBooking = defineTest(
  'T2.1-NO-DOUBLE-BOOKING',
  'Cannot book same time slot twice',
  'overlaps',
  async ({ policy }) => {
    const center = 'chamartin';
    const centerConfig = policy.centers[center];

    // Create first test booking
    const firstBooking = await testDataManager.createTestBooking({
      center: center,
      treatment: 'tabaco'
    });

    if (!firstBooking.appointmentId) {
      return {
        passed: false,
        error: 'Failed to create first test booking',
        expected: 'Booking created',
        actual: firstBooking
      };
    }

    // Store booking ID for cleanup
    const bookingId = firstBooking.appointmentId;

    try {
      // Try to book same slot via chatbot
      const result = await chatbot.conversation([
        `Quiero reservar una cita en ${center}`,
        'tabaco',
        `El ${firstBooking.date} a las ${firstBooking.time}`,
        'Test Overlap Check',
        'overlap-test@laserostop-test.com',
        '600000999'
      ]);

      const botResponse = result.lastResponse.assistant;

      // Should either refuse or offer alternative slot
      const refusedOrAlternative =
        botResponse.toLowerCase().includes('no disponible') ||
        botResponse.toLowerCase().includes('ocupad') ||
        botResponse.toLowerCase().includes('otra hora') ||
        botResponse.toLowerCase().includes('siguiente disponible');

      if (!refusedOrAlternative) {
        // Check if an overlap was actually created
        const overlaps = await smartAgenda.checkOverlaps(
          centerConfig.agendaId,
          firstBooking.date,
          firstBooking.time,
          // Calculate end time
          (() => {
            const [h, m] = firstBooking.time.split(':').map(Number);
            const endMinutes = h * 60 + m + 60;
            return `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;
          })()
        );

        if (overlaps.length > 1) {
          return {
            passed: false,
            error: 'Created overlapping booking',
            expected: 'No overlaps',
            actual: `${overlaps.length} bookings at same time`
          };
        }
      }

      return { passed: true, bookingId };
    } finally {
      // Cleanup handled by test executor
    }
  }
);

/**
 * T2.2: No partial overlap
 */
const testNoPartialOverlap = defineTest(
  'T2.2-NO-PARTIAL-OVERLAP',
  'Cannot book overlapping time ranges',
  'overlaps',
  async ({ policy }) => {
    const center = 'chamartin';
    const centerConfig = policy.centers[center];

    // Create test booking at 10:00-11:00
    const firstBooking = await testDataManager.createTestBooking({
      center: center,
      treatment: 'tabaco'
    });

    if (!firstBooking.appointmentId) {
      return {
        passed: false,
        error: 'Failed to create test booking',
        expected: 'Booking created',
        actual: null
      };
    }

    const bookingId = firstBooking.appointmentId;

    try {
      // Parse the time and try 30 minutes into the booking
      const [hour, minute] = firstBooking.time.split(':').map(Number);
      const overlapTime = `${hour}:${(minute + 30).toString().padStart(2, '0')}`;

      // Check API availability at overlap time
      const today = new Date();
      const apiSlots = await smartAgenda.getAvailability(
        centerConfig.agendaId,
        policy.appointmentTypes[centerConfig.agendaId]?.tabaco,
        firstBooking.date,
        firstBooking.date
      );

      // The overlap time should NOT be in available slots
      const overlapTimeAvailable = apiSlots.some(slot =>
        slot.date === firstBooking.date && slot.times.includes(overlapTime)
      );

      if (overlapTimeAvailable) {
        return {
          passed: false,
          error: `API returned ${overlapTime} as available when ${firstBooking.time} is booked`,
          expected: 'No overlapping slot in API',
          actual: 'Overlap slot returned'
        };
      }

      return { passed: true, bookingId };
    } finally {
      // Cleanup
    }
  }
);

/**
 * T2.3: DUO booking blocks two slots
 */
const testDuoBlocksTwoSlots = defineTest(
  'T2.3-DUO-BLOCKS-TWO',
  'DUO booking blocks sufficient time',
  'overlaps',
  async ({ policy }) => {
    const center = 'chamartin';
    const centerConfig = policy.centers[center];
    const duoTypeId = policy.appointmentTypes[centerConfig.agendaId]?.duo;
    const duoDuration = policy.treatments.duo?.duration || 120;

    // Get initial availability
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const beforeSlots = await smartAgenda.getAvailability(
      centerConfig.agendaId,
      duoTypeId,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    if (beforeSlots.length === 0 || beforeSlots[0].times.length === 0) {
      return {
        passed: true, // Skip if no availability
        error: 'No DUO slots available to test'
      };
    }

    const testDate = beforeSlots[0].date;
    const testTime = beforeSlots[0].times[0];

    // Create DUO booking via test data manager
    const duoBooking = await testDataManager.createTestBooking({
      center: center,
      treatment: 'duo',
      date: testDate,
      time: testTime
    });

    const bookingId = duoBooking.appointmentId;

    try {
      // Check that the DUO duration is blocked
      const afterSlots = await smartAgenda.getAvailability(
        centerConfig.agendaId,
        policy.appointmentTypes[centerConfig.agendaId]?.tabaco,
        testDate,
        testDate
      );

      // Calculate blocked range
      const [hour, minute] = testTime.split(':').map(Number);
      const startMinutes = hour * 60 + minute;
      const endMinutes = startMinutes + duoDuration;

      // Check each time in the blocked range
      for (let m = startMinutes; m < endMinutes; m += 30) {
        const blockedTime = `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;

        const stillAvailable = afterSlots.some(slot =>
          slot.date === testDate && slot.times.includes(blockedTime)
        );

        if (stillAvailable) {
          return {
            passed: false,
            error: `Time ${blockedTime} still available after DUO booking at ${testTime}`,
            expected: 'Blocked for DUO duration',
            actual: 'Still available'
          };
        }
      }

      return { passed: true, bookingId };
    } finally {
      // Cleanup
    }
  }
);

/**
 * T2.4: Sequential bookings allowed
 */
const testSequentialAllowed = defineTest(
  'T2.4-SEQUENTIAL-ALLOWED',
  'Back-to-back bookings are allowed',
  'overlaps',
  async ({ policy }) => {
    const center = 'chamartin';
    const centerConfig = policy.centers[center];
    const tabacoTypeId = policy.appointmentTypes[centerConfig.agendaId]?.tabaco;
    const tabacoDuration = policy.treatments.tabaco?.duration || 60;

    // Get availability
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const slots = await smartAgenda.getAvailability(
      centerConfig.agendaId,
      tabacoTypeId,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    if (slots.length === 0 || slots[0].times.length < 2) {
      return { passed: true }; // Skip if not enough slots
    }

    const testDate = slots[0].date;
    const firstTime = slots[0].times[0];

    // Create first booking
    const firstBooking = await testDataManager.createTestBooking({
      center: center,
      treatment: 'tabaco',
      date: testDate,
      time: firstTime
    });

    const bookingId = firstBooking.appointmentId;

    try {
      // Calculate next slot time
      const [hour, minute] = firstTime.split(':').map(Number);
      const nextSlotMinutes = hour * 60 + minute + tabacoDuration;
      const nextSlotTime = `${Math.floor(nextSlotMinutes / 60).toString().padStart(2, '0')}:${(nextSlotMinutes % 60).toString().padStart(2, '0')}`;

      // Check next slot is still available
      const afterSlots = await smartAgenda.getAvailability(
        centerConfig.agendaId,
        tabacoTypeId,
        testDate,
        testDate
      );

      const nextSlotAvailable = afterSlots.some(slot =>
        slot.date === testDate && slot.times.includes(nextSlotTime)
      );

      // Sequential slot should be available (no overlap)
      return assert.isTrue(
        nextSlotAvailable,
        `Next slot ${nextSlotTime} should be available after ${firstTime} booking`
      );
    } finally {
      // Cleanup
    }
  }
);

module.exports = {
  name: 'T2 - Overlap Prevention',
  tests: [
    testNoDoubleBooking,
    testNoPartialOverlap,
    testDuoBlocksTwoSlots,
    testSequentialAllowed
  ]
};
