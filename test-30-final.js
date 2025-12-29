const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ADMIN_HASH = '6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377';
const CHATBOT_URL = 'https://smart-cita.netlify.app/.netlify/functions';

async function runTests() {
  const authRes = await fetch(`${CHATBOT_URL}/admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordHash: ADMIN_HASH })
  });
  const { token } = await authRes.json();

  const tests = [
    // === AVAILABILITY TESTS (12) ===
    { name: 'Availability: Barcelona tabaco', message: '¿Qué disponibilidad hay para tabaco en Barcelona?', expect: 'hasSlots' },
    { name: 'Availability: Sevilla tabaco', message: '¿Qué disponibilidad tienen para dejar de fumar en Sevilla?', expect: 'hasSlots' },
    { name: 'Availability: Atocha tabaco', message: 'Quiero ver horarios para tratamiento tabaco en Atocha', expect: 'hasSlots' },
    { name: 'Availability: Torrejon tabaco', message: 'Disponibilidad en Torrejon para tabaco', expect: 'slots_or_none' },
    { name: 'Availability: Barcelona cannabis', message: '¿Qué horarios hay para cannabis en Barcelona?', expect: 'hasSlots' },
    { name: 'Availability: Barcelona azucar', message: 'Quiero consultar disponibilidad para azucar en Barcelona', expect: 'hasSlots' },
    { name: 'Availability: Sevilla cannabis', message: 'Horarios para cannabis en Sevilla', expect: 'hasSlots' },
    { name: 'Availability: Atocha cannabis', message: 'Disponibilidad cannabis Atocha', expect: 'hasSlots' },
    { name: 'Availability: Chamartin tabaco', message: '¿Qué disponibilidad hay en Chamartin para tabaco?', expect: 'slots_or_none' },
    { name: 'Availability: Majadahonda tabaco', message: 'Horarios tabaco Majadahonda', expect: 'slots_or_none' },
    { name: 'Availability: general query', message: 'Quiero dejar de fumar, ¿qué horarios tienen?', expect: 'asks_center' },
    { name: 'Availability: treatment only', message: 'Me interesa el tratamiento de cannabis', expect: 'asks_center' },

    // === INFO TESTS (8) ===
    { name: 'Info: prices tabaco', message: '¿Cuánto cuesta el tratamiento para dejar de fumar?', expect: 'contains_price' },
    { name: 'Info: prices cannabis', message: '¿Precio del tratamiento de cannabis?', expect: 'contains_250' },
    { name: 'Info: prices duo', message: '¿Cuánto vale el tratamiento en pareja?', expect: 'contains_360' },
    { name: 'Info: sessions cannabis', message: '¿Cuántas sesiones son para cannabis?', expect: 'contains_2' },
    { name: 'Info: sessions azucar', message: '¿Cuántas sesiones para adicción al azúcar?', expect: 'contains_4' },
    { name: 'Info: centers', message: '¿En qué ciudades tienen centros?', expect: 'contains_centers' },
    { name: 'Info: Barcelona address', message: '¿Dónde está el centro de Barcelona?', expect: 'contains_address' },
    { name: 'Info: how works', message: '¿Cómo funciona el tratamiento láser?', expect: 'contains_auriculoterapia' },

    // === BOOKING FLOW TESTS (6) ===
    { name: 'Booking: full flow Barcelona', type: 'booking_flow', center: 'Barcelona', treatment: 'tabaco' },
    { name: 'Booking: full flow Atocha', type: 'booking_flow', center: 'Atocha', treatment: 'tabaco' },
    { name: 'Booking: full flow Sevilla', type: 'booking_flow', center: 'Sevilla', treatment: 'tabaco' },
    { name: 'Booking: cannabis Barcelona', type: 'booking_flow', center: 'Barcelona', treatment: 'cannabis' },
    { name: 'Booking: azucar Barcelona', type: 'booking_flow', center: 'Barcelona', treatment: 'azucar' },
    { name: 'Booking: Torrejon tabaco', type: 'booking_flow', center: 'Torrejon', treatment: 'tabaco' },

    // === EDGE CASES (4) ===
    { name: 'Edge: recaida blocked', message: 'Quiero reservar para recaida en Barcelona', expect: 'recaida_blocked' },
    { name: 'Edge: invalid center', message: '¿Qué disponibilidad hay en Valencia?', expect: 'suggests_centers' },
    { name: 'Edge: greeting', message: 'Hola, buenos días', expect: 'greeting' },
    { name: 'Edge: goodbye', message: 'Gracias, hasta luego', expect: 'goodbye' },
  ];

  console.log('='.repeat(70));
  console.log('   COMPREHENSIVE 30-TEST SUITE - LaserOstop Chatbot');
  console.log('='.repeat(70));
  console.log('');

  const results = { pass: 0, fail: 0, skip: 0 };
  const failures = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`[${(i+1).toString().padStart(2)}/${tests.length}] ${test.name}`);

    try {
      if (test.type === 'booking_flow') {
        // Multi-turn booking test
        const result = await testBookingFlow(token, test.center, test.treatment);
        if (result.success) {
          results.pass++;
          console.log(`      ✅ PASS - Booking created: ${result.appointmentId || 'N/A'}`);
        } else if (result.skipped) {
          results.skip++;
          console.log(`      ⚠️  SKIP - ${result.reason}`);
        } else {
          results.fail++;
          failures.push({ test: test.name, reason: result.reason });
          console.log(`      ❌ FAIL - ${result.reason}`);
        }
      } else {
        // Single message test
        const res = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ message: test.message, conversationHistory: [] })
        });
        const data = await res.json();
        const response = data.response?.toLowerCase() || '';

        const passed = checkExpectation(response, data, test.expect);
        if (passed) {
          results.pass++;
          console.log(`      ✅ PASS`);
        } else {
          results.fail++;
          failures.push({ test: test.name, reason: `Expected: ${test.expect}`, response: response.substring(0, 100) });
          console.log(`      ❌ FAIL - Expected: ${test.expect}`);
        }
      }
    } catch (error) {
      results.fail++;
      failures.push({ test: test.name, reason: error.message });
      console.log(`      ❌ ERROR - ${error.message}`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('');
  console.log('='.repeat(70));
  console.log(`   RESULTS: ${results.pass} passed, ${results.fail} failed, ${results.skip} skipped`);
  console.log(`   SUCCESS RATE: ${Math.round((results.pass / (results.pass + results.fail)) * 100)}%`);
  console.log('='.repeat(70));

  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log(`  - ${f.test}: ${f.reason}`));
  }
}

function checkExpectation(response, data, expect) {
  const slotsFound = data.debug?.availability?.slotsFound || 0;
  const apiStatus = data.debug?.availability?.apiDebug?.status;

  switch (expect) {
    case 'hasSlots':
      return response.includes(':00') && slotsFound > 0;
    case 'slots_or_none':
      return (response.includes(':00') && slotsFound > 0) || (apiStatus === 404 && response.includes('no hay disponibilidad'));
    case 'asks_center':
      return response.includes('centro') || response.includes('barcelona') || response.includes('sevilla');
    case 'contains_price':
      return response.includes('190') || response.includes('€') || response.includes('euro');
    case 'contains_250':
      return response.includes('250');
    case 'contains_360':
      return response.includes('360');
    case 'contains_2':
      return response.includes('2 sesion') || response.includes('dos sesion');
    case 'contains_4':
      return response.includes('4 sesion') || response.includes('cuatro sesion');
    case 'contains_centers':
      return response.includes('barcelona') || response.includes('madrid') || response.includes('sevilla');
    case 'contains_address':
      return response.includes('calle') || response.includes('carrer') || response.includes('avenida') || response.includes('dirección');
    case 'contains_auriculoterapia':
      return response.includes('auriculoterapia') || response.includes('láser') || response.includes('oreja') || response.includes('indoloro');
    case 'recaida_blocked':
      return response.includes('whatsapp') || response.includes('contacta') || response.includes('equipo');
    case 'suggests_centers':
      return response.includes('barcelona') || response.includes('sevilla') || response.includes('centro');
    case 'greeting':
      return response.includes('hola') || response.includes('bienvenid') || response.includes('ayudar');
    case 'goodbye':
      return response.includes('hasta') || response.includes('gracias') || response.includes('buen');
    default:
      return false;
  }
}

async function testBookingFlow(token, center, treatment) {
  // Step 1: Get availability
  const availRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      message: `¿Qué disponibilidad hay para ${treatment} en ${center}?`,
      conversationHistory: []
    })
  });
  const availData = await availRes.json();

  // Check if slots available
  const slotsFound = availData.debug?.availability?.slotsFound || 0;
  if (slotsFound === 0) {
    return { success: false, skipped: true, reason: `No slots available for ${center} ${treatment}` };
  }

  // Extract first slot from response
  const slotMatch = availData.response?.match(/(\d+) de (\w+)[^\d]*(\d{1,2}:\d{2})/);
  if (!slotMatch) {
    return { success: false, reason: 'Could not extract slot from availability response' };
  }

  const history = [
    { role: 'user', content: `¿Qué disponibilidad hay para ${treatment} en ${center}?` },
    { role: 'assistant', content: availData.response }
  ];

  // Step 2: Select first slot
  const firstTime = slotMatch[3];
  const selectRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      message: `Quiero reservar el ${slotMatch[1]} de ${slotMatch[2]} a las ${firstTime}`,
      conversationHistory: history
    })
  });
  const selectData = await selectRes.json();

  history.push(
    { role: 'user', content: `Quiero reservar el ${slotMatch[1]} de ${slotMatch[2]} a las ${firstTime}` },
    { role: 'assistant', content: selectData.response }
  );

  await new Promise(r => setTimeout(r, 1000));

  // Step 3: Provide contact info
  const timestamp = Date.now();
  const contactRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      message: `Mi nombre es Test Usuario ${timestamp}, email test${timestamp}@test.com, teléfono 612345678`,
      conversationHistory: history
    })
  });
  const contactData = await contactRes.json();

  history.push(
    { role: 'user', content: `Mi nombre es Test Usuario ${timestamp}, email test${timestamp}@test.com, teléfono 612345678` },
    { role: 'assistant', content: contactData.response }
  );

  await new Promise(r => setTimeout(r, 1000));

  // Step 4: Confirm booking
  const confirmRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      message: 'Sí, confirmo la reserva',
      conversationHistory: history
    })
  });
  const confirmData = await confirmRes.json();

  if (confirmData.bookingCreated && confirmData.appointmentId) {
    return { success: true, appointmentId: confirmData.appointmentId };
  } else if (confirmData.response?.includes('confirmad') || confirmData.response?.includes('reserva')) {
    // Check if it looks like a confirmation even without the flag
    return { success: false, reason: 'Response looks like confirmation but no booking flag set' };
  } else {
    return { success: false, reason: 'Booking not created - ' + (confirmData.response?.substring(0, 100) || 'no response') };
  }
}

runTests().catch(console.error);
