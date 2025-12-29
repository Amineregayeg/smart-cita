/**
 * Test Sevilla availability for first week of January
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

// Sevilla configuration
const SEVILLA = {
  agendaId: '44',
  tabacoTypeId: '32'
};

async function test() {
  try {
    console.log('=== SEVILLA AVAILABILITY TEST ===\n');
    console.log('Base URL:', SMART_AGENDA_BASE_URL);
    console.log('Has login:', !!CREDENTIALS.login);
    console.log('Has pwd:', !!CREDENTIALS.pwd);
    console.log('Has api_id:', !!CREDENTIALS.api_id);
    console.log('Has api_key:', !!CREDENTIALS.api_key);

    // Get token
    console.log('\n=== 1. GETTING TOKEN ===');
    const tokenResponse = await fetch(`${SMART_AGENDA_BASE_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDENTIALS)
    });

    console.log('Token response status:', tokenResponse.status);
    const tokenRaw = await tokenResponse.text();
    console.log('Token response:', tokenRaw.substring(0, 200));

    let token;
    try {
      const tokenData = JSON.parse(tokenRaw);
      token = tokenData.token;
      console.log('Token obtained:', token ? 'Yes' : 'No');
    } catch (e) {
      console.log('Failed to parse token:', e.message);
      return;
    }

    // Check Sevilla availability for first week of January
    console.log('\n=== 2. SEVILLA AVAILABILITY (Jan 1-7, 2026) ===');
    const availRequest = {
      pdo_type_rdv_id: SEVILLA.tabacoTypeId,
      pdo_agenda_id: SEVILLA.agendaId,
      date_a_partir_de: '2026-01-01',
      date_fin: '2026-01-07'
    };

    console.log('Request:', JSON.stringify(availRequest, null, 2));

    const availResponse = await fetch(`${SMART_AGENDA_BASE_URL}/service/getAvailabilities`, {
      method: 'POST',
      headers: {
        'X-SMARTAPI-TOKEN': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(availRequest)
    });

    console.log('\nResponse status:', availResponse.status);
    const availRaw = await availResponse.text();
    console.log('Response (first 1000 chars):', availRaw.substring(0, 1000));

    try {
      const availability = JSON.parse(availRaw);
      if (Array.isArray(availability)) {
        console.log('\n=== AVAILABLE SLOTS ===');
        availability.forEach(day => {
          const times = day.det?.map(d => d.idp).join(', ') || 'none';
          console.log(`  ${day.dj} (${day.nj}): ${times}`);
        });
      } else {
        console.log('Not an array:', typeof availability);
        console.log(JSON.stringify(availability, null, 2));
      }
    } catch (e) {
      console.log('Failed to parse availability:', e.message);
    }

    // Also check opening hours for Sevilla
    console.log('\n=== 3. SEVILLA OPENING HOURS (pdo_events_ouverture) ===');
    const openingResponse = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_events_ouverture`, {
      headers: { 'X-SMARTAPI-TOKEN': token }
    });

    console.log('Opening hours response status:', openingResponse.status);

    if (openingResponse.ok) {
      const openingHours = await openingResponse.json();
      const sevillaOpening = openingHours.filter(oh => oh.equipe_id === SEVILLA.agendaId);
      console.log(`Total Sevilla opening slots: ${sevillaOpening.length}`);

      if (sevillaOpening.length > 0) {
        console.log('\nSample Sevilla opening slots:');
        sevillaOpening.slice(0, 10).forEach(oh => {
          console.log(`  Type: ${oh.presta_id}, Start: ${oh.start_date}, End: ${oh.end_date}`);
        });
      }

      // Filter for January 2026
      const janOpening = sevillaOpening.filter(oh => oh.start_date && oh.start_date.startsWith('2026-01'));
      console.log(`\nSevilla slots in January 2026: ${janOpening.length}`);
      if (janOpening.length > 0) {
        janOpening.slice(0, 10).forEach(oh => {
          console.log(`  Type: ${oh.presta_id}, Start: ${oh.start_date}, End: ${oh.end_date}`);
        });
      }
    } else {
      console.log('Failed to get opening hours:', openingResponse.status);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
