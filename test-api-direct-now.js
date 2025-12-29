const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SA_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';
const SA_CREDS = { login: 'eshapi48Kd79BmSy83A', pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150', api_id: 'app_landing', api_key: '95Gt-Ke92-48Uf39Sp27hF' };

async function test() {
  // Get token
  const tokenRes = await fetch(`${SA_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SA_CREDS)
  });
  const { token } = await tokenRes.json();
  console.log('Token obtained\n');

  // Same date calculation as chatbot uses
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);

  console.log(`Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`);

  const tests = [
    { name: 'Sevilla', agendaId: '44', typeId: '32' },
    { name: 'Barcelona', agendaId: '43', typeId: '20' },
    { name: 'Atocha', agendaId: '50', typeId: '63' }
  ];

  for (const t of tests) {
    console.log(`--- ${t.name} ---`);

    const res = await fetch(`${SA_URL}/service/getAvailabilities`, {
      method: 'POST',
      headers: { 'X-SMARTAPI-TOKEN': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdo_type_rdv_id: t.typeId,
        pdo_agenda_id: t.agendaId,
        date_a_partir_de: startDate.toISOString().split('T')[0],
        date_fin: endDate.toISOString().split('T')[0]
      })
    });

    console.log(`Status: ${res.status}`);

    if (res.status === 404) {
      console.log('Result: NO AVAILABILITY (404)\n');
    } else {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const totalSlots = data.reduce((sum, day) => sum + (day.det?.length || 0), 0);
        const fullHourSlots = data.reduce((sum, day) =>
          sum + (day.det?.filter(s => s.idp.endsWith(':00')).length || 0), 0);
        console.log(`Result: ${data.length} days, ${totalSlots} total slots, ${fullHourSlots} :00 slots`);
        console.log(`First day: ${data[0].dj} with times: ${data[0].det?.slice(0, 3).map(s => s.idp).join(', ')}...\n`);
      } else {
        console.log(`Result: ${JSON.stringify(data).substring(0, 200)}\n`);
      }
    }
  }
}

test().catch(console.error);
