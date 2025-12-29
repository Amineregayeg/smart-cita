const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SA_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';
const SA_CREDS = { login: 'eshapi48Kd79BmSy83A', pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150', api_id: 'app_landing', api_key: '95Gt-Ke92-48Uf39Sp27hF' };

const CENTERS = {
  'Barcelona': { agendaId: '43', types: { tabaco: '20' } },
  'Sevilla': { agendaId: '44', types: { tabaco: '32' } },
  'Chamartin': { agendaId: '48', types: { tabaco: '44' } },
  'Atocha': { agendaId: '50', types: { tabaco: '63' } },
  'Torrejon': { agendaId: '49', types: { tabaco: '53' } },
  'Majadahonda': { agendaId: '51', types: { tabaco: '72' } }
};

async function check() {
  // Get token
  const tokenRes = await fetch(`${SA_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SA_CREDS)
  });
  const { token } = await tokenRes.json();
  console.log('Token obtained\n');

  console.log('='.repeat(70));
  console.log('   ALL CENTERS AVAILABILITY CHECK - January 2025');
  console.log('='.repeat(70));
  console.log('');

  for (const [centerName, center] of Object.entries(CENTERS)) {
    console.log(`--- ${centerName} (agenda ${center.agendaId}) ---`);

    for (const [treatment, typeId] of Object.entries(center.types)) {
      const res = await fetch(`${SA_URL}/service/getAvailabilities`, {
        method: 'POST',
        headers: { 'X-SMARTAPI-TOKEN': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdo_type_rdv_id: typeId,
          pdo_agenda_id: center.agendaId,
          date_a_partir_de: '2025-12-29',
          date_fin: '2026-01-12'  // Exactly 14 days like chatbot
        })
      });

      if (res.status === 404) {
        console.log(`   ${treatment}: ❌ NO AVAILABILITY (within 14 days)`);
      } else {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const firstDate = data[0].dj;
          const totalSlots = data.reduce((sum, day) => sum + (day.det?.length || 0), 0);
          const fullHourSlots = data.reduce((sum, day) =>
            sum + (day.det?.filter(s => s.idp.endsWith(':00')).length || 0), 0);
          console.log(`   ${treatment}: ✅ First: ${firstDate}, ${data.length} days, ${fullHourSlots} :00 slots`);
        } else {
          console.log(`   ${treatment}: ❌ ERROR - ${JSON.stringify(data)}`);
        }
      }
    }
    console.log('');
  }
}

check().catch(console.error);
