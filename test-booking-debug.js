const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const ADMIN_HASH = '6e659deaa85842cdabb5c6305fcc40033ba43772ec00d45c2a3c921741a5e377';
const CHATBOT_URL = 'https://smart-cita.netlify.app/.netlify/functions';

async function test() {
  // Get token
  const authRes = await fetch(`${CHATBOT_URL}/admin-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordHash: ADMIN_HASH })
  });
  const { token } = await authRes.json();
  console.log('Token obtained\n');

  async function chat(msg, history = []) {
    const res = await fetch(`${CHATBOT_URL}/admin-test-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: msg, conversationHistory: history })
    });
    return res.json();
  }

  // Test Barcelona booking step by step
  console.log('=== BARCELONA BOOKING TEST ===\n');

  const history = [];

  // Step 1
  console.log('Step 1: Ask availability');
  let r1 = await chat('Quiero una cita en Barcelona para tabaco', history);
  console.log('Response:', r1.response);
  console.log('');
  history.push({ role: 'user', content: 'Quiero una cita en Barcelona para tabaco' });
  history.push({ role: 'assistant', content: r1.response });

  // Step 2 - use exact slot from response
  console.log('Step 2: Choose slot 15:00 sábado 3 enero');
  let r2 = await chat('Quiero el sábado 3 de enero a las 15:00', history);
  console.log('Response:', r2.response);
  console.log('');
  history.push({ role: 'user', content: 'Quiero el sábado 3 de enero a las 15:00' });
  history.push({ role: 'assistant', content: r2.response });

  // Step 3
  console.log('Step 3: Provide details');
  let r3 = await chat('Me llamo Juan Test Garcia, mi email es juantest999@test.com y mi teléfono es 699888777', history);
  console.log('Response:', r3.response);
  console.log('');
  history.push({ role: 'user', content: 'Me llamo Juan Test Garcia, mi email es juantest999@test.com y mi teléfono es 699888777' });
  history.push({ role: 'assistant', content: r3.response });

  // Step 4
  console.log('Step 4: Confirm');
  let r4 = await chat('Sí', history);
  console.log('Response:', r4.response);
  console.log('\nbookingCreated:', r4.bookingCreated);
  console.log('appointmentId:', r4.appointmentId);

  // Cleanup if created
  if (r4.appointmentId) {
    console.log('\n--- Cleaning up ---');
    const SA = { login: 'eshapi48Kd79BmSy83A', pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150', api_id: 'app_landing', api_key: '95Gt-Ke92-48Uf39Sp27hF' };
    const tokenRes = await fetch('https://www.smartagenda.fr/pro/laserostop-esh/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(SA)
    });
    const { token: saToken } = await tokenRes.json();

    const delRes = await fetch(`https://www.smartagenda.fr/pro/laserostop-esh/api/pdo_events/${r4.appointmentId}`, {
      method: 'DELETE', headers: { 'X-SMARTAPI-TOKEN': saToken }
    });
    console.log('Deleted appointment:', delRes.ok);

    // Also delete test client
    const clientsRes = await fetch('https://www.smartagenda.fr/pro/laserostop-esh/api/pdo_client', {
      headers: { 'X-SMARTAPI-TOKEN': saToken }
    });
    const clients = await clientsRes.json();
    const testClient = clients.find(c => c.mail === 'juantest999@test.com');
    if (testClient) {
      const delClientRes = await fetch(`https://www.smartagenda.fr/pro/laserostop-esh/api/pdo_client/${testClient.id}`, {
        method: 'DELETE', headers: { 'X-SMARTAPI-TOKEN': saToken }
      });
      console.log('Deleted client:', delClientRes.ok);
    }
  }
}

test().catch(console.error);
