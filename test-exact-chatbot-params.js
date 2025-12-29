const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SA_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';
const SA_CREDS = { login: 'eshapi48Kd79BmSy83A', pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150', api_id: 'app_landing', api_key: '95Gt-Ke92-48Uf39Sp27hF' };

async function check() {
  const tokenRes = await fetch(`${SA_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SA_CREDS)
  });
  const { token } = await tokenRes.json();

  // Exact parameters the chatbot uses
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);

  console.log('Chatbot date range:');
  console.log('  Start:', startDate.toISOString().split('T')[0]);
  console.log('  End:', endDate.toISOString().split('T')[0]);
  console.log('');

  // Sevilla tabaco (agenda 44, type 32)
  const requestBody = {
    pdo_type_rdv_id: '32',
    pdo_agenda_id: '44',
    date_a_partir_de: startDate.toISOString().split('T')[0],
    date_fin: endDate.toISOString().split('T')[0]
  };

  console.log('Request body:', JSON.stringify(requestBody));
  console.log('');

  const res = await fetch(`${SA_URL}/service/getAvailabilities`, {
    method: 'POST',
    headers: { 'X-SMARTAPI-TOKEN': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  console.log('Response status:', res.status);

  if (res.status === 404) {
    console.log('Result: NO AVAILABILITY');
  } else {
    const data = await res.json();
    console.log('Result:', JSON.stringify(data, null, 2));
  }
}

check().catch(console.error);
