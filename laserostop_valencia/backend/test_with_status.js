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

async function createEvent(token, eventData) {
  const response = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_events`, {
    method: 'POST',
    headers: { 
      'X-SMARTAPI-TOKEN': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventData)
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return response.json();
}

async function getEvent(token, eventId) {
  const response = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_events/${eventId}`, {
    headers: { 'X-SMARTAPI-TOKEN': token }
  });
  return response.json();
}

async function main() {
  const token = await getToken();
  
  // Try different status field names
  const testData = {
    client_id: '3',
    presta_id: '1',
    ressource_id: '-1',
    start_date: '2025-10-25 10:00:00',
    end_date: '2025-10-25 11:00:00',
    equipe_id: '1',
    statut: 'C',
    venu: '1',  // Try this - might mean "confirmed"/"came"
    internet: '1'  // Try this - might indicate online booking
  };
  
  console.log('Creating test event with status fields...');
  console.log(JSON.stringify(testData, null, 2));
  
  const result = await createEvent(token, testData);
  console.log('\nEvent created, ID:', result.id);
  
  // Fetch it back
  const event = await getEvent(token, result.id);
  console.log('\n=== Created Event ===');
  console.log('venu:', event.venu);
  console.log('internet:', event.internet);
  console.log('statut:', event.statut);
  console.log('couleur:', event.couleur);
}

main().catch(console.error);
