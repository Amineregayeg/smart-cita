const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SA_URL = 'https://www.smartagenda.fr/pro/laserostop-esh/api';
const SA_CREDS = { login: 'eshapi48Kd79BmSy83A', pwd: 'f3be0da94b09f33ae362fa92a069508c50c67150', api_id: 'app_landing', api_key: '95Gt-Ke92-48Uf39Sp27hF' };

async function deleteTestBookings() {
  // Get token
  const tokenRes = await fetch(`${SA_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SA_CREDS)
  });
  const { token } = await tokenRes.json();
  console.log('Token obtained\n');

  // Test booking IDs created during our testing sessions
  const testBookingIds = [
    7944, 7945, 7946, 7947, 7948, 7949, 7950, 7951, 7952, 7953,
    7954, 7955, 7956, 7957, 7958, 7959, 7960, 7961, 7962, 7963,
    7964, 7965, 7966, 7967, 7968, 7969,
    7970, 7971, 7972, 7973, 7974, 7975, 7976, 7977,
    7978, 7979, 7980, 7981, 7982, 7983, 7984, 7985, 7986, 7987
  ];

  console.log(`Attempting to delete ${testBookingIds.length} test bookings...\n`);

  let deleted = 0;
  let notFound = 0;
  let skipped = 0;
  let errors = 0;

  for (const id of testBookingIds) {
    try {
      // First, get booking details
      const getRes = await fetch(`${SA_URL}/pdo_events/${id}`, {
        headers: { 'X-SMARTAPI-TOKEN': token }
      });

      if (getRes.status === 404) {
        console.log(`ID ${id}: Not found`);
        notFound++;
        continue;
      }

      const booking = await getRes.json();

      // Safety check: only delete if it looks like a test booking
      const clientPrenom = booking.client_prenom || '';
      const clientNom = booking.client_nom || '';
      const clientMail = booking.client_mail || '';

      const isTestBooking =
        clientPrenom.toLowerCase().includes('test') ||
        clientNom.toLowerCase().includes('test') ||
        clientMail.includes('@example.com') ||
        clientMail.includes('@test.com');

      if (!isTestBooking) {
        console.log(`ID ${id}: SKIPPED - Real booking (${clientPrenom} ${clientNom}, ${clientMail})`);
        skipped++;
        continue;
      }

      // Delete the test booking
      const deleteRes = await fetch(`${SA_URL}/pdo_events/${id}`, {
        method: 'DELETE',
        headers: { 'X-SMARTAPI-TOKEN': token }
      });

      if (deleteRes.ok || deleteRes.status === 204 || deleteRes.status === 200) {
        console.log(`ID ${id}: DELETED (${clientPrenom} ${clientNom})`);
        deleted++;
      } else {
        const errText = await deleteRes.text();
        console.log(`ID ${id}: Delete failed - ${deleteRes.status} ${errText}`);
        errors++;
      }

    } catch (error) {
      console.log(`ID ${id}: Error - ${error.message}`);
      errors++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`SUMMARY:`);
  console.log(`  Deleted: ${deleted}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Skipped (real bookings): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log('='.repeat(50));
}

deleteTestBookings().catch(console.error);
