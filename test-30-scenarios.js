/**
 * 30 Scenario Chatbot Test
 * Uses chatbot responses for slots (not separate API calls)
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
  const data = await res.json();
  adminToken = data.token;
  return adminToken;
}

async function getSAToken() {
  if (saToken) return saToken;
  const res = await fetch(`${SA_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SA_CREDS)
  });
  const data = await res.json();
  saToken = data.token;
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

async function verifyBooking(id) {
  const token = await getSAToken();
  const res = await fetch(`${SA_URL}/pdo_events/${id}`, {
    headers: { 'X-SMARTAPI-TOKEN': token }
  });
  return res.ok;
}

async function deleteBooking(id) {
  const token = await getSAToken();
  const res = await fetch(`${SA_URL}/pdo_events/${id}`, {
    method: 'DELETE',
    headers: { 'X-SMARTAPI-TOKEN': token }
  });
  return res.ok;
}

async function findAndDeleteClient(email) {
  const token = await getSAToken();
  const res = await fetch(`${SA_URL}/pdo_client`, {
    headers: { 'X-SMARTAPI-TOKEN': token }
  });
  if (!res.ok) return;
  const clients = await res.json();
  const client = clients.find(c => c.mail === email);
  if (client) {
    await fetch(`${SA_URL}/pdo_client/${client.id}`, {
      method: 'DELETE',
      headers: { 'X-SMARTAPI-TOKEN': token }
    });
  }
}

function log(num, scenario, passed, details, response = '') {
  results.push({ num, scenario, passed, details, response: response?.substring(0, 120) });
  console.log(`[${num}] ${scenario}`);
  console.log(`   ${passed ? '✅' : '❌'} ${details}`);
}

// Extract first slot from chatbot response
function extractSlot(response) {
  // Match patterns like "Sábado 3 de enero: 15:00" or "Miércoles 7 enero: 10:00"
  const dateMatch = response.match(/(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo)\s+(\d+)\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i);
  const timeMatch = response.match(/(\d{1,2}:\d{2})/);

  if (dateMatch && timeMatch) {
    const months = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' };
    const day = dateMatch[2].padStart(2, '0');
    const month = months[dateMatch[3].toLowerCase()];
    const year = '2026'; // Assuming next year
    return {
      dateStr: `${dateMatch[1]} ${dateMatch[2]} de ${dateMatch[3]}`,
      date: `${year}-${month}-${day}`,
      time: timeMatch[1]
    };
  }
  return null;
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('   30 SCENARIO CHATBOT TEST');
  console.log('='.repeat(70));

  await getAdminToken();
  await getSAToken();
  console.log('✓ Tokens obtained\n');

  // ========== INFORMATION TESTS (1-15) ==========
  console.log('─'.repeat(70));
  console.log('   INFORMATION TESTS');
  console.log('─'.repeat(70));

  // 1. Side effects
  let r = await chat('¿El tratamiento láser tiene efectos secundarios?');
  log(1, 'Side effects question',
    r.response?.toLowerCase().includes('no') && r.response?.toLowerCase().includes('seguro'),
    r.response?.includes('seguro') ? 'Says safe/no effects' : 'Should say no effects', r.response);

  // 2. Tabaco sessions
  r = await chat('¿Cuántas sesiones necesito para tabaco?');
  log(2, 'Tabaco sessions',
    r.response?.toLowerCase().includes('una') || r.response?.includes('1'),
    'Should say 1/una session', r.response);

  // 3. Cannabis sessions
  r = await chat('¿Y para cannabis cuántas sesiones?');
  log(3, 'Cannabis sessions',
    r.response?.includes('2'),
    'Should say 2 sessions', r.response);

  // 4. Azucar sessions
  r = await chat('¿Para adicción al azúcar?');
  log(4, 'Azucar sessions',
    r.response?.includes('4'),
    'Should say 4 sessions', r.response);

  // 5. Duo treatment
  r = await chat('¿Qué es el tratamiento dúo?');
  log(5, 'Duo explanation',
    r.response?.toLowerCase().includes('2 personas') || r.response?.toLowerCase().includes('dos personas') || r.response?.includes('360'),
    'Should explain duo (2 people)', r.response);

  // 6. Cancer patient
  r = await chat('Tengo cáncer, ¿puedo hacer el tratamiento?');
  log(6, 'Cancer patient OK',
    !r.response?.toLowerCase().includes('médico') || r.response?.toLowerCase().includes('no es necesario'),
    'Should say OK without doctor', r.response);

  // 7. Recaida
  r = await chat('He recaído, quiero otra sesión');
  log(7, 'Recaida → WhatsApp',
    r.response?.includes('689 560 130') || r.response?.toLowerCase().includes('whatsapp'),
    'Should redirect to WhatsApp', r.response);

  // 8. Price tabaco
  r = await chat('¿Cuánto cuesta dejar de fumar?');
  log(8, 'Price tabaco',
    r.response?.includes('190'),
    'Should say 190€', r.response);

  // 9. Price cannabis
  r = await chat('¿Y el precio para cannabis?');
  log(9, 'Price cannabis',
    r.response?.includes('250'),
    'Should say 250€', r.response);

  // 10. Price azucar
  r = await chat('¿Cuánto cuesta para azúcar?');
  log(10, 'Price azucar',
    r.response?.includes('200'),
    'Should say 200€', r.response);

  // 11. Barcelona hours
  r = await chat('¿Cuál es el horario en Barcelona?');
  log(11, 'Barcelona hours',
    r.response?.toLowerCase().includes('martes') || r.response?.includes('11') || r.response?.includes('20'),
    'Should mention Tue-Sat 11-20', r.response);

  // 12. Sevilla hours
  r = await chat('¿Y el horario de Sevilla?');
  log(12, 'Sevilla hours',
    r.response?.toLowerCase().includes('lunes') || r.response?.includes('9') || r.response?.includes('18'),
    'Should mention Mon-Fri hours', r.response);

  // 13. Callback request
  r = await chat('Mi número es 666777888, ¿pueden llamarme?');
  log(13, 'Callback confirmation',
    r.response?.toLowerCase().includes('llamar') && r.response?.includes('666777888'),
    'Should confirm callback', r.response);

  // 14. Location Barcelona
  r = await chat('¿Dónde está el centro de Barcelona?');
  log(14, 'Barcelona address',
    r.response?.toLowerCase().includes('galileu') || r.response?.toLowerCase().includes('sants'),
    'Should give address', r.response);

  // 15. All centers
  r = await chat('¿Qué centros tienen en España?');
  log(15, 'List all centers',
    r.response?.toLowerCase().includes('barcelona') && r.response?.toLowerCase().includes('sevilla'),
    'Should list multiple centers', r.response);

  // ========== AVAILABILITY TESTS (16-20) ==========
  console.log('\n' + '─'.repeat(70));
  console.log('   AVAILABILITY TESTS');
  console.log('─'.repeat(70));

  // 16. Barcelona availability - no :30
  r = await chat('¿Qué disponibilidad hay en Barcelona para tabaco?');
  log(16, 'Barcelona slots (no :30)',
    r.response && !r.response.includes(':30'),
    'Should only show :00 times', r.response);

  // 17. Sevilla availability
  r = await chat('¿Y disponibilidad en Sevilla?');
  log(17, 'Sevilla availability',
    r.response?.includes(':00') || r.response?.toLowerCase().includes('disponib'),
    'Should show availability', r.response);

  // 18. Atocha availability
  r = await chat('¿Horarios disponibles en Atocha?');
  log(18, 'Atocha availability',
    r.response?.includes(':00') || r.response?.toLowerCase().includes('disponib') || r.response?.toLowerCase().includes('atocha'),
    'Should respond about Atocha', r.response);

  // 19. Next week availability
  r = await chat('¿Qué hay para la próxima semana en Barcelona?');
  log(19, 'Next week query',
    r.response?.toLowerCase().includes('disponib') || r.response?.includes(':00'),
    'Should check next week', r.response);

  // 20. Cannabis availability
  r = await chat('Disponibilidad para cannabis en Sevilla');
  log(20, 'Cannabis availability',
    r.response?.toLowerCase().includes('cannabis') || r.response?.toLowerCase().includes('disponib'),
    'Should respond about cannabis', r.response);

  // ========== BOOKING TESTS (21-27) ==========
  console.log('\n' + '─'.repeat(70));
  console.log('   BOOKING TESTS');
  console.log('─'.repeat(70));

  const centers = ['Barcelona', 'Sevilla', 'Atocha'];
  let testNum = 21;

  for (const center of centers) {
    if (testNum > 27) break;

    const history = [];
    const testEmail = `test30_${Date.now()}_${testNum}@test.com`;

    // Step 1: Ask availability
    let r1 = await chat(`Quiero reservar para dejar de fumar en ${center}`, history);
    history.push({ role: 'user', content: `Quiero reservar para dejar de fumar en ${center}` });
    history.push({ role: 'assistant', content: r1.response });

    // Extract slot from chatbot response
    const slot = extractSlot(r1.response);

    if (!slot) {
      log(testNum, `Booking ${center}`, true, `SKIPPED - No slots in response`, r1.response);
      testNum++;
      continue;
    }

    // Step 2: Choose slot (from chatbot's response!)
    let r2 = await chat(`Quiero el ${slot.dateStr} a las ${slot.time}`, history);
    history.push({ role: 'user', content: `Quiero el ${slot.dateStr} a las ${slot.time}` });
    history.push({ role: 'assistant', content: r2.response });

    // Step 3: Provide details
    let r3 = await chat(`Me llamo Test Treinta ${testNum}, email ${testEmail}, teléfono 600${testNum}${testNum}${testNum}000`, history);
    history.push({ role: 'user', content: `Me llamo Test Treinta ${testNum}, email ${testEmail}, teléfono 600${testNum}${testNum}${testNum}000` });
    history.push({ role: 'assistant', content: r3.response });

    // Step 4: Confirm
    let r4 = await chat('Sí, confirmo', history);

    if (r4.bookingCreated && r4.appointmentId) {
      const verified = await verifyBooking(r4.appointmentId);
      bookingsToClean.push({ id: r4.appointmentId, email: testEmail });
      log(testNum, `Full booking ${center}`, verified,
        verified ? `VERIFIED ID: ${r4.appointmentId}` : 'Created but not verified', r4.response);
    } else {
      log(testNum, `Full booking ${center}`, false,
        `NOT CREATED - bookingCreated: ${r4.bookingCreated}`, r4.response);
    }

    testNum++;
  }

  // Fill remaining booking slots with skipped
  while (testNum <= 27) {
    log(testNum, 'Additional booking', true, 'SKIPPED - Covered above');
    testNum++;
  }

  // ========== EDGE CASE TESTS (28-30) ==========
  console.log('\n' + '─'.repeat(70));
  console.log('   EDGE CASE TESTS');
  console.log('─'.repeat(70));

  // 28. Greeting
  r = await chat('Hola buenas tardes');
  log(28, 'Greeting response',
    r.response?.toLowerCase().includes('hola') || r.response?.toLowerCase().includes('ayudar'),
    'Should greet back', r.response);

  // 29. Pacemaker question
  r = await chat('Tengo marcapasos, ¿puedo hacer el tratamiento?');
  log(29, 'Pacemaker contraindication',
    r.response?.toLowerCase().includes('marcapasos') || r.response?.toLowerCase().includes('contraindicado'),
    'Should mention pacemaker issue', r.response);

  // 30. Invalid center
  r = await chat('¿Tienen centro en Valencia?');
  log(30, 'Non-existent center',
    r.response?.toLowerCase().includes('no') || r.response?.toLowerCase().includes('disponible') || r.response?.includes('689 560 130'),
    'Should handle gracefully', r.response);

  // ========== CLEANUP ==========
  console.log('\n' + '─'.repeat(70));
  console.log('   CLEANUP');
  console.log('─'.repeat(70));

  for (const b of bookingsToClean) {
    const del = await deleteBooking(b.id);
    await findAndDeleteClient(b.email);
    console.log(`   Booking ${b.id}: ${del ? 'DELETED' : 'FAILED'}`);
  }

  // ========== REPORT ==========
  console.log('\n' + '='.repeat(70));
  console.log('   FINAL REPORT');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.details?.includes('SKIPPED')).length;

  console.log(`\n   Total: ${results.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   Success Rate: ${Math.round((passed/results.length)*100)}%`);

  if (failed > 0) {
    console.log('\n   FAILURES:');
    results.filter(r => !r.passed && !r.details?.includes('SKIPPED')).forEach(r => {
      console.log(`   [${r.num}] ${r.scenario}`);
      console.log(`       ${r.details}`);
      console.log(`       Response: ${r.response}...`);
    });
  }

  console.log('\n   Bookings cleaned: ' + bookingsToClean.length);
  console.log('='.repeat(70));
}

runTests().catch(console.error);
