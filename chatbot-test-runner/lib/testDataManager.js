/**
 * Test Data Manager
 * Handles safe creation and cleanup of test data
 * CRITICAL: Never touches real production data
 */

require('dotenv').config();
const smartAgenda = require('./smartAgendaClient');
const policy = require('../config/policy.json');

// Test data patterns - ONLY these patterns are used/deleted
const TEST_PATTERNS = {
  email: /^test-automated-\d+@laserostop-test\.com$/,
  name: /^Test Automatizado \d+$/,
  phone: /^600000\d{3}$/
};

/**
 * Generate test data with identifiable patterns
 */
function generateTestData() {
  const timestamp = Date.now();
  return {
    email: `test-automated-${timestamp}@laserostop-test.com`,
    fullName: `Test Automatizado ${timestamp}`,
    phone: `600000${String(timestamp).slice(-3)}`,
    timestamp: timestamp
  };
}

/**
 * Check if a booking is a test booking (SAFETY CHECK)
 */
function isTestBooking(booking) {
  if (!booking) return false;

  const email = booking.client_mail || '';
  const name = `${booking.client_prenom || ''} ${booking.client_nom || ''}`.trim();
  const phone = booking.client_telephone || '';

  // Check against all test patterns
  const isTestEmail = TEST_PATTERNS.email.test(email);
  const isTestName = TEST_PATTERNS.name.test(name);
  const isTestPhone = TEST_PATTERNS.phone.test(phone);

  // Also check for common test patterns
  const isGenericTest =
    email.includes('@test.com') ||
    email.includes('@example.com') ||
    email.includes('@laserostop-test.com') ||
    name.toLowerCase().includes('test automatizado') ||
    name.toLowerCase().includes('test automated');

  return isTestEmail || isTestName || isTestPhone || isGenericTest;
}

/**
 * Create a test booking (safe - uses test data patterns)
 */
async function createTestBooking(options) {
  const testData = generateTestData();
  const centerConfig = policy.centers[options.center];

  if (!centerConfig) {
    throw new Error(`Invalid center: ${options.center}`);
  }

  const treatment = options.treatment || 'tabaco';
  const typeId = policy.appointmentTypes[centerConfig.agendaId]?.[treatment];

  if (!typeId) {
    throw new Error(`Invalid treatment: ${treatment}`);
  }

  const duration = policy.treatments[treatment]?.duration || 60;

  // Get next available slot if date/time not specified
  let date = options.date;
  let time = options.time;

  if (!date || !time) {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 14);

    const availability = await smartAgenda.getAvailability(
      centerConfig.agendaId,
      typeId,
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    if (availability.length > 0 && availability[0].times.length > 0) {
      date = availability[0].date;
      time = availability[0].times[0];
    } else {
      throw new Error(`No availability found for ${options.center}`);
    }
  }

  const result = await smartAgenda.createBooking({
    agendaId: centerConfig.agendaId,
    typeId: typeId,
    date: date,
    time: time,
    duration: duration,
    fullName: testData.fullName,
    email: testData.email,
    phone: testData.phone
  });

  return {
    ...result,
    testData: testData,
    center: options.center,
    treatment: treatment,
    date: date,
    time: time
  };
}

/**
 * Delete a test booking (with safety check)
 */
async function deleteTestBooking(bookingId) {
  // CRITICAL: First verify it's a test booking
  const booking = await smartAgenda.getBooking(bookingId);

  if (!booking) {
    console.log(`[CLEANUP] Booking ${bookingId} not found (already deleted?)`);
    return { success: true, reason: 'not_found' };
  }

  if (!isTestBooking(booking)) {
    console.error(`[SAFETY] REFUSING to delete non-test booking: ${bookingId}`);
    console.error(`[SAFETY] Email: ${booking.client_mail}, Name: ${booking.client_prenom} ${booking.client_nom}`);
    return { success: false, reason: 'not_test_booking' };
  }

  // Safe to delete
  const deleted = await smartAgenda.deleteBooking(bookingId);

  if (deleted) {
    console.log(`[CLEANUP] Deleted test booking: ${bookingId}`);
    return { success: true, reason: 'deleted' };
  } else {
    console.error(`[CLEANUP] Failed to delete booking: ${bookingId}`);
    return { success: false, reason: 'delete_failed' };
  }
}

/**
 * Cleanup all test bookings (daily sweep)
 */
async function cleanupAllTestBookings() {
  console.log('[CLEANUP] Starting daily test data cleanup...');

  const today = new Date();
  const pastDate = new Date();
  pastDate.setDate(today.getDate() - 30);
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + 60);

  const allBookings = await smartAgenda.getAllBookings(
    pastDate.toISOString().split('T')[0],
    futureDate.toISOString().split('T')[0]
  );

  let cleaned = 0;
  let skipped = 0;
  let errors = 0;

  for (const booking of allBookings) {
    if (isTestBooking(booking)) {
      try {
        const result = await deleteTestBooking(booking.id);
        if (result.success) {
          cleaned++;
        } else {
          errors++;
        }
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`[CLEANUP] Error deleting ${booking.id}:`, error.message);
        errors++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`[CLEANUP] Complete: ${cleaned} deleted, ${skipped} skipped (real data), ${errors} errors`);

  return { cleaned, skipped, errors };
}

/**
 * Get count of test bookings in system
 */
async function countTestBookings() {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + 60);

  const allBookings = await smartAgenda.getAllBookings(
    today.toISOString().split('T')[0],
    futureDate.toISOString().split('T')[0]
  );

  return allBookings.filter(isTestBooking).length;
}

module.exports = {
  TEST_PATTERNS,
  generateTestData,
  isTestBooking,
  createTestBooking,
  deleteTestBooking,
  cleanupAllTestBookings,
  countTestBookings
};
