const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ADMIN_HASH = '6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377';
const CHATBOT_URL = 'https://smart-cita.netlify.app/.netlify/functions';

async function testBookingFlow(token, center, treatment) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BOOKING TEST: ${center} - ${treatment}`);
  console.log('='.repeat(60));

  // Step 1: Availability
  console.log('\n--- Step 1: Get Availability ---');
  const availRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      message: `¿Qué disponibilidad hay para ${treatment} en ${center}?`,
      conversationHistory: []
    })
  });
  const availData = await availRes.json();
  console.log('Response:', availData.response?.substring(0, 200));
  console.log('Debug:', JSON.stringify(availData.debug?.availability, null, 2));

  const slotsFound = availData.debug?.availability?.slotsFound || 0;
  if (slotsFound === 0) {
    console.log('\n❌ SKIP: No slots available');
    return { skipped: true, reason: 'No slots' };
  }

  // Extract slot from response
  const slotMatch = availData.response?.match(/(\d+) de (\w+)[^\d]*(\d{1,2}:\d{2})/);
  if (!slotMatch) {
    console.log('\n❌ FAIL: Could not parse slot from response');
    return { success: false, reason: 'Slot parsing failed' };
  }
  console.log(`Extracted slot: ${slotMatch[1]} de ${slotMatch[2]} a las ${slotMatch[3]}`);

  const history = [
    { role: 'user', content: `¿Qué disponibilidad hay para ${treatment} en ${center}?` },
    { role: 'assistant', content: availData.response }
  ];

  await new Promise(r => setTimeout(r, 1000));

  // Step 2: Select slot
  console.log('\n--- Step 2: Select Slot ---');
  const selectMsg = `Quiero reservar el ${slotMatch[1]} de ${slotMatch[2]} a las ${slotMatch[3]}`;
  console.log('User:', selectMsg);

  const selectRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      message: selectMsg,
      conversationHistory: history
    })
  });
  const selectData = await selectRes.json();
  console.log('Response:', selectData.response?.substring(0, 200));
  console.log('Tools called:', selectData.debug?.toolsCalled);

  history.push(
    { role: 'user', content: selectMsg },
    { role: 'assistant', content: selectData.response }
  );

  await new Promise(r => setTimeout(r, 1000));

  // Step 3: Provide contact info
  console.log('\n--- Step 3: Contact Info ---');
  const ts = Date.now();
  const contactMsg = `Mi nombre es Test Usuario ${ts}, mi email es test${ts}@example.com, mi teléfono es 612345678`;
  console.log('User:', contactMsg);

  const contactRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      message: contactMsg,
      conversationHistory: history
    })
  });
  const contactData = await contactRes.json();
  console.log('Response:', contactData.response?.substring(0, 250));
  console.log('Tools called:', contactData.debug?.toolsCalled);

  history.push(
    { role: 'user', content: contactMsg },
    { role: 'assistant', content: contactData.response }
  );

  await new Promise(r => setTimeout(r, 1000));

  // Step 4: Confirm
  console.log('\n--- Step 4: Confirm Booking ---');
  const confirmMsg = 'Sí, confirmo la reserva';
  console.log('User:', confirmMsg);

  const confirmRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      message: confirmMsg,
      conversationHistory: history
    })
  });
  const confirmData = await confirmRes.json();
  console.log('Response:', confirmData.response);
  console.log('Tools called:', confirmData.debug?.toolsCalled);
  console.log('bookingCreated:', confirmData.bookingCreated);
  console.log('appointmentId:', confirmData.appointmentId);

  if (confirmData.bookingCreated && confirmData.appointmentId) {
    console.log('\n✅ SUCCESS - Booking created!');
    return { success: true, appointmentId: confirmData.appointmentId };
  } else {
    const looksLikeConfirm = confirmData.response?.toLowerCase().includes('confirmad') ||
                            confirmData.response?.toLowerCase().includes('reserva') &&
                            confirmData.response?.includes('✅');
    if (looksLikeConfirm) {
      console.log('\n❌ FAIL: Response looks like confirmation but create_booking not called!');
      return { success: false, reason: 'Fake confirmation - create_booking not called' };
    } else if (confirmData.response?.includes('no está disponible')) {
      console.log('\n❌ FAIL: Slot no longer available (race condition)');
      return { success: false, reason: 'Race condition - slot taken' };
    } else {
      console.log('\n❌ FAIL: Booking not created');
      return { success: false, reason: 'Unknown failure' };
    }
  }
}

async function run() {
  const authRes = await fetch(`${CHATBOT_URL}/admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordHash: ADMIN_HASH })
  });
  const { token } = await authRes.json();

  const tests = [
    ['Barcelona', 'tabaco'],
    ['Sevilla', 'tabaco'],
    ['Atocha', 'tabaco'],
    ['Barcelona', 'cannabis'],
  ];

  const results = { success: 0, fail: 0, skip: 0, failures: [] };

  for (const [center, treatment] of tests) {
    const result = await testBookingFlow(token, center, treatment);

    if (result.skipped) {
      results.skip++;
    } else if (result.success) {
      results.success++;
    } else {
      results.fail++;
      results.failures.push({ center, treatment, reason: result.reason });
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Success: ${results.success}`);
  console.log(`Failed: ${results.fail}`);
  console.log(`Skipped: ${results.skip}`);

  if (results.failures.length > 0) {
    console.log('\nFailure Details:');
    results.failures.forEach(f => {
      console.log(`  - ${f.center} ${f.treatment}: ${f.reason}`);
    });
  }
}

run().catch(console.error);
