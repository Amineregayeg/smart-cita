/**
 * Check opening hours configuration
 */
require('dotenv').config({ path: './.env' });
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SMART_AGENDA_BASE_URL = process.env.SMART_AGENDA_BASE_URL;
const CREDENTIALS = {
  login: process.env.SMART_AGENDA_LOGIN,
  pwd: process.env.SMART_AGENDA_PWD,
  api_id: process.env.SMART_AGENDA_API_ID,
  api_key: process.env.SMART_AGENDA_API_KEY
};

async function test() {
  try {
    // Get token
    console.log('Getting token...');
    const tokenResponse = await fetch(`${SMART_AGENDA_BASE_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDENTIALS)
    });

    const tokenData = await tokenResponse.json();
    console.log('✅ Token obtained\n');

    // Check pdo_events_ouverture (opening hours/slots)
    console.log('📋 Checking opening hours/slots (pdo_events_ouverture)...');
    const openingResponse = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_events_ouverture`, {
      headers: { 'X-SMARTAPI-TOKEN': tokenData.token }
    });

    const openingHours = await openingResponse.json();
    console.log(`Found ${openingHours.length} opening hour records\n`);

    if (openingHours.length > 0) {
      console.log('Sample opening hours:');
      openingHours.slice(0, 5).forEach(oh => {
        console.log(`  - Agenda: ${oh.equipe_id}, Type: ${oh.presta_id}, Start: ${oh.start_date}, End: ${oh.end_date}`);
      });
    }

    // Test with center ID = 0 (all centers)
    console.log('\n📋 Testing availability with center ID = 0 (all centers)...');
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(today.getMonth() + 1);

    const requestBody = {
      pdo_type_rdv_id: '72',
      pdo_agenda_id: '0',  // All centers
      date_a_partir_de: today.toISOString().split('T')[0],
      date_fin: nextMonth.toISOString().split('T')[0]
    };

    console.log('Request:', JSON.stringify(requestBody, null, 2));

    const availResponse = await fetch(`${SMART_AGENDA_BASE_URL}/service/getAvailabilities`, {
      method: 'POST',
      headers: {
        'X-SMARTAPI-TOKEN': tokenData.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const availData = await availResponse.json();
    console.log(`Response status: ${availResponse.status}`);

    if (availResponse.status === 200 && availData.length > 0) {
      console.log(`\n✅ Found ${availData.length} days with availability!`);
      console.log('\nFirst day:');
      console.log(JSON.stringify(availData[0], null, 2).substring(0, 1000));
    } else {
      console.log('Response:', JSON.stringify(availData, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
