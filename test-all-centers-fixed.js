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
    // All centers with tabaco
    ['Barcelona', 'tabaco'],
    ['Sevilla', 'tabaco'],
    ['Chamartin', 'tabaco'],
    ['Atocha', 'tabaco'],
    ['Torrejon', 'tabaco'],
    ['Majadahonda', 'tabaco'],
    // Other treatments
    ['Barcelona', 'cannabis'],
    ['Barcelona', 'azucar'],
    ['Sevilla', 'cannabis'],
    ['Atocha', 'cannabis'],
  ];

  console.log('Testing all centers after days_ahead fix...\n');
  console.log('='.repeat(60));

  const results = { pass: 0, fail: 0 };

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
    const noAvail = data.response?.toLowerCase().includes('no hay disponibilidad') ||
                   data.response?.toLowerCase().includes('no disponemos');
    const apiStatus = data.debug?.availability?.apiDebug?.status;
    const slotsFound = data.debug?.availability?.slotsFound || 0;

    if (hasSlots && slotsFound > 0) {
      results.pass++;
      console.log(`✅ ${center.padEnd(12)} ${treatment.padEnd(10)}: ${slotsFound} days (API: ${apiStatus})`);
    } else if (noAvail && apiStatus === 404) {
      results.pass++;  // Correct behavior - no slots available
      console.log(`✅ ${center.padEnd(12)} ${treatment.padEnd(10)}: No slots within 14 days (API: 404)`);
    } else {
      results.fail++;
      console.log(`❌ ${center.padEnd(12)} ${treatment.padEnd(10)}: ISSUE - API: ${apiStatus}, slots: ${slotsFound}`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${results.pass}/${tests.length} passed (${results.fail} failures)`);
  console.log('='.repeat(60));
}

test().catch(console.error);
