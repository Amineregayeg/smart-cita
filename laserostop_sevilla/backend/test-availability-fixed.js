/**
 * Test fixed availability endpoint
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
    console.log('✅ Token obtained');

    // Test getAvailabilities with POST to /service/getAvailabilities
    console.log('\n📋 Testing POST /service/getAvailabilities...');

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const startDate = today.toISOString().split('T')[0];
    const endDate = nextWeek.toISOString().split('T')[0];

    const requestBody = {
      pdo_type_rdv_id: '72',    // Valencia - Solo fumar type
      pdo_agenda_id: '10',       // Valencia center
      date_a_partir_de: startDate,
      date_fin: endDate
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const availResponse = await fetch(`${SMART_AGENDA_BASE_URL}/service/getAvailabilities`, {
      method: 'POST',
      headers: {
        'X-SMARTAPI-TOKEN': tokenData.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const availData = await availResponse.json();
    console.log('\n✅ Response status:', availResponse.status);

    if (availResponse.status === 200) {
      console.log(`\n✅ SUCCESS! Found ${availData.length} days with availability`);

      if (availData.length > 0) {
        console.log('\n📅 First day details:');
        console.log(JSON.stringify(availData[0], null, 2));
      }
    } else {
      console.log('❌ Error response:', JSON.stringify(availData, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
