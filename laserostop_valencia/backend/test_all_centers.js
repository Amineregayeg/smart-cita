require('dotenv').config();
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

async function testCenter(token, agendaId, typeId, centerName) {
  const payload = {
    pdo_type_rdv_id: typeId,
    pdo_agenda_id: agendaId,
    date_a_partir_de: '2025-10-01',
    date_fin: '2025-10-31'
  };

  console.log(`\n=== ${centerName} (agenda: ${agendaId}, type: ${typeId}) ===`);

  try {
    const response = await fetch(process.env.SMART_AGENDA_BASE_URL + '/service/getAvailabilities', {
      method: 'POST',
      headers: {
        'X-SMARTAPI-TOKEN': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS - Days:', data.length);
      if (data.length > 0) {
        console.log('First day:', data[0].dj, 'with', data[0].det?.length || 0, 'slots');
      }
    } else {
      const errorText = await response.text();
      console.log('❌ ERROR:', response.status, errorText.substring(0, 200));
    }
  } catch (error) {
    console.log('❌ EXCEPTION:', error.message);
  }
}

async function main() {
  const token = await getToken();

  const tests = [
    { agendaId: '43', typeId: '25', name: 'Barcelona' },
    { agendaId: '48', typeId: '44', name: 'Chamartin' },
    { agendaId: '50', typeId: '63', name: 'Atocha' },
    { agendaId: '51', typeId: '72', name: 'Majadahonda' },
    { agendaId: '52', typeId: '81', name: 'San Sebastian' },
    { agendaId: '44', typeId: '32', name: 'Sevilla' },
    { agendaId: '49', typeId: '53', name: 'Torrejon' },
    { agendaId: '10', typeId: '1', name: 'Valencia' }
  ];

  for (const test of tests) {
    await testCenter(token, test.agendaId, test.typeId, test.name);
  }
}

main().catch(console.error);
