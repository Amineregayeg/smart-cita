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

  const tests = [
    ['Sevilla', 'tabaco'],
    ['Barcelona', 'tabaco'],
    ['Atocha', 'tabaco'],
  ];

  console.log('Testing chatbot with debug output...\n');
  console.log('='.repeat(80));

  for (const [center, treatment] of tests) {
    console.log(`\n>>> ${center} - ${treatment}`);

    const res = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: `¿Qué disponibilidad hay para ${treatment} en ${center}?`,
        conversationHistory: []
      })
    });
    const data = await res.json();

    console.log('\n--- DEBUG INFO ---');
    console.log('Tools called:', data.debug?.toolsCalled || 'none');
    const avail = data.debug?.availability;
    if (avail) {
      console.log('Center:', avail.center);
      console.log('Slots found (after filter):', avail.slotsFound);
      console.log('Slots before filter:', avail.slotsBeforeFilter);
      console.log('API Debug:', JSON.stringify(avail.apiDebug, null, 2));
    }

    console.log('\n--- RESPONSE ---');
    const hasSlots = data.response?.includes(':00');
    const noAvail = data.response?.toLowerCase().includes('no hay disponibilidad') ||
                   data.response?.toLowerCase().includes('no disponemos');
    console.log('Response preview:', data.response?.substring(0, 200) + '...');
    console.log('Result:', hasSlots ? '✅ HAS SLOTS' : noAvail ? '❌ NO AVAIL' : '⚠️ UNCLEAR');

    console.log('\n' + '='.repeat(80));

    await new Promise(r => setTimeout(r, 2000));
  }
}

test().catch(console.error);
