/**
 * Discover available Smart Agenda API endpoints
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
    console.log('Token data:', JSON.stringify(tokenData, null, 2));

    // Try different availability-related endpoints
    const endpointsToTry = [
      '/getAvailabilities',
      '/availabilities',
      '/disponibilites',
      '/pdo_disponibilite',
      '/creneaux',
      '/slots',
      '/rdv_disponibles',
      '/agenda_disponibilites'
    ];

    console.log('\n📋 Testing potential availability endpoints...\n');

    for (const endpoint of endpointsToTry) {
      try {
        console.log(`Testing: ${endpoint}`);
        const response = await fetch(`${SMART_AGENDA_BASE_URL}${endpoint}`, {
          headers: { 'X-SMARTAPI-TOKEN': tokenData.token }
        });

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          data = text;
        }

        console.log(`  Status: ${response.status}`);
        if (response.status === 200) {
          console.log(`  ✅ SUCCESS! Response:`, JSON.stringify(data, null, 2).substring(0, 500));
        } else {
          console.log(`  ❌ Error:`, typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data));
        }
      } catch (error) {
        console.log(`  ❌ Failed:`, error.message);
      }
      console.log('');
    }

    // Also try to get the API documentation or help
    console.log('\n📋 Checking for API documentation endpoints...\n');
    const docEndpoints = ['/help', '/doc', '/api', '/endpoints', '/'];

    for (const endpoint of docEndpoints) {
      try {
        console.log(`Testing: ${endpoint}`);
        const response = await fetch(`${SMART_AGENDA_BASE_URL}${endpoint}`, {
          headers: { 'X-SMARTAPI-TOKEN': tokenData.token }
        });

        console.log(`  Status: ${response.status}`);
        if (response.status === 200) {
          const text = await response.text();
          console.log(`  Response preview:`, text.substring(0, 300));
        }
      } catch (error) {
        console.log(`  Failed:`, error.message);
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
