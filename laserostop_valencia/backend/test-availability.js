/**
 * Test Smart Agenda getAvailabilities endpoint
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

    // Test 1: Get resources
    console.log('\n📋 Testing /pdo_ressource...');
    const resourcesResponse = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_ressource`, {
      headers: { 'X-SMARTAPI-TOKEN': tokenData.token }
    });
    const resources = await resourcesResponse.json();
    console.log(`Found ${resources.length} resources`);
    resources.forEach(r => {
      console.log(`  - ID: ${r.id}, Nom: ${r.nom}, Prenom: ${r.prenom}`);
    });

    // Test 2: Get availability WITHOUT filters (see what Smart Agenda returns)
    console.log('\n📋 Testing /getAvailabilities (no filters)...');
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const startDate = today.toISOString().split('T')[0];
    const endDate = nextWeek.toISOString().split('T')[0];

    const params1 = new URLSearchParams({
      date_a_partir_de: startDate,
      date_fin: endDate
    });

    console.log(`Params: date_a_partir_de=${startDate}, date_fin=${endDate}`);
    const avail1Response = await fetch(`${SMART_AGENDA_BASE_URL}/getAvailabilities?${params1.toString()}`, {
      headers: { 'X-SMARTAPI-TOKEN': tokenData.token }
    });
    const avail1 = await avail1Response.json();
    console.log('Response:', JSON.stringify(avail1, null, 2));

    // Test 3: Get availability WITH center filter (Valencia = 10)
    console.log('\n📋 Testing /getAvailabilities with center filter (Valencia=10)...');
    const params2 = new URLSearchParams({
      date_a_partir_de: startDate,
      date_fin: endDate,
      pdo_agenda_id: '10'
    });

    console.log(`Params: ${params2.toString()}`);
    const avail2Response = await fetch(`${SMART_AGENDA_BASE_URL}/getAvailabilities?${params2.toString()}`, {
      headers: { 'X-SMARTAPI-TOKEN': tokenData.token }
    });
    const avail2 = await avail2Response.json();
    console.log('Response:', JSON.stringify(avail2, null, 2));

    // Test 4: Get availability WITH center AND type filter
    console.log('\n📋 Testing /getAvailabilities with center + type filter (Valencia=10, Type=72)...');
    const params3 = new URLSearchParams({
      date_a_partir_de: startDate,
      date_fin: endDate,
      pdo_agenda_id: '10',
      pdo_type_rdv_id: '72'
    });

    console.log(`Params: ${params3.toString()}`);
    const avail3Response = await fetch(`${SMART_AGENDA_BASE_URL}/getAvailabilities?${params3.toString()}`, {
      headers: { 'X-SMARTAPI-TOKEN': tokenData.token }
    });
    const avail3 = await avail3Response.json();
    console.log('Response:', JSON.stringify(avail3, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
