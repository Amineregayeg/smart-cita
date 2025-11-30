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

async function getEvents(token) {
  const response = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_events`, {
    headers: { 'X-SMARTAPI-TOKEN': token }
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
    console.log('Token obtained\n');

    console.log('Fetching all events...');
    const events = await getEvents(token);

    console.log('Total events:', events.length, '\n');

    // Get the latest 3 events with full details
    const latestEventIds = events.slice(-3).map(e => e.id);

    console.log('=== Latest 3 Events ===\n');

    for (const eventId of latestEventIds) {
      const event = await getEvent(token, eventId);
      console.log('Event ID:', event.id);
      console.log('  Client:', event.client_prenom, event.client_nom);
      console.log('  Start:', event.start_date);
      console.log('  End:', event.end_date);
      console.log('  Prestation ID:', event.presta_id);
      console.log('  Resource ID:', event.ressource_id);
      console.log('  Team/Center:', event.equipe_id);
      console.log('  Created:', event.date_creation);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
