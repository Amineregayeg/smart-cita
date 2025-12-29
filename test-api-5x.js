const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SA_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';
const SA_CREDS = { login: 'eshapi48Kd79BmSy83A', pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150', api_id: 'app_landing', api_key: '95Gt-Ke92-48Uf39Sp27hF' };

async function test() {
  // Get fresh token
  const tokenRes = await fetch(`${SA_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SA_CREDS)
  });
  const { token } = await tokenRes.json();
  console.log('Token obtained\n');

  const startDate = new Date().toISOString().split('T')[0];
  const endDate = new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0];

  console.log('Testing Sevilla tabaco API 5 times in quick succession...');
  console.log(`Date range: ${startDate} to ${endDate}\n`);

  for (let i = 1; i <= 5; i++) {
    const start = Date.now();
    const res = await fetch(`${SA_URL}/service/getAvailabilities`, {
      method: 'POST',
      headers: { 'X-SMARTAPI-TOKEN': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdo_type_rdv_id: '32',
        pdo_agenda_id: '44',
        date_a_partir_de: startDate,
        date_fin: endDate
      })
    });
    const elapsed = Date.now() - start;

    if (res.status === 404) {
      console.log(`Attempt ${i}: ❌ 404 NO AVAILABILITY (${elapsed}ms)`);
    } else if (res.status === 200) {
      const data = await res.json();
      const days = Array.isArray(data) ? data.length : 0;
      console.log(`Attempt ${i}: ✅ 200 OK - ${days} days with slots (${elapsed}ms)`);
    } else {
      console.log(`Attempt ${i}: ⚠️ ${res.status} (${elapsed}ms)`);
    }
  }
}

test().catch(console.error);
