const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const PROD_CREDS = {
  login: 'eshapi48Kd79BmSy83A',
  pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150',
  api_id: 'app_landing',
  api_key: '95Gt-Ke92-48Uf39Sp27hF'
};

async function test() {
  console.log('=== Testing Atocha Availability ===\n');

  // Get token
  const tokenRes = await fetch('https://www.smartagenda.fr/pro/laserostop-esh/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(PROD_CREDS)
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.token;
  console.log('Token obtained:', !!token);

  // Test Atocha (agenda ID 50, tabaco type 63)
  console.log('\n=== Atocha (ID 50) Tabaco (type 63) ===');
  const atochaRes = await fetch('https://www.smartagenda.fr/pro/laserostop-esh/api/service/getAvailabilities', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SMARTAPI-TOKEN': token
    },
    body: JSON.stringify({
      pdo_type_rdv_id: '63',
      pdo_agenda_id: '50',
      date_a_partir_de: '2025-12-26',
      date_fin: '2026-01-10'
    })
  });

  console.log('Response status:', atochaRes.status);
  const atochaData = await atochaRes.json();

  if (Array.isArray(atochaData)) {
    console.log(`Days with slots: ${atochaData.length}`);
    atochaData.forEach(day => {
      const times = day.det?.map(d => d.idp).join(', ') || 'none';
      console.log(`  ${day.dj} (${day.nj}): ${times}`);
    });
  } else {
    console.log('Response:', JSON.stringify(atochaData, null, 2));
  }

  // Also test Sevilla for comparison
  console.log('\n=== Sevilla (ID 44) Tabaco (type 32) ===');
  const sevillaRes = await fetch('https://www.smartagenda.fr/pro/laserostop-esh/api/service/getAvailabilities', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SMARTAPI-TOKEN': token
    },
    body: JSON.stringify({
      pdo_type_rdv_id: '32',
      pdo_agenda_id: '44',
      date_a_partir_de: '2025-12-26',
      date_fin: '2026-01-10'
    })
  });

  console.log('Response status:', sevillaRes.status);
  const sevillaData = await sevillaRes.json();

  if (Array.isArray(sevillaData)) {
    console.log(`Days with slots: ${sevillaData.length}`);
    sevillaData.forEach(day => {
      const times = day.det?.map(d => d.idp).join(', ') || 'none';
      console.log(`  ${day.dj} (${day.nj}): ${times}`);
    });
  } else {
    console.log('Response:', JSON.stringify(sevillaData, null, 2));
  }
}

test().catch(console.error);
