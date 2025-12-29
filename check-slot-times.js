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

  const centers = [
    { name: 'Sevilla', agendaId: '44', typeId: '32' },
    { name: 'Chamartin', agendaId: '48', typeId: '44' },
    { name: 'Majadahonda', agendaId: '51', typeId: '72' },
    { name: 'Barcelona', agendaId: '43', typeId: '20' }
  ];

  for (const center of centers) {
    console.log(`\n=== ${center.name} tabaco - Slot times ===`);

    const res = await fetch(`${SA_URL}/service/getAvailabilities`, {
      method: 'POST',
      headers: { 'X-SMARTAPI-TOKEN': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdo_type_rdv_id: center.typeId,
        pdo_agenda_id: center.agendaId,
        date_a_partir_de: '2025-12-29',
        date_fin: '2026-01-15'
      })
    });

    if (res.status === 404) {
      console.log('NO AVAILABILITY');
      continue;
    }

    const data = await res.json();
    if (Array.isArray(data)) {
      data.slice(0, 3).forEach(day => {
        const times = day.det?.map(slot => slot.idp) || [];
        const fullHours = times.filter(t => t.endsWith(':00'));
        const halfHours = times.filter(t => t.endsWith(':30'));
        console.log(`${day.dj} (${day.nj}): ${times.length} total, ${fullHours.length} :00, ${halfHours.length} :30`);
        console.log(`   All times: ${times.join(', ')}`);
      });
    }
  }
}

check().catch(console.error);
