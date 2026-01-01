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

  // Check a few booking IDs
  const ids = [7970, 7980, 7987];

  for (const id of ids) {
    console.log(`\n=== Booking ${id} ===`);
    const res = await fetch(`${SA_URL}/pdo_events/${id}`, {
      headers: { 'X-SMARTAPI-TOKEN': token }
    });

    if (res.status === 404) {
      console.log('Not found');
      continue;
    }

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  }
}

check().catch(console.error);
