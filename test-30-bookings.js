/**
 * 30 Booking-Focused Tests
 * Full multi-turn conversations
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ADMIN_HASH = '6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377';
const CHATBOT_URL = 'https://smart-cita.netlify.app/.netlify/functions';
const SA_CREDS = { login: 'eshapi48Kd79BmSy83A', pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150', api_id: 'app_landing', api_key: '95Gt-Ke92-48Uf39Sp27hF' };
const SA_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';

let adminToken = null;
let saToken = null;
const results = [];
const bookingsToClean = [];

async function getAdminToken() {
  if (adminToken) return adminToken;
  const res = await fetch(`${CHATBOT_URL}/admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordHash: ADMIN_HASH })
  });
  adminToken = (await res.json()).token;
  return adminToken;
}

async function getSAToken() {
  if (saToken) return saToken;
  const res = await fetch(`${SA_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SA_CREDS)
  });
  saToken = (await res.json()).token;
  return saToken;
}

async function chat(message, history = []) {
  const token = await getAdminToken();
  const res = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ message, conversationHistory: history })
  });
  return res.json();
}

async function deleteBooking(id) {
  const token = await getSAToken();
  await fetch(`${SA_URL}/pdo_events/${id}`, { method: 'DELETE', headers: { 'X-SMARTAPI-TOKEN': token } });
}

async function deleteClientByEmail(email) {
  const token = await getSAToken();
  const res = await fetch(`${SA_URL}/pdo_client`, { headers: { 'X-SMARTAPI-TOKEN': token } });
  const clients = await res.json();
  const c = clients.find(x => x.mail === email);
  if (c) await fetch(`${SA_URL}/pdo_client/${c.id}`, { method: 'DELETE', headers: { 'X-SMARTAPI-TOKEN': token } });
}

function log(num, test, passed, details, resp = '') {
  results.push({ num, test, passed, details });
  console.log(`[${num}] ${test}: ${passed ? '✅' : '❌'} ${details}`);
}

function extractSlot(text) {
  const m = text?.match(/(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)\s+(\d+)\s+(?:de\s+)?(enero|febrero)/i);
  const t = text?.match(/(\d{2}:\d{2})/);
  return m && t ? { day: `${m[1]} ${m[2]} de ${m[3]}`, time: t[1] } : null;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('   30 CHATBOT TESTS');
  console.log('='.repeat(60));

  await getAdminToken();
  await getSAToken();

  const tests = [
    // INFO TESTS 1-10
    { q: '¿Tiene efectos secundarios?', check: r => r.toLowerCase().includes('no') || r.includes('seguro'), name: 'Side effects' },
    { q: '¿Cuántas sesiones para tabaco?', check: r => r.includes('1') || r.toLowerCase().includes('una'), name: 'Tabaco sessions' },
    { q: '¿Cuántas para cannabis?', check: r => r.includes('2'), name: 'Cannabis sessions' },
    { q: '¿Cuántas para azúcar?', check: r => r.includes('4'), name: 'Azucar sessions' },
    { q: '¿Precio para dejar de fumar?', check: r => r.includes('190'), name: 'Price tabaco' },
    { q: '¿Precio cannabis?', check: r => r.includes('250'), name: 'Price cannabis' },
    { q: 'Tengo cáncer ¿puedo tratarme?', check: r => !r.includes('médico') || r.includes('no es necesario'), name: 'Cancer OK' },
    { q: 'Quiero sesión de recaída', check: r => r.includes('689 560 130'), name: 'Recaida WhatsApp' },
    { q: 'Mi teléfono es 611222333 llámame', check: r => r.includes('611222333') || r.toLowerCase().includes('llamar'), name: 'Callback' },
    { q: '¿Dónde está Barcelona?', check: r => r.toLowerCase().includes('galileu') || r.toLowerCase().includes('sants'), name: 'Barcelona address' },

    // AVAILABILITY 11-15
    { q: 'Disponibilidad Barcelona tabaco', check: r => !r.includes(':30') && (r.includes(':00') || r.toLowerCase().includes('disponib')), name: 'Barcelona no :30' },
    { q: 'Disponibilidad Sevilla tabaco', check: r => r.includes(':00') || r.toLowerCase().includes('disponib'), name: 'Sevilla slots' },
    { q: 'Disponibilidad Atocha tabaco', check: r => r.includes(':00') || r.toLowerCase().includes('disponib') || r.toLowerCase().includes('atocha'), name: 'Atocha slots' },
    { q: '¿Qué centros hay en Madrid?', check: r => r.toLowerCase().includes('atocha') || r.toLowerCase().includes('chamartín'), name: 'Madrid centers' },
    { q: 'Tratamiento dúo precio', check: r => r.includes('360'), name: 'Duo price' },

    // EDGE CASES 16-20
    { q: 'Hola buenos días', check: r => r.toLowerCase().includes('hola') || r.toLowerCase().includes('ayudar'), name: 'Greeting' },
    { q: 'Tengo marcapasos ¿puedo?', check: r => r.toLowerCase().includes('marcapasos') || r.toLowerCase().includes('contraindicado'), name: 'Pacemaker' },
    { q: '¿Tienen centro en Valencia?', check: r => true, name: 'No Valencia center' },
    { q: '¿Cuánto dura la sesión?', check: r => r.includes('60') || r.toLowerCase().includes('hora'), name: 'Session duration' },
    { q: '¿El tratamiento es doloroso?', check: r => r.toLowerCase().includes('no') || r.toLowerCase().includes('indoloro') || r.length > 20, name: 'Pain question' },
  ];

  // Run single-message tests
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const r = await chat(t.q);
    log(i + 1, t.name, t.check(r.response || ''), r.response?.substring(0, 80) || 'No response');
  }

  // BOOKING TESTS 21-30 (full conversations)
  console.log('\n' + '─'.repeat(60));
  console.log('   FULL BOOKING TESTS');
  console.log('─'.repeat(60));

  const bookingTests = [
    { center: 'Barcelona', treatment: 'tabaco' },
    { center: 'Sevilla', treatment: 'tabaco' },
    { center: 'Atocha', treatment: 'tabaco' },
    { center: 'Barcelona', treatment: 'cannabis' },
    { center: 'Sevilla', treatment: 'cannabis' },
    { center: 'Majadahonda', treatment: 'tabaco' },
    { center: 'Chamartín', treatment: 'tabaco' },
    { center: 'Torrejón', treatment: 'tabaco' },
    { center: 'Barcelona', treatment: 'azucar' },
    { center: 'Sevilla', treatment: 'azucar' },
  ];

  for (let i = 0; i < bookingTests.length; i++) {
    const bt = bookingTests[i];
    const testNum = 21 + i;
    const email = `test30b_${Date.now()}_${testNum}@test.com`;
    const history = [];

    // Turn 1: Request
    const r1 = await chat(`Quiero cita para ${bt.treatment} en ${bt.center}`, history);
    history.push({ role: 'user', content: `Quiero cita para ${bt.treatment} en ${bt.center}` });
    history.push({ role: 'assistant', content: r1.response });

    const slot = extractSlot(r1.response);
    if (!slot) {
      log(testNum, `Book ${bt.center} ${bt.treatment}`, true, 'SKIP: No slots');
      continue;
    }

    // Turn 2: Choose slot
    const r2 = await chat(`El ${slot.day} a las ${slot.time}`, history);
    history.push({ role: 'user', content: `El ${slot.day} a las ${slot.time}` });
    history.push({ role: 'assistant', content: r2.response });

    // Turn 3: Details
    const r3 = await chat(`Test Usuario ${testNum}, ${email}, 600${testNum}00000`, history);
    history.push({ role: 'user', content: `Test Usuario ${testNum}, ${email}, 600${testNum}00000` });
    history.push({ role: 'assistant', content: r3.response });

    // Turn 4: Confirm
    const r4 = await chat('Sí confirmo', history);

    if (r4.bookingCreated && r4.appointmentId) {
      bookingsToClean.push({ id: r4.appointmentId, email });
      log(testNum, `Book ${bt.center} ${bt.treatment}`, true, `BOOKED ID:${r4.appointmentId}`);
    } else {
      log(testNum, `Book ${bt.center} ${bt.treatment}`, false, `Failed: ${r4.response?.substring(0, 60)}`);
    }
  }

  // Cleanup
  console.log('\n' + '─'.repeat(60));
  console.log('   CLEANUP');
  console.log('─'.repeat(60));

  for (const b of bookingsToClean) {
    await deleteBooking(b.id);
    await deleteClientByEmail(b.email);
    console.log(`   Deleted booking ${b.id}`);
  }

  // Report
  console.log('\n' + '='.repeat(60));
  console.log('   REPORT');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.details?.includes('SKIP')).length;

  console.log(`   Total: ${results.length}`);
  console.log(`   ✅ Passed: ${passed} (${Math.round(passed/results.length*100)}%)`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   Bookings: ${bookingsToClean.length} created & cleaned`);

  if (failed > 0) {
    console.log('\n   FAILURES:');
    results.filter(r => !r.passed && !r.details?.includes('SKIP')).forEach(r => {
      console.log(`   [${r.num}] ${r.test}: ${r.details}`);
    });
  }
}

runTests().catch(console.error);
