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

  console.log('Testing Sevilla tabaco 3 times...\n');

  for (let i = 1; i <= 3; i++) {
    console.log(`--- Attempt ${i} ---`);
    const res = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: '¿Qué disponibilidad hay para tabaco en Sevilla?',
        conversationHistory: []
      })
    });
    const data = await res.json();

    if (data.response.includes('No hay disponibilidad') || data.response.includes('no hay disponibilidad')) {
      console.log('Result: ❌ NO AVAILABILITY');
    } else if (data.response.includes(':00')) {
      console.log('Result: ✅ HAS SLOTS');
      console.log('Response preview:', data.response.substring(0, 150) + '...');
    } else {
      console.log('Result: ? UNCLEAR');
      console.log('Response:', data.response.substring(0, 200) + '...');
    }
    console.log('');

    // Small delay between requests
    await new Promise(r => setTimeout(r, 2000));
  }
}

test().catch(console.error);
