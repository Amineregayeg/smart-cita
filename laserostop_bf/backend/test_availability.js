require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SMART_AGENDA_BASE_URL = process.env.SMART_AGENDA_BASE_URL;
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

async function getResources(token) {
  const response = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_ressource`, {
    headers: { 'X-SMARTAPI-TOKEN': token }
  });
  return response.json();
}

async function getAvailability(token, params) {
  const url = `${SMART_AGENDA_BASE_URL}/getAvailabilities?${params}`;
  console.log('URL:', url);
  
  const response = await fetch(url, {
    headers: { 'X-SMARTAPI-TOKEN': token }
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return response.json();
}

async function main() {
  try {
    console.log('Getting token...');
    const token = await getToken();
    console.log('✅ Token obtained\n');
    
    console.log('Fetching resources...');
    const resources = await getResources(token);
    console.log('Resources:', resources.map(r => ({ id: r.id, nom: r.nom })));
    
    const resourceId = resources.find(r => r.id === '-1')?.id || resources[0]?.id || '-1';
    console.log('\nUsing resource:', resourceId);
    
    // Test availability call
    const params = new URLSearchParams({
      id_ressource: resourceId,
      date_debut: '2025-10-01',
      date_fin: '2025-10-31'
    });
    
    console.log('\nTesting availability API...');
    const availability = await getAvailability(token, params.toString());
    console.log('✅ Availability response:', JSON.stringify(availability).substring(0, 200));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
