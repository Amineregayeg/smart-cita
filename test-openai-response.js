const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ADMIN_HASH = '6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377';
const CHATBOT_URL = 'https://smart-cita.netlify.app/.netlify/functions';

async function testMultiple() {
  const authRes = await fetch(`${CHATBOT_URL}/admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordHash: ADMIN_HASH })
  });
  const { token } = await authRes.json();

  const tests = [
    'Sevilla tabaco',
    'Sevilla tabaco',
    'Sevilla tabaco',
    'Barcelona tabaco',
    'Barcelona tabaco',
    'Atocha tabaco',
    'Atocha tabaco',
    'Chamartin tabaco',
    'Majadahonda tabaco',
    'Torrejon tabaco'
  ];

  const results = { success: 0, fail: 0 };

  console.log('Testing chatbot availability 10 times...\n');

  for (let i = 0; i < tests.length; i++) {
    const [center, treatment] = tests[i].split(' ');
    const res = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: `¿Qué disponibilidad hay para ${treatment} en ${center}?`,
        conversationHistory: []
      })
    });
    const data = await res.json();

    const hasSlots = data.response?.includes(':00');
    const noAvail = data.response?.toLowerCase().includes('no hay disponibilidad');

    if (hasSlots && !noAvail) {
      results.success++;
      console.log(`[${i+1}] ${center} ${treatment}: ✅ HAS SLOTS`);
    } else {
      results.fail++;
      console.log(`[${i+1}] ${center} ${treatment}: ❌ NO AVAILABILITY`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`SUCCESS: ${results.success}/10 (${results.success*10}%)`);
  console.log(`FAILURES: ${results.fail}/10`);
  console.log(`${'='.repeat(40)}`);
}

testMultiple().catch(console.error);
