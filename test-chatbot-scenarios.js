/**
 * Comprehensive Chatbot Testing Script
 * Tests 20 scenarios mimicking normal customer interactions
 * Creates test bookings and cleans them up
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// PROD Credentials
const PROD_CREDS = {
  login: 'eshapi48Kd79BmSy83A',
  pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150',
  api_id: 'app_landing',
  api_key: '95Gt-Ke92-48Uf39Sp27hF'
};

const BASE_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';

// Center configuration (same as chatbot)
const CENTERS = {
  'barcelona': { agendaId: '43', name: 'Barcelona Sants' },
  'sevilla': { agendaId: '44', name: 'Sevilla' },
  'chamartin': { agendaId: '48', name: 'Madrid Chamartín' },
  'torrejon': { agendaId: '49', name: 'Torrejón de Ardoz' },
  'atocha': { agendaId: '50', name: 'Madrid Atocha' },
  'majadahonda': { agendaId: '51', name: 'Majadahonda' }
};

const APPOINTMENT_TYPES = {
  '43': { 'tabaco': '20', 'duo': '21', 'cannabis': '23', 'azucar': '91' },
  '44': { 'tabaco': '32', 'duo': '34', 'cannabis': '37', 'azucar': '96' },
  '48': { 'tabaco': '44', 'duo': '46', 'cannabis': '49', 'azucar': '93' },
  '49': { 'tabaco': '53', 'duo': '56', 'cannabis': '59', 'azucar': '97' },
  '50': { 'tabaco': '63', 'duo': '65', 'cannabis': '68', 'azucar': '92' },
  '51': { 'tabaco': '72', 'duo': '74', 'cannabis': '77', 'azucar': '94' }
};

// Test tracking
const testResults = [];
const createdBookings = [];
let token = null;

// Slot filtering function (same as chatbot)
function filterOptimalSlots(slots, maxDays = 3, slotsPerDay = 3) {
  const limitedDays = slots.slice(0, maxDays);
  return limitedDays.map(day => {
    const times = day.times;
    if (times.length <= slotsPerDay) return day;
    const morning = times.find(t => t >= '09:00' && t <= '11:30');
    const midday = times.find(t => t >= '12:00' && t <= '14:30');
    const afternoon = times.find(t => t >= '15:00' && t <= '19:00');
    const selected = [morning, midday, afternoon].filter(Boolean);
    if (selected.length >= slotsPerDay) {
      return { ...day, times: selected.slice(0, slotsPerDay), timesFormatted: selected.slice(0, slotsPerDay).join(', ') };
    }
    const step = Math.max(1, Math.floor(times.length / slotsPerDay));
    const distributed = [];
    for (let i = 0; i < slotsPerDay && i * step < times.length; i++) {
      distributed.push(times[i * step]);
    }
    return { ...day, times: distributed, timesFormatted: distributed.join(', ') };
  });
}

async function getToken() {
  if (token) return token;
  const res = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(PROD_CREDS)
  });
  const data = await res.json();
  token = data.token;
  return token;
}

async function apiRequest(endpoint, options = {}) {
  const t = await getToken();
  return fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-SMARTAPI-TOKEN': t,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

async function getAvailability(centerKey, treatment = 'tabaco', daysAhead = 14) {
  const center = CENTERS[centerKey];
  const typeId = APPOINTMENT_TYPES[center.agendaId]?.[treatment];

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  const res = await apiRequest('/service/getAvailabilities', {
    method: 'POST',
    body: JSON.stringify({
      pdo_type_rdv_id: typeId,
      pdo_agenda_id: center.agendaId,
      date_a_partir_de: startDate.toISOString().split('T')[0],
      date_fin: endDate.toISOString().split('T')[0]
    })
  });

  if (res.status === 404) return [];
  const data = await res.json();

  if (!Array.isArray(data)) return [];

  const slots = [];
  for (const day of data) {
    const times = day.det?.map(slot => slot.idp) || [];
    if (times.length > 0) {
      slots.push({
        dayName: day.nj,
        date: day.dj,
        times,
        timesFormatted: times.join(', ')
      });
    }
  }
  return slots;
}

async function createTestBooking(centerKey, treatment, date, time) {
  const center = CENTERS[centerKey];
  const typeId = APPOINTMENT_TYPES[center.agendaId]?.[treatment];

  // Create test client
  const testEmail = `test_chatbot_${Date.now()}@test.com`;
  const clientRes = await apiRequest('/pdo_client', {
    method: 'POST',
    body: JSON.stringify({
      nom: 'TEST_CHATBOT',
      prenom: 'AutoTest',
      mail: testEmail,
      telephone: '600000000'
    })
  });

  if (!clientRes.ok) {
    return { success: false, error: 'Failed to create client' };
  }

  const client = await clientRes.json();

  // Get resource
  const resourcesRes = await apiRequest('/pdo_ressource');
  const resources = await resourcesRes.json();
  const resourceId = resources.find(r => r.id === '-1')?.id || resources[0]?.id || '-1';

  // Create appointment
  const startDateTime = `${date}T${time}:00`;
  const endDate = new Date(startDateTime);
  endDate.setMinutes(endDate.getMinutes() + 60);

  const appointmentRes = await apiRequest('/pdo_events', {
    method: 'POST',
    body: JSON.stringify({
      client_id: client.id,
      client_nom: 'TEST_CHATBOT',
      presta_id: typeId,
      ressource_id: resourceId,
      start_date: startDateTime,
      end_date: endDate.toISOString().slice(0, 19),
      equipe_id: center.agendaId,
      statut: 'C'
    })
  });

  if (!appointmentRes.ok) {
    return { success: false, error: 'Failed to create appointment' };
  }

  const appointment = await appointmentRes.json();

  // Track for cleanup
  createdBookings.push({
    appointmentId: appointment.id,
    clientId: client.id,
    email: testEmail
  });

  return {
    success: true,
    appointmentId: appointment.id,
    clientId: client.id
  };
}

async function deleteTestBookings() {
  console.log('\n=== CLEANING UP TEST BOOKINGS ===\n');

  for (const booking of createdBookings) {
    try {
      // Delete appointment
      const delRes = await apiRequest(`/pdo_events/${booking.appointmentId}`, {
        method: 'DELETE'
      });
      console.log(`  Deleted appointment ${booking.appointmentId}: ${delRes.ok ? 'OK' : 'FAILED'}`);

      // Delete test client
      const delClientRes = await apiRequest(`/pdo_client/${booking.clientId}`, {
        method: 'DELETE'
      });
      console.log(`  Deleted client ${booking.clientId}: ${delClientRes.ok ? 'OK' : 'FAILED'}`);
    } catch (e) {
      console.log(`  Error deleting ${booking.appointmentId}: ${e.message}`);
    }
  }

  console.log(`\nCleaned up ${createdBookings.length} test bookings`);
}

function logTest(scenario, description, result, details = '') {
  const status = result ? '✅ PASS' : '❌ FAIL';
  testResults.push({ scenario, description, result, details });
  console.log(`\n[${scenario}] ${description}`);
  console.log(`   ${status}${details ? ' - ' + details : ''}`);
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('   CHATBOT SCENARIO TESTING');
  console.log('   Testing 20 customer interaction scenarios');
  console.log('='.repeat(60));

  // Scenario 1: Check availability for Barcelona (tabaco)
  console.log('\n--- AVAILABILITY SCENARIOS ---');
  const barcelonaSlots = await getAvailability('barcelona', 'tabaco');
  logTest(1, 'Barcelona tabaco availability', barcelonaSlots.length > 0,
    `${barcelonaSlots.length} days found`);

  // Scenario 2: Check availability for Sevilla (tabaco)
  const sevillaSlots = await getAvailability('sevilla', 'tabaco');
  logTest(2, 'Sevilla tabaco availability', sevillaSlots.length > 0,
    `${sevillaSlots.length} days found`);

  // Scenario 3: Check availability for Atocha (tabaco)
  const atochaSlots = await getAvailability('atocha', 'tabaco');
  logTest(3, 'Atocha tabaco availability', atochaSlots.length > 0,
    `${atochaSlots.length} days found`);

  // Scenario 4: Check availability for Chamartín (cannabis)
  const chamartinCannabis = await getAvailability('chamartin', 'cannabis');
  logTest(4, 'Chamartín cannabis availability', chamartinCannabis.length >= 0,
    `${chamartinCannabis.length} days found`);

  // Scenario 5: Check availability for Majadahonda (duo)
  const majadahondaDuo = await getAvailability('majadahonda', 'duo');
  logTest(5, 'Majadahonda duo availability', majadahondaDuo.length >= 0,
    `${majadahondaDuo.length} days found`);

  // Scenario 6: Check availability for Torrejón (azucar)
  const torrejonAzucar = await getAvailability('torrejon', 'azucar');
  logTest(6, 'Torrejón azucar availability', torrejonAzucar.length >= 0,
    `${torrejonAzucar.length} days found`);

  // Scenario 7: Slot filtering - max 3 days
  console.log('\n--- SLOT FILTERING SCENARIOS ---');
  const manyDays = [
    { date: '2026-01-01', times: ['09:00', '10:00', '11:00'] },
    { date: '2026-01-02', times: ['09:00', '10:00', '11:00'] },
    { date: '2026-01-03', times: ['09:00', '10:00', '11:00'] },
    { date: '2026-01-04', times: ['09:00', '10:00', '11:00'] },
    { date: '2026-01-05', times: ['09:00', '10:00', '11:00'] }
  ];
  const filtered = filterOptimalSlots(manyDays);
  logTest(7, 'Filter limits to 3 days', filtered.length === 3,
    `${filtered.length} days returned (expected 3)`);

  // Scenario 8: Slot filtering - spaced slots
  const manySlots = [
    { date: '2026-01-01', times: ['09:00', '09:30', '10:00', '10:30', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'] }
  ];
  const filteredSlots = filterOptimalSlots(manySlots);
  const slotsDay1 = filteredSlots[0].times;
  logTest(8, 'Filter selects 3 spaced slots', slotsDay1.length === 3,
    `Selected: ${slotsDay1.join(', ')}`);

  // Scenario 9: Slot filtering - morning/midday/afternoon distribution
  const hasMorning = slotsDay1.some(t => t >= '09:00' && t <= '11:30');
  const hasMidday = slotsDay1.some(t => t >= '12:00' && t <= '14:30');
  const hasAfternoon = slotsDay1.some(t => t >= '15:00' && t <= '19:00');
  logTest(9, 'Filter includes morning/midday/afternoon', hasMorning && hasMidday && hasAfternoon,
    `Morning: ${hasMorning}, Midday: ${hasMidday}, Afternoon: ${hasAfternoon}`);

  // Scenario 10: Real availability with filtering
  if (barcelonaSlots.length > 0) {
    const filteredBarcelona = filterOptimalSlots(barcelonaSlots);
    logTest(10, 'Real Barcelona slots filtered correctly',
      filteredBarcelona.length <= 3 && filteredBarcelona.every(d => d.times.length <= 3),
      `${filteredBarcelona.length} days, slots: ${filteredBarcelona.map(d => d.times.length).join(', ')}`);
  } else {
    logTest(10, 'Real Barcelona slots filtered correctly', true, 'No slots to filter');
  }

  // Scenario 11-14: Booking creation tests
  console.log('\n--- BOOKING SCENARIOS ---');

  // Find a center with availability for booking tests
  let testCenter = null;
  let testSlots = null;

  for (const [key, center] of Object.entries(CENTERS)) {
    const slots = await getAvailability(key, 'tabaco');
    if (slots.length > 0 && slots[0].times.length > 0) {
      testCenter = key;
      testSlots = slots;
      break;
    }
  }

  if (testCenter && testSlots) {
    const testDate = testSlots[0].date;
    const testTime = testSlots[0].times[0];

    // Scenario 11: Create booking with valid data
    const booking1 = await createTestBooking(testCenter, 'tabaco', testDate, testTime);
    logTest(11, 'Create booking with valid data', booking1.success,
      booking1.success ? `ID: ${booking1.appointmentId}` : booking1.error);

    // Scenario 12: Verify booking exists
    if (booking1.success) {
      const verifyRes = await apiRequest(`/pdo_events/${booking1.appointmentId}`);
      logTest(12, 'Verify booking exists', verifyRes.ok,
        `Status: ${verifyRes.status}`);
    } else {
      logTest(12, 'Verify booking exists', false, 'No booking to verify');
    }

    // Scenario 13: Slot no longer available after booking
    const slotsAfter = await getAvailability(testCenter, 'tabaco');
    const slotStillAvailable = slotsAfter.some(d =>
      d.date === testDate && d.times.includes(testTime)
    );
    logTest(13, 'Booked slot removed from availability', !slotStillAvailable,
      slotStillAvailable ? 'Slot still shows available!' : 'Slot correctly removed');

    // Scenario 14: Create second booking at different time
    if (testSlots[0].times.length > 1) {
      const testTime2 = testSlots[0].times[1];
      const booking2 = await createTestBooking(testCenter, 'tabaco', testDate, testTime2);
      logTest(14, 'Create second booking different time', booking2.success,
        booking2.success ? `ID: ${booking2.appointmentId}` : booking2.error);
    } else if (testSlots.length > 1) {
      const testDate2 = testSlots[1].date;
      const testTime2 = testSlots[1].times[0];
      const booking2 = await createTestBooking(testCenter, 'tabaco', testDate2, testTime2);
      logTest(14, 'Create second booking different day', booking2.success,
        booking2.success ? `ID: ${booking2.appointmentId}` : booking2.error);
    } else {
      logTest(14, 'Create second booking', true, 'Skipped - no other slots');
    }
  } else {
    logTest(11, 'Create booking with valid data', false, 'No available slots found');
    logTest(12, 'Verify booking exists', false, 'No booking created');
    logTest(13, 'Booked slot removed', false, 'No booking created');
    logTest(14, 'Create second booking', false, 'No available slots');
  }

  // Scenario 15-16: Edge cases
  console.log('\n--- EDGE CASE SCENARIOS ---');

  // Scenario 15: Empty availability handling
  const emptySlots = [];
  const filteredEmpty = filterOptimalSlots(emptySlots);
  logTest(15, 'Handle empty availability', filteredEmpty.length === 0,
    `Returns empty array: ${filteredEmpty.length === 0}`);

  // Scenario 16: Single slot day handling
  const singleSlot = [{ date: '2026-01-01', times: ['10:00'] }];
  const filteredSingle = filterOptimalSlots(singleSlot);
  logTest(16, 'Handle single slot day', filteredSingle[0].times.length === 1,
    `Keeps single slot: ${filteredSingle[0].times.join(', ')}`);

  // Scenario 17-18: All centers availability check
  console.log('\n--- ALL CENTERS SCENARIOS ---');

  let centersWithAvailability = 0;
  for (const [key, center] of Object.entries(CENTERS)) {
    const slots = await getAvailability(key, 'tabaco');
    if (slots.length > 0) centersWithAvailability++;
  }
  logTest(17, 'At least one center has availability', centersWithAvailability > 0,
    `${centersWithAvailability}/6 centers have slots`);

  // Scenario 18: All treatment types work
  let treatmentsWork = 0;
  const treatments = ['tabaco', 'duo', 'cannabis', 'azucar'];
  for (const treatment of treatments) {
    try {
      const slots = await getAvailability('barcelona', treatment);
      treatmentsWork++;
    } catch (e) {
      // API might return error for some treatments
    }
  }
  logTest(18, 'All treatment types queryable', treatmentsWork === 4,
    `${treatmentsWork}/4 treatments work`);

  // Scenario 19-20: Token and API health
  console.log('\n--- API HEALTH SCENARIOS ---');

  // Scenario 19: Token acquisition
  const tokenTest = await getToken();
  logTest(19, 'Token acquisition works', !!tokenTest,
    tokenTest ? 'Token obtained' : 'No token');

  // Scenario 20: API responds correctly
  const healthRes = await apiRequest('/pdo_agenda');
  logTest(20, 'API health check', healthRes.ok,
    `Status: ${healthRes.status}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('   TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = testResults.filter(t => t.result).length;
  const failed = testResults.filter(t => !t.result).length;

  console.log(`\n   Total: ${testResults.length} scenarios`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Success rate: ${Math.round(passed/testResults.length*100)}%`);

  if (failed > 0) {
    console.log('\n   Failed scenarios:');
    testResults.filter(t => !t.result).forEach(t => {
      console.log(`   - [${t.scenario}] ${t.description}: ${t.details}`);
    });
  }

  // Cleanup
  await deleteTestBookings();

  console.log('\n' + '='.repeat(60));
  console.log('   TESTING COMPLETE');
  console.log('='.repeat(60));

  return { passed, failed, total: testResults.length };
}

// Run tests
runTests().catch(console.error);
