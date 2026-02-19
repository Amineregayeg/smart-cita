/**
 * Harbyx AASP Policy Setup Script
 * Creates 32 comprehensive security policies for LaserOstop Chatbot
 * Run: node setup-harbyx-policies.js
 */

require('dotenv').config();

const AASP_BASE_URL = 'https://app.harbyx.com';
const AASP_API_KEY = process.env.AASP_API_KEY;

if (!AASP_API_KEY) {
  console.error('ERROR: AASP_API_KEY not set in environment');
  process.exit(1);
}

// All 32 policies
const POLICIES = [
  // BOOKING POLICIES (8)
  {
    name: 'log_all_bookings',
    description: 'Audit trail for all booking creations',
    priority: 50,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'create_booking',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_tabaco_bookings',
    description: 'Track individual smoking cessation bookings (€190)',
    priority: 101,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'create_booking',
      conditions: [
        { field: 'params.treatment', operator: 'eq', value: 'tabaco' }
      ],
      effect: 'allow'
    }]
  },
  {
    name: 'log_duo_bookings',
    description: 'Track duo treatment bookings (€360)',
    priority: 102,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'create_booking',
      conditions: [
        { field: 'params.treatment', operator: 'eq', value: 'duo' }
      ],
      effect: 'allow'
    }]
  },
  {
    name: 'log_cannabis_bookings',
    description: 'Track cannabis addiction treatment bookings (€250)',
    priority: 103,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'create_booking',
      conditions: [
        { field: 'params.treatment', operator: 'eq', value: 'cannabis' }
      ],
      effect: 'allow'
    }]
  },
  {
    name: 'log_azucar_bookings',
    description: 'Track sugar addiction treatment bookings (€200)',
    priority: 104,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'create_booking',
      conditions: [
        { field: 'params.treatment', operator: 'eq', value: 'azucar' }
      ],
      effect: 'allow'
    }]
  },
  {
    name: 'log_recaida_bookings',
    description: 'Track free relapse session bookings (€0)',
    priority: 105,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'create_booking',
      conditions: [
        { field: 'params.treatment', operator: 'eq', value: 'recaida' }
      ],
      effect: 'allow'
    }]
  },
  {
    name: 'log_barcelona_bookings',
    description: 'Track all Barcelona center bookings',
    priority: 110,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'create_booking',
      conditions: [
        { field: 'params.center', operator: 'eq', value: 'barcelona' }
      ],
      effect: 'allow'
    }]
  },
  {
    name: 'log_madrid_bookings',
    description: 'Track all Madrid area bookings',
    priority: 111,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'create_booking',
      conditions: [
        { field: 'params.center', operator: 'in', value: ['chamartin', 'atocha', 'torrejon', 'majadahonda'] }
      ],
      effect: 'allow'
    }]
  },

  // AVAILABILITY POLICIES (4)
  {
    name: 'log_all_availability_checks',
    description: 'Track all availability queries',
    priority: 10,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'check_availability',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_barcelona_availability',
    description: 'Track Barcelona availability queries',
    priority: 11,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'check_availability',
      conditions: [
        { field: 'params.center', operator: 'eq', value: 'barcelona' }
      ],
      effect: 'allow'
    }]
  },
  {
    name: 'log_sevilla_availability',
    description: 'Track Sevilla availability queries',
    priority: 12,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'check_availability',
      conditions: [
        { field: 'params.center', operator: 'eq', value: 'sevilla' }
      ],
      effect: 'allow'
    }]
  },
  {
    name: 'log_madrid_availability',
    description: 'Track Madrid area availability queries',
    priority: 13,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'check_availability',
      conditions: [
        { field: 'params.center', operator: 'in', value: ['chamartin', 'atocha', 'torrejon', 'majadahonda'] }
      ],
      effect: 'allow'
    }]
  },

  // CENTER INFO POLICIES (3)
  {
    name: 'log_all_center_info',
    description: 'Track all center information requests',
    priority: 5,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'get_center_info',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_specific_center_requests',
    description: 'Track when specific center info is requested',
    priority: 6,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'get_center_info',
      conditions: [
        { field: 'params.center', operator: 'neq', value: 'all' }
      ],
      effect: 'allow'
    }]
  },
  {
    name: 'log_all_centers_request',
    description: 'Track when all centers info is requested',
    priority: 7,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'get_center_info',
      conditions: [
        { field: 'params.center', operator: 'eq', value: 'all' }
      ],
      effect: 'allow'
    }]
  },

  // FINANCIAL/PAYMENT POLICIES (5)
  {
    name: 'block_high_value_payments',
    description: 'BLOCK payment operations over €300',
    priority: 500,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*payment.*|.*stripe.*|.*pago.*|.*cobrar.*',
      conditions: [
        { field: 'params.amount', operator: 'gt', value: 300 }
      ],
      effect: 'block'
    }]
  },
  {
    name: 'approve_medium_payments',
    description: 'REQUIRE APPROVAL for payments €100-€300',
    priority: 450,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*payment.*|.*stripe.*|.*pago.*|.*cobrar.*',
      conditions: [
        { field: 'params.amount', operator: 'gte', value: 100 },
        { field: 'params.amount', operator: 'lte', value: 300 }
      ],
      effect: 'require_approval'
    }],
    approvalSla: 30
  },
  {
    name: 'approve_small_payments',
    description: 'REQUIRE APPROVAL for payments under €100',
    priority: 440,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*payment.*|.*stripe.*|.*pago.*|.*cobrar.*',
      conditions: [
        { field: 'params.amount', operator: 'lt', value: 100 }
      ],
      effect: 'require_approval'
    }],
    approvalSla: 15
  },
  {
    name: 'log_all_payment_attempts',
    description: 'Audit all payment-related operations',
    priority: 400,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*payment.*|.*stripe.*|.*pago.*|.*cobrar.*|.*factura.*',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_refund_operations',
    description: 'Track all refund-related operations',
    priority: 410,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*refund.*|.*reembolso.*|.*devolucion.*',
      conditions: [],
      effect: 'require_approval'
    }],
    approvalSla: 60
  },

  // CANCELLATION POLICIES (3)
  {
    name: 'log_all_cancellations',
    description: 'Track all booking cancellation attempts',
    priority: 200,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*cancel.*|.*anular.*|.*cancelar.*',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_delete_operations',
    description: 'Track all delete operations',
    priority: 201,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*delete.*|.*eliminar.*|.*borrar.*',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_booking_removal',
    description: 'Track booking removal operations',
    priority: 202,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*remove.*booking.*|.*quitar.*cita.*',
      conditions: [],
      effect: 'allow'
    }]
  },

  // MODIFICATION POLICIES (3)
  {
    name: 'log_all_modifications',
    description: 'Track all modification operations',
    priority: 210,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*modify.*|.*modificar.*|.*update.*|.*actualizar.*',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_reschedule_operations',
    description: 'Track all reschedule operations',
    priority: 211,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*reschedule.*|.*reprogramar.*|.*cambiar.*fecha.*',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_client_data_changes',
    description: 'Track client information modifications',
    priority: 212,
    rules: [{
      actionType: 'tool_call',
      targetPattern: '.*edit.*client.*|.*update.*client.*|.*cambiar.*cliente.*',
      conditions: [],
      effect: 'allow'
    }]
  },

  // API MONITORING POLICIES (3)
  {
    name: 'log_smart_agenda_api',
    description: 'Monitor Smart Agenda API interactions',
    priority: 20,
    rules: [{
      actionType: 'api_call',
      targetPattern: 'smart_agenda:.*',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_whatsapp_api',
    description: 'Monitor WhatsApp API interactions',
    priority: 21,
    rules: [{
      actionType: 'api_call',
      targetPattern: 'whatsapp:.*|graph.facebook.com.*whatsapp.*',
      conditions: [],
      effect: 'allow'
    }]
  },
  {
    name: 'log_external_api',
    description: 'Monitor all external API calls',
    priority: 22,
    rules: [{
      actionType: 'api_call',
      targetPattern: '.*',
      conditions: [],
      effect: 'allow'
    }]
  },

  // ADMIN/SECURITY POLICIES (2)
  {
    name: 'block_admin_operations',
    description: 'Prevent AI from admin-level operations',
    priority: 600,
    rules: [{
      actionType: 'tool_call',
      targetPattern: 'admin:.*|.*admin.*',
      conditions: [],
      effect: 'block'
    }]
  },
  {
    name: 'block_file_access',
    description: 'Prevent file system operations',
    priority: 600,
    rules: [{
      actionType: 'file_access',
      targetPattern: '.*',
      conditions: [],
      effect: 'block'
    }]
  },

  // DATA ACCESS POLICIES (1)
  {
    name: 'log_database_queries',
    description: 'Monitor all database queries (allow for auditing)',
    priority: 30,
    rules: [{
      actionType: 'db_query',
      targetPattern: '.*',
      conditions: [],
      effect: 'allow'
    }]
  }
];

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
    throw new Error('Failed to create policy ' + policy.name + ': ' + response.status + ' - ' + errorText);
  }

  return await response.json();
}

async function listPolicies() {
  const response = await fetch(AASP_BASE_URL + '/api/v1/policies', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + AASP_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error('Failed to list policies: ' + response.status);
  }

  return await response.json();
}

async function deletePolicy(policyId) {
  const response = await fetch(AASP_BASE_URL + '/api/v1/policies/' + policyId, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer ' + AASP_API_KEY
    }
  });

  return response.ok;
}

async function main() {
  console.log('='.repeat(60));
  console.log('HARBYX AASP POLICY SETUP');
  console.log('Creating 32 security policies for LaserOstop Chatbot');
  console.log('='.repeat(60));
  console.log('');

  // First, list existing policies
  console.log('[1/3] Checking existing policies...');
  try {
    const existingPolicies = await listPolicies();
    console.log('Found ' + (existingPolicies.policies?.length || 0) + ' existing policies');
    
    // Delete existing policies with matching names
    if (existingPolicies.policies && existingPolicies.policies.length > 0) {
      console.log('Cleaning up old policies...');
      for (const policy of existingPolicies.policies) {
        const matchingPolicy = POLICIES.find(p => p.name === policy.name);
        if (matchingPolicy) {
          console.log('  Deleting: ' + policy.name);
          await deletePolicy(policy.id);
        }
      }
    }
  } catch (error) {
    console.log('Note: Could not list/delete existing policies: ' + error.message);
  }

  console.log('');
  console.log('[2/3] Creating ' + POLICIES.length + ' new policies...');
  console.log('');

  let created = 0;
  let failed = 0;
  const results = [];

  for (const policy of POLICIES) {
    try {
      const result = await createPolicy(policy);
      console.log('  ✓ Created: ' + policy.name + ' (ID: ' + result.policy?.id + ')');
      created++;
      results.push({ name: policy.name, id: result.policy?.id, status: 'created' });
    } catch (error) {
      console.log('  ✗ Failed: ' + policy.name + ' - ' + error.message);
      failed++;
      results.push({ name: policy.name, error: error.message, status: 'failed' });
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('[3/3] Summary');
  console.log('='.repeat(60));
  console.log('Total policies: ' + POLICIES.length);
  console.log('Created: ' + created);
  console.log('Failed: ' + failed);
  console.log('');

  // Verify final state
  try {
    const finalPolicies = await listPolicies();
    console.log('Policies now in Harbyx: ' + (finalPolicies.policies?.length || 0));
  } catch (error) {
    console.log('Could not verify final state: ' + error.message);
  }

  console.log('');
  console.log('Setup complete! Check https://app.harbyx.com for your policies.');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});
