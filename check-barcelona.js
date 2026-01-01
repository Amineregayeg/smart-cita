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

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 14);

  const treatments = [
    { name: 'tabaco', typeId: '20' },
    { name: 'cannabis', typeId: '23' },
    { name: 'azucar', typeId: '91' }
  ];

  console.log('Barcelona availability check:\n');

  for (const t of treatments) {
    const res = await fetch(`${SA_URL}/service/getAvailabilities`, {
      method: 'POST',
      headers: { 'X-SMARTAPI-TOKEN': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdo_type_rdv_id: t.typeId,
        pdo_agenda_id: '43',
        date_a_partir_de: startDate.toISOString().split('T')[0],
        date_fin: endDate.toISOString().split('T')[0]
      })
    });

    if (res.status === 404) {
      console.log(`${t.name}: NO SLOTS (404)`);
    } else {
      const data = await res.json();
      const totalSlots = data.reduce((sum, day) => sum + (day.det?.length || 0), 0);
      const fullHourSlots = data.reduce((sum, day) =>
        sum + (day.det?.filter(s => s.idp.endsWith(':00')).length || 0), 0);
      console.log(`${t.name}: ${data.length} days, ${totalSlots} total slots, ${fullHourSlots} :00 slots`);
    }
  }
}

check().catch(console.error);
