/**
 * Quick test to see what fields Smart Agenda PROD returns for pdo_agenda
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

    // Get pdo_agenda data
    console.log('\nFetching /pdo_agenda...');
    const agendasResponse = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_agenda`, {
      headers: { 'X-SMARTAPI-TOKEN': tokenData.token }
    });

    const agendas = await agendasResponse.json();

    console.log(`\n📊 Retrieved ${agendas.length} agendas`);
    console.log('\n📋 First agenda item (all fields):');
    console.log(JSON.stringify(agendas[0], null, 2));

    console.log('\n📋 Available field names:');
    console.log(Object.keys(agendas[0]));

    console.log('\n📋 All active agendas (filtered):');
    agendas
      .filter(a => a.etat !== 'S' && a.affiche_agenda === 'O')
      .forEach(a => {
        console.log(`\nID: ${a.id}`);
        console.log(`  libelle: "${a.libelle}"`);
        console.log(`  nom: "${a.nom}"`);
        console.log(`  titre: "${a.titre}"`);
        console.log(`  ordre: ${a.ordre}`);
      });

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
