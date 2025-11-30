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

async function main() {
  console.log('=== Checking pdo_agenda_type_rdv Associations ===\n');

  const token = await getToken();

  // Check associations for Barcelona (43) and Atocha (50)
  const associations = await fetch(process.env.SMART_AGENDA_BASE_URL + '/pdo_agenda_type_rdv', {
    headers: { 'X-SMARTAPI-TOKEN': token }
  });

  const data = await associations.json();

  console.log(`Total associations: ${data.length}\n`);

  // Filter for Barcelona (43)
  const barcelona = data.filter(a => a.id_agenda === '43');
  console.log('Barcelona (43) associations:', barcelona.length);
  barcelona.forEach(a => {
    console.log(`  Type ${a.id_type_rdv}: internet='${a.internet}'`);
  });

  console.log('');

  // Filter for Atocha (50)
  const atocha = data.filter(a => a.id_agenda === '50');
  console.log('Atocha (50) associations:', atocha.length);
  atocha.forEach(a => {
    console.log(`  Type ${a.id_type_rdv}: internet='${a.internet}'`);
  });

  console.log('\n=== Testing getAvailabilities directly ===\n');

  // Test Barcelona availability
  const payload = {
    pdo_type_rdv_id: '25',
    pdo_agenda_id: '43',
    date_a_partir_de: '2025-10-22',
    date_fin: '2025-10-22'
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));

  const availRes = await fetch(process.env.SMART_AGENDA_BASE_URL + '/service/getAvailabilities', {
    method: 'POST',
    headers: {
      'X-SMARTAPI-TOKEN': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log('Response status:', availRes.status);

  if (availRes.ok) {
    const availData = await availRes.json();
    console.log('✅ SUCCESS!');
    console.log('Data:', JSON.stringify(availData, null, 2));
  } else {
    const errorText = await availRes.text();
    console.log('❌ ERROR:', errorText);
  }
}

main().catch(console.error);
