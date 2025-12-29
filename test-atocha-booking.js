const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ADMIN_HASH = '6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377';
const CHATBOT_URL = 'https://smart-cita.netlify.app/.netlify/functions';

async function test() {
  const authRes = await fetch(`${CHATBOT_URL}/admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordHash: ADMIN_HASH })
  });
  const { token } = await authRes.json();

  console.log('Testing Atocha booking flow 3 times...\n');

  for (let i = 0; i < 3; i++) {
    console.log(`\n=== ATTEMPT ${i+1} ===`);

    // Step 1: Availability
    const availRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: '¿Qué disponibilidad hay para tabaco en Atocha?',
        conversationHistory: []
      })
    });
    const availData = await availRes.json();
    console.log('1. Availability:', availData.response?.substring(0, 100) + '...');

    const slotMatch = availData.response?.match(/(\d+) de (\w+)[^\d]*(\d{1,2}:\d{2})/);
    if (!slotMatch) {
      console.log('   No slot found, skipping');
      continue;
    }

    const history = [
      { role: 'user', content: '¿Qué disponibilidad hay para tabaco en Atocha?' },
      { role: 'assistant', content: availData.response }
    ];

    await new Promise(r => setTimeout(r, 1000));

    // Step 2: Select slot
    const selectRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: `Quiero el ${slotMatch[1]} de ${slotMatch[2]} a las ${slotMatch[3]}`,
        conversationHistory: history
      })
    });
    const selectData = await selectRes.json();
    console.log('2. Selection:', selectData.response?.substring(0, 100) + '...');

    history.push(
      { role: 'user', content: `Quiero el ${slotMatch[1]} de ${slotMatch[2]} a las ${slotMatch[3]}` },
      { role: 'assistant', content: selectData.response }
    );

    await new Promise(r => setTimeout(r, 1000));

    // Step 3: Contact info
    const ts = Date.now();
    const contactRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: `Me llamo Test Atocha ${ts}, email atocha${ts}@test.com, teléfono 612345678`,
        conversationHistory: history
      })
    });
    const contactData = await contactRes.json();
    console.log('3. Contact:', contactData.response?.substring(0, 100) + '...');

    history.push(
      { role: 'user', content: `Me llamo Test Atocha ${ts}, email atocha${ts}@test.com, teléfono 612345678` },
      { role: 'assistant', content: contactData.response }
    );

    await new Promise(r => setTimeout(r, 1000));

    // Step 4: Confirm
    const confirmRes = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: 'Sí, confirmo',
        conversationHistory: history
      })
    });
    const confirmData = await confirmRes.json();
    console.log('4. Confirm response:', confirmData.response?.substring(0, 150) + '...');
    console.log('   bookingCreated:', confirmData.bookingCreated);
    console.log('   appointmentId:', confirmData.appointmentId);

    if (confirmData.bookingCreated) {
      console.log('   ✅ SUCCESS');
    } else {
      console.log('   ❌ FAILED');
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

test().catch(console.error);
