require('dotenv').config();

const AASP_BASE_URL = 'https://app.harbyx.com';
const AASP_API_KEY = process.env.AASP_API_KEY;

const MADRID_CENTERS = ['chamartin', 'atocha', 'torrejon', 'majadahonda'];

// Create individual policies for each Madrid center
const MADRID_POLICIES = [];

// Booking policies for Madrid centers
MADRID_CENTERS.forEach((center, i) => {
  MADRID_POLICIES.push({
    name: 'log_' + center + '_bookings',
    description: 'Track ' + center.charAt(0).toUpperCase() + center.slice(1) + ' center bookings',
    priority: 112 + i,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'create_booking',
      conditions: [
        { field: 'params.center', operator: 'eq', value: center }
      ],
      effect: 'allow'
    }]
  });
});

// Availability policies for Madrid centers
MADRID_CENTERS.forEach((center, i) => {
  MADRID_POLICIES.push({
    name: 'log_' + center + '_availability',
    description: 'Track ' + center.charAt(0).toUpperCase() + center.slice(1) + ' availability queries',
    priority: 14 + i,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'check_availability',
      conditions: [
        { field: 'params.center', operator: 'eq', value: center }
      ],
      effect: 'allow'
    }]
  });
});

async function createPolicy(policy) {
  const response = await fetch(AASP_BASE_URL + '/api/v1/policies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + AASP_API_KEY
    },
    body: JSON.stringify(policy)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('Failed: ' + response.status + ' - ' + errorText);
  }

  return await response.json();
}

async function main() {
  console.log('Creating ' + MADRID_POLICIES.length + ' Madrid center policies...');
  
  for (const policy of MADRID_POLICIES) {
    try {
      const result = await createPolicy(policy);
      console.log('  ✓ ' + policy.name + ' (ID: ' + result.policy?.id + ')');
    } catch (error) {
      console.log('  ✗ ' + policy.name + ' - ' + error.message);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log('Done!');
}

main();
