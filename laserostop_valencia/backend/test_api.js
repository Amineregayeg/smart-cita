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
    console.log('Token obtained');
    
    console.log('\nFetching event ID 14...');
    const event = await getEvent(token, 14);
    
    console.log('\n=== Event 14 Full Object ===');
    console.log(JSON.stringify(event, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
