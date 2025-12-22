const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const BASE_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';
const CREDENTIALS = {
  login: 'eshapi48Kd79BmSy83A',
  pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150',
  api_id: 'app_landing',
  api_key: '95Gt-Ke92-48Uf39Sp27hF'
};

async function getToken() {
  const response = await fetch(`${BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS)
  });
  const data = await response.json();
  return data.token;
}

async function apiRequest(endpoint, token) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'X-SMARTAPI-TOKEN': token }
  });
  return response.json();
}

async function main() {
  console.log('Getting token...');
  const token = await getToken();
  console.log('Token obtained!\n');

  // Get all agendas (centers)
  console.log('=== CENTERS (pdo_agenda) ===');
  const agendas = await apiRequest('/pdo_agenda', token);
  const activeAgendas = agendas.filter(a => a.affiche_agenda === 'O' && a.id !== '53');

  activeAgendas.forEach(a => {
    console.log(`ID: ${a.id} | Name: ${a.nom} | Login: ${a.login}`);
  });

  // Get groups
  console.log('\n=== GROUPS (pdo_groupe) ===');
  const groups = await apiRequest('/pdo_groupe', token);
  groups.forEach(g => {
    console.log(`ID: ${g.id} | Name: ${g.libelle || g.nom}`);
  });

  // Get appointment types - filtered for Spanish centers
  console.log('\n=== SPANISH APPOINTMENT TYPES ===');
  const types = await apiRequest('/pdo_type_rdv', token);

  // Filter for Spanish types (contain "en Valencia", "en Barcelona", "en Sevilla", "en Madrid")
  const spanishTypes = types.filter(t =>
    t.nom && (t.nom.includes('en Valencia') || t.nom.includes('en Barcelona') ||
              t.nom.includes('en Sevilla') || t.nom.includes('en Madrid'))
  );

  spanishTypes.forEach(t => {
    console.log(`ID: ${t.id} | GroupID: ${t.id_groupe} | ${t.nom} | ${t.duree}min | ${t.prix_ttc}€`);
  });

  // Check availability for each active center
  console.log('\n=== AVAILABILITY CHECK (next 14 days) ===');
  const today = new Date();
  const twoWeeks = new Date(today);
  twoWeeks.setDate(twoWeeks.getDate() + 14);

  const startDate = today.toISOString().split('T')[0];
  const endDate = twoWeeks.toISOString().split('T')[0];

  for (const agenda of activeAgendas) {
    console.log(`\n--- ${agenda.nom} (Agenda ID: ${agenda.id}) ---`);

    // Find appointment types for this center
    // Try matching by id_groupe first
    let centerTypes = spanishTypes.filter(t => t.id_groupe === agenda.id);

    // If no match, try by name matching
    if (centerTypes.length === 0) {
      const nameLower = agenda.nom.toLowerCase();
      centerTypes = spanishTypes.filter(t => {
        const typeName = t.nom.toLowerCase();
        return typeName.includes(nameLower) ||
               (nameLower.includes('barcelona') && typeName.includes('barcelona')) ||
               (nameLower.includes('valencia') && typeName.includes('valencia')) ||
               (nameLower.includes('sevilla') && typeName.includes('sevilla')) ||
               (nameLower.includes('chamartin') && typeName.includes('chamartín')) ||
               (nameLower.includes('atocha') && typeName.includes('atocha')) ||
               (nameLower.includes('torrejon') && typeName.includes('torrejon')) ||
               (nameLower.includes('majadahonda') && typeName.includes('majadahonda'));
      });
    }

    if (centerTypes.length === 0) {
      console.log('  No appointment types found for this center');
      continue;
    }

    // Pick first type to check availability
    const typeId = centerTypes[0].id;
    console.log(`  Using type: ${centerTypes[0].nom} (ID: ${typeId})`);

    try {
      const availResponse = await fetch(`${BASE_URL}/service/getAvailabilities`, {
        method: 'POST',
        headers: {
          'X-SMARTAPI-TOKEN': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pdo_type_rdv_id: typeId,
          pdo_agenda_id: agenda.id,
          date_a_partir_de: startDate,
          date_fin: endDate
        })
      });

      if (availResponse.status === 404) {
        console.log('  No availability in next 14 days');
      } else {
        const availability = await availResponse.json();
        console.log(`  Found ${availability.length} available slots`);
        // Log raw data to understand structure
        if (availability.length > 0) {
          console.log(`  Sample slot structure:`, JSON.stringify(availability[0], null, 2));
        }
      }
    } catch (err) {
      console.log(`  Error checking availability: ${err.message}`);
    }
  }
}

main().catch(console.error);
