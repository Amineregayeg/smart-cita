/**
 * Test script to verify:
 * 1. If booking ID 92 exists
 * 2. Compare availability API vs actual booked slots
 * 3. Check pdo_events_ouverture (planificar)
 */
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SMART_AGENDA_BASE_URL = process.env.SMART_AGENDA_BASE_URL || 'https://www.smartagenda.fr/pro/laserostop-esh/api';
const CREDENTIALS = {
  login: process.env.SMART_AGENDA_LOGIN,
  pwd: process.env.SMART_AGENDA_PWD,
  api_id: process.env.SMART_AGENDA_API_ID,
  api_key: process.env.SMART_AGENDA_API_KEY
};

async function getToken() {
  const response = await fetch(`${SMART_AGENDA_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS)
  });
  const data = await response.json();
  return data.token;
}

async function test() {
  try {
    console.log('=== SMART AGENDA VERIFICATION TEST ===\n');

    const token = await getToken();
    console.log('✅ Token obtained\n');

    // 1. Check if booking ID 92 exists
    console.log('=== 1. CHECKING BOOKING ID 92 ===');
    const event92Response = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_events/92`, {
      headers: { 'X-SMARTAPI-TOKEN': token }
    });

    if (event92Response.ok) {
      const event92 = await event92Response.json();
      console.log('✅ Booking 92 EXISTS:');
      console.log(JSON.stringify(event92, null, 2));
    } else {
      console.log('❌ Booking 92 NOT FOUND - Status:', event92Response.status);
    }

    // 2. Get recent bookings (last 20)
    console.log('\n=== 2. RECENT BOOKINGS ===');
    const eventsResponse = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_events`, {
      headers: { 'X-SMARTAPI-TOKEN': token }
    });
    const eventsRaw = await eventsResponse.text();
    console.log(`Events response status: ${eventsResponse.status}`);
    console.log(`Events raw (first 500 chars): ${eventsRaw.substring(0, 500)}`);

    let events = [];
    try {
      events = JSON.parse(eventsRaw);
      if (!Array.isArray(events)) {
        console.log('Events is not an array:', typeof events);
        events = [];
      }
    } catch (e) {
      console.log('Failed to parse events:', e.message);
    }
    console.log(`Total bookings: ${events.length}`);

    // Show last 10 bookings
    const recentEvents = events.slice(-10);
    console.log('\nLast 10 bookings:');
    recentEvents.forEach(e => {
      console.log(`  ID: ${e.id}, Client: ${e.client_id}, Date: ${e.start_date}, Status: ${e.statut}, Center: ${e.equipe_id}`);
    });

    // 3. Check availability for Barcelona (ID 43) for next week
    console.log('\n=== 3. AVAILABILITY CHECK (Barcelona, Dec 30-31) ===');
    const availRequest = {
      pdo_type_rdv_id: '20', // tabaco
      pdo_agenda_id: '43',   // Barcelona
      date_a_partir_de: '2025-12-30',
      date_fin: '2026-01-03'
    };

    console.log('Request:', JSON.stringify(availRequest));

    const availResponse = await fetch(`${SMART_AGENDA_BASE_URL}/service/getAvailabilities`, {
      method: 'POST',
      headers: {
        'X-SMARTAPI-TOKEN': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(availRequest)
    });

    const availability = await availResponse.json();
    console.log(`\nAvailability response (${availResponse.status}):`);

    if (Array.isArray(availability)) {
      availability.forEach(day => {
        const times = day.det?.map(d => d.idp).join(', ') || 'none';
        console.log(`  ${day.dj} (${day.nj}): ${times}`);
      });
    } else {
      console.log(JSON.stringify(availability, null, 2));
    }

    // 4. Check bookings for Barcelona on Dec 30
    console.log('\n=== 4. EXISTING BOOKINGS FOR BARCELONA DEC 30 ===');
    const barcelonaBookings = events.filter(e =>
      e.equipe_id === '43' &&
      e.start_date &&
      e.start_date.startsWith('2025-12-30')
    );

    if (barcelonaBookings.length > 0) {
      console.log('Bookings found:');
      barcelonaBookings.forEach(b => {
        console.log(`  ID: ${b.id}, Time: ${b.start_date}, Client: ${b.client_nom || b.client_id}, Status: ${b.statut}`);
      });
    } else {
      console.log('No bookings for Barcelona on Dec 30');
    }

    // 5. Check pdo_events_ouverture (opening hours / planificar)
    console.log('\n=== 5. OPENING HOURS (pdo_events_ouverture) - PLANIFICAR ===');
    const openingResponse = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_events_ouverture`, {
      headers: { 'X-SMARTAPI-TOKEN': token }
    });

    const openingHours = await openingResponse.json();
    console.log(`Total opening hour slots: ${openingHours.length}`);

    // Filter for Barcelona (agenda 43)
    const barcelonaOpening = openingHours.filter(oh => oh.equipe_id === '43');
    console.log(`\nBarcelona opening slots: ${barcelonaOpening.length}`);

    if (barcelonaOpening.length > 0) {
      console.log('\nSample Barcelona opening slots:');
      barcelonaOpening.slice(0, 5).forEach(oh => {
        console.log(`  Type: ${oh.presta_id}, Start: ${oh.start_date}, End: ${oh.end_date}`);
      });
    }

    // 6. Compare: Are there slots in getAvailabilities that are already booked?
    console.log('\n=== 6. CONFLICT CHECK ===');
    console.log('Checking if any "available" slots have existing bookings...');

    let conflicts = 0;
    if (Array.isArray(availability)) {
      for (const day of availability) {
        if (!day.det) continue;
        for (const slot of day.det) {
          const slotStart = `${day.dj}T${slot.idp}:00`;
          const conflicting = events.find(e =>
            e.equipe_id === '43' &&
            e.start_date === slotStart
          );
          if (conflicting) {
            console.log(`  ⚠️ CONFLICT: ${slotStart} shown as available but booking ${conflicting.id} exists`);
            conflicts++;
          }
        }
      }
    }

    if (conflicts === 0) {
      console.log('✅ No conflicts found - availability API is correct');
    } else {
      console.log(`\n❌ Found ${conflicts} conflicts!`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
