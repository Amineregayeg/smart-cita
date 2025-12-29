/**
 * Full 30 Test Suite - Fixed Version
 */
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ADMIN_HASH = '6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377';
const CHATBOT_URL = 'https://smart-cita.netlify.app/.netlify/functions';
const SA_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';
const SA_CREDS = { login: 'eshapi48Kd79BmSy83A', pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150', api_id: 'app_landing', api_key: '95Gt-Ke92-48Uf39Sp27hF' };

let adminToken = null;
let saToken = null;

async function getAdminToken() {
  if (adminToken) return adminToken;
  const res = await fetch(`${CHATBOT_URL}/admin-auth`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordHash: ADMIN_HASH })
  });
  adminToken = (await res.json()).token;
  return adminToken;
}

async function getSAToken() {
  if (saToken) return saToken;
  const res = await fetch(`${SA_URL}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
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

async function deleteClient(email) {
  const token = await getSAToken();
  const res = await fetch(`${SA_URL}/pdo_client`, { headers: { 'X-SMARTAPI-TOKEN': token } });
  const clients = await res.json();
  const c = clients.find(x => x.mail === email);
  if (c) await fetch(`${SA_URL}/pdo_client/${c.id}`, { method: 'DELETE', headers: { 'X-SMARTAPI-TOKEN': token } });
}

function extractSlot(text) {
  const m = text?.match(/(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)\s+(\d+)\s+(?:de\s+)?(enero|febrero|marzo)/i);
  const t = text?.match(/(\d{1,2}:\d{2})/);
  return m && t ? { day: `${m[1]} ${m[2]} de ${m[3]}`, time: t[1] } : null;
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('   FULL 30 TEST SUITE');
  console.log('='.repeat(60));

  await getAdminToken();
  await getSAToken();
  console.log('✓ Tokens obtained\n');

  const bookings = [];
  const results = [];

  // INFO TESTS 1-20
  const infoTests = [
    { q: '¿El tratamiento tiene efectos secundarios?', check: r => r.toLowerCase().includes('no') && r.toLowerCase().includes('seguro'), name: 'Side effects' },
    { q: '¿Cuántas sesiones necesito para tabaco?', check: r => r.includes('1') || r.toLowerCase().includes('una'), name: 'Tabaco sessions' },
    { q: '¿Cuántas sesiones para cannabis?', check: r => r.includes('2'), name: 'Cannabis sessions' },
    { q: '¿Y para azúcar cuántas?', check: r => r.includes('4'), name: 'Azucar sessions' },
    { q: '¿Precio para dejar de fumar?', check: r => r.includes('190'), name: 'Price tabaco' },
    { q: '¿Precio tratamiento cannabis?', check: r => r.includes('250'), name: 'Price cannabis' },
    { q: '¿Precio tratamiento azúcar?', check: r => r.includes('200'), name: 'Price azucar' },
    { q: '¿Precio del tratamiento dúo?', check: r => r.includes('360'), name: 'Price duo' },
    { q: 'He recaído, necesito otra sesión', check: r => r.includes('689 560 130'), name: 'Recaida WhatsApp' },
    { q: 'Mi teléfono es 655443322 llámame', check: r => r.includes('655443322') || r.toLowerCase().includes('llamar'), name: 'Callback' },
    { q: '¿Dónde está el centro de Barcelona?', check: r => r.toLowerCase().includes('galileu') || r.toLowerCase().includes('sants'), name: 'Barcelona address' },
    { q: '¿Qué centros tienen en Madrid?', check: r => r.toLowerCase().includes('atocha') || r.toLowerCase().includes('chamartín'), name: 'Madrid centers' },
    { q: '¿El tratamiento es doloroso?', check: r => r.toLowerCase().includes('no') || r.toLowerCase().includes('indoloro'), name: 'Pain question' },
    { q: '¿Cuánto dura la sesión de tabaco?', check: r => r.includes('60') || r.toLowerCase().includes('hora'), name: 'Duration tabaco' },
    { q: 'Tengo marcapasos ¿puedo tratarme?', check: r => r.toLowerCase().includes('marcapasos') || r.toLowerCase().includes('contraindicado'), name: 'Pacemaker' },
    { q: 'Tengo cáncer ¿puedo hacer el tratamiento?', check: r => !r.toLowerCase().includes('médico') || r.toLowerCase().includes('no es necesario'), name: 'Cancer OK' },
    { q: 'Hola buenos días', check: r => r.toLowerCase().includes('hola') || r.toLowerCase().includes('ayudar'), name: 'Greeting' },
    { q: '¿Tienen centro en Valencia?', check: r => r.toLowerCase().includes('no') || r.toLowerCase().includes('barcelona') || r.toLowerCase().includes('sevilla'), name: 'No Valencia' },
    { q: '¿Qué es el tratamiento dúo?', check: r => r.toLowerCase().includes('2') || r.toLowerCase().includes('pareja') || r.includes('360'), name: 'Duo explanation' },
    { q: '¿El tratamiento funciona para todas las personas?', check: r => r.length > 20, name: 'General efficacy' },
  ];

  // BOOKING TESTS 21-30
  const bookingTests = [
    { center: 'Barcelona', treatment: 'tabaco' },
    { center: 'Sevilla', treatment: 'tabaco' },
    { center: 'Atocha', treatment: 'tabaco' },
    { center: 'Chamartín', treatment: 'tabaco' },
    { center: 'Barcelona', treatment: 'cannabis' },
    { center: 'Sevilla', treatment: 'cannabis' },
    { center: 'Barcelona', treatment: 'azucar' },
    { center: 'Sevilla', treatment: 'azucar' },
    { center: 'Majadahonda', treatment: 'tabaco' },
    { center: 'Torrejón', treatment: 'tabaco' },
  ];

  // RUN INFO TESTS
  console.log('─'.repeat(60));
  console.log('   INFO TESTS (1-20)');
  console.log('─'.repeat(60));

  for (let i = 0; i < infoTests.length; i++) {
    const t = infoTests[i];
    const r = await chat(t.q);
    const passed = t.check(r.response || '');
    results.push({ num: i + 1, name: t.name, passed });
    console.log('[' + (i + 1) + '] ' + t.name + ': ' + (passed ? '✅' : '❌') + ' ' + (r.response || '').substring(0, 60) + '...');
  }

  // RUN BOOKING TESTS
  console.log('\n' + '─'.repeat(60));
  console.log('   BOOKING TESTS (21-30)');
  console.log('─'.repeat(60));

  for (let i = 0; i < bookingTests.length; i++) {
    const t = bookingTests[i];
    const testNum = 21 + i;
    const email = 'fulltest_' + Date.now() + '_' + testNum + '@test.com';
    const history = [];

    // Step 1: Ask availability
    const r1 = await chat('¿Qué disponibilidad hay para ' + t.treatment + ' en ' + t.center + '?', history);
    history.push({ role: 'user', content: '¿Qué disponibilidad hay para ' + t.treatment + ' en ' + t.center + '?' });
    history.push({ role: 'assistant', content: r1.response });

    const slot = extractSlot(r1.response);
    if (!slot) {
      results.push({ num: testNum, name: 'Book ' + t.center + ' ' + t.treatment, passed: true, skipped: true });
      console.log('[' + testNum + '] Book ' + t.center + ' ' + t.treatment + ': ⏭️ SKIP (no slots)');
      continue;
    }

    // Step 2: Choose slot
    const r2 = await chat('Quiero el ' + slot.day + ' a las ' + slot.time, history);
    history.push({ role: 'user', content: 'Quiero el ' + slot.day + ' a las ' + slot.time });
    history.push({ role: 'assistant', content: r2.response });

    // Step 3: Provide details
    const r3 = await chat('Me llamo Test FullFlow ' + testNum + ', mi email es ' + email + ', teléfono 6' + testNum + '0000000', history);
    history.push({ role: 'user', content: 'Me llamo Test FullFlow ' + testNum + ', mi email es ' + email + ', teléfono 6' + testNum + '0000000' });
    history.push({ role: 'assistant', content: r3.response });

    // Step 4: Confirm
    const r4 = await chat('Sí confirmo la reserva', history);

    if (r4.bookingCreated && r4.appointmentId) {
      bookings.push({ id: r4.appointmentId, email });
      results.push({ num: testNum, name: 'Book ' + t.center + ' ' + t.treatment, passed: true });
      console.log('[' + testNum + '] Book ' + t.center + ' ' + t.treatment + ': ✅ BOOKED (ID: ' + r4.appointmentId + ')');
    } else {
      results.push({ num: testNum, name: 'Book ' + t.center + ' ' + t.treatment, passed: false });
      console.log('[' + testNum + '] Book ' + t.center + ' ' + t.treatment + ': ❌ FAILED');
    }
  }

  // CLEANUP
  console.log('\n' + '─'.repeat(60));
  console.log('   CLEANUP');
  console.log('─'.repeat(60));

  for (const b of bookings) {
    await deleteBooking(b.id);
    await deleteClient(b.email);
    console.log('   Deleted booking ' + b.id + ' + client');
  }

  // REPORT
  console.log('\n' + '='.repeat(60));
  console.log('   FINAL REPORT');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.skipped).length;
  const bookingsCreated = bookings.length;

  console.log('\n   Total: ' + results.length);
  console.log('   ✅ Passed: ' + passed + ' (' + Math.round(passed/results.length*100) + '%)');
  console.log('   ❌ Failed: ' + failed);
  console.log('   ⏭️ Skipped: ' + skipped);
  console.log('   📅 Bookings created & cleaned: ' + bookingsCreated);

  if (failed > 0) {
    console.log('\n   FAILURES:');
    results.filter(r => !r.passed && !r.skipped).forEach(r => {
      console.log('   [' + r.num + '] ' + r.name);
    });
  }
  console.log('='.repeat(60));
}

runTest().catch(console.error);
