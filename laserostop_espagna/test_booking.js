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
  return response.json();
}

async function getEvent(token, eventId) {
  const response = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_events/${eventId}`, {
    headers: { 'X-SMARTAPI-TOKEN': token }
  });
  return response.json();
}

async function main() {
  try {
    console.log('Getting token...');
    const token = await getToken();
    console.log('✅ Token obtained\n');
    
    // Test booking with CORRECTED field mapping
    const testBooking = {
      client_id: '6',              // Existing client
      presta_id: '1',              // ✅ Valencia - Solo Dejar de fumar (appointment TYPE)
      ressource_id: '-1',          // ✅ Generic resource (practitioner)
      start_date: '2025-10-24 16:00:00',
      end_date: '2025-10-24 17:00:00',
      equipe_id: '1',              // Valencia
      statut: 'C'                  // Confirmed
    };
    
    console.log('Creating test appointment with CORRECTED mapping...');
    console.log('Appointment data:', JSON.stringify(testBooking, null, 2));
    
    const result = await createEvent(token, testBooking);
    console.log('\n✅ Appointment created!');
    console.log('Appointment ID:', result.id);
    
    // Fetch back the created event
    console.log('\nFetching created event...');
    const event = await getEvent(token, result.id);
    
    console.log('\n=== Created Event Details ===');
    console.log(`Event ID: ${event.id}`);
    console.log(`Client: ${event.client_prenom} ${event.client_nom}`);
    console.log(`Type (presta_id): ${event.presta_id} (should be 1)`);
    console.log(`Resource: ${event.ressource_id}`);
    console.log(`Center: ${event.equipe_id}`);
    console.log(`Start: ${event.start_date}`);
    console.log(`Status: ${event.statut}`);
    
    if (event.presta_id === '1') {
      console.log('\n✅ SUCCESS! Appointment type correctly set!');
    } else {
      console.log('\n❌ FAILED! Appointment type still wrong:', event.presta_id);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
