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
    ['Barcelona', 'tabaco'],
    ['Barcelona', 'cannabis'],
    ['Barcelona', 'azucar'],
    ['Sevilla', 'tabaco'],
    ['Sevilla', 'cannabis'],
    ['Sevilla', 'azucar'],
    ['Atocha', 'tabaco'],
    ['Atocha', 'cannabis'],
  ];

  console.log('Testing all center/treatment combinations...\n');

  for (const [center, treatment] of tests) {
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

    console.log(`${center.padEnd(12)} ${treatment.padEnd(10)}: ${hasSlots ? '✅' : noAvail ? '❌' : '?'}`);
    await new Promise(r => setTimeout(r, 1500));
  }
}

test().catch(console.error);
