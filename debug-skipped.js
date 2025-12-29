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

  const skippedCases = [
    ['Sevilla', 'tabaco'],
    ['Chamartin', 'tabaco'],
    ['Sevilla', 'cannabis'],
    ['Barcelona', 'azucar'],
    ['Sevilla', 'azucar'],
    ['Majadahonda', 'tabaco'],
    ['Torrejon', 'tabaco']
  ];

  for (const [center, treatment] of skippedCases) {
    const res = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        message: `¿Qué disponibilidad hay para ${treatment} en ${center}?`,
        conversationHistory: []
      })
    });
    const data = await res.json();
    console.log(`\n${'='.repeat(50)}`);
    console.log(`${center} - ${treatment}`);
    console.log('='.repeat(50));
    console.log(data.response);
  }
}

test().catch(console.error);
