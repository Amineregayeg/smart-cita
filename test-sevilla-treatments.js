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

  const treatments = ['tabaco', 'cannabis', 'azucar'];

  console.log('Testing Sevilla with different treatments...\n');

  for (const treatment of treatments) {
    const res = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: `¿Qué disponibilidad hay para ${treatment} en Sevilla?`,
        conversationHistory: []
      })
    });
    const data = await res.json();

    const hasSlots = data.response?.includes(':00');
    const noAvail = data.response?.toLowerCase().includes('no hay disponibilidad');

    console.log(`Sevilla ${treatment}: ${hasSlots ? '✅ HAS SLOTS' : noAvail ? '❌ NO AVAIL' : '? UNCLEAR'}`);
    if (hasSlots) {
      // Extract first date
      const match = data.response.match(/(\d+ de \w+)/);
      console.log(`   First slot: ${match ? match[1] : 'unknown'}`);
    }
    console.log('');
    await new Promise(r => setTimeout(r, 2000));
  }
}

test().catch(console.error);
