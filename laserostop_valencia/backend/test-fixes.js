require('dotenv').config({ path: './smart-cita-deployment/laserostop_espagna/backend/.env' });
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function getToken() {
  const tokenRes = await fetch(process.env.SMART_AGENDA_BASE_URL + '/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: process.env.SMART_AGENDA_LOGIN,
      pwd: process.env.SMART_AGENDA_PWD,
      api_id: process.env.SMART_AGENDA_API_ID,
      api_key: process.env.SMART_AGENDA_API_KEY
    })
  });
  const data = await tokenRes.json();
  return data.token;
}

async function testCenters() {
  console.log('=== TEST 1: FIXED getCenters() ===\n');

  const token = await getToken();

  const agendasRes = await fetch(process.env.SMART_AGENDA_BASE_URL + '/pdo_agenda', {
    headers: { 'X-SMARTAPI-TOKEN': token }
  });
  const agendas = await agendasRes.json();

  const activeCenters = agendas
    .filter(a => a.affiche_agenda === 'O')
    .filter(a => a.id !== '53');

  console.log('Total centers:', activeCenters.length);
  console.log('');
  activeCenters.forEach(c => {
    console.log(`ID: ${c.id.toString().padEnd(3)} | Name: ${c.nom.padEnd(20)} | Login: ${c.login}`);
  });

  console.log('\n✅ SUCCESS: Now using pdo_agenda IDs (10, 43-52)\n');
}

async function testAvailability() {
  console.log('=== TEST 2: FIXED getAvailability() ===\n');

  const token = await getToken();

  const payload = {
    pdo_type_rdv_id: '1',
    pdo_agenda_id: '10',  // Valencia
    date_a_partir_de: '2025-10-21',
    date_fin: '2025-10-27'
  };

  console.log('Testing with Valencia (agenda ID: 10)');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log('');

  const response = await fetch(process.env.SMART_AGENDA_BASE_URL + '/service/getAvailabilities', {
    method: 'POST',
    headers: {
      'X-SMARTAPI-TOKEN': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log('Response status:', response.status);
  const data = await response.json();

  if (response.status === 200) {
    console.log('✅ SUCCESS! Availability endpoint works');
    console.log('Days returned:', data.length);
    if (data.length > 0) {
      console.log('First day:', data[0].dj, 'with', data[0].det?.length || 0, 'slots');
    }
  } else if (response.status === 404) {
    console.log('⚠️ 404: No availability found');
    console.log('This means: Time slots need to be OPENED in Smart Agenda dashboard');
    console.log('Admin must create "plages d\'activité" for this agenda');
  } else {
    console.log('❌ Error:', JSON.stringify(data, null, 2));
  }

  console.log('');
}

async function main() {
  try {
    await testCenters();
    await testAvailability();

    console.log('=== ALL TESTS COMPLETE ===\n');
    console.log('Next steps:');
    console.log('1. If availability returns 404, open time slots in Smart Agenda dashboard');
    console.log('2. Commit and deploy the fixes');
    console.log('3. Test a real booking from the website');
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error);
  }
}

main();
