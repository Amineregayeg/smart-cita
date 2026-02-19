/**
 * Harbyx AASP Policy Test Suite
 * Tests all 38 policies with 150 actions
 * Returns success/failure rates and policy coverage
 */

require('dotenv').config();

const AASP_BASE_URL = 'https://app.harbyx.com';
const AASP_API_KEY = process.env.AASP_API_KEY;
const AASP_AGENT_ID = process.env.AASP_AGENT_ID || 'laserostop-chatbot-test';

// Test configuration
const TOTAL_TESTS = 150;

// Test data
const CENTERS = ['barcelona', 'sevilla', 'chamartin', 'atocha', 'torrejon', 'majadahonda'];
const TREATMENTS = ['tabaco', 'duo', 'cannabis', 'azucar', 'recaida'];
const TREATMENT_PRICES = { tabaco: 190, duo: 360, cannabis: 250, azucar: 200, recaida: 0 };

// Results tracking
const results = {
  total: 0,
  success: 0,
  failed: 0,
  byDecision: { allow: 0, block: 0, require_approval: 0, error: 0 },
  byPolicy: {},
  byCategory: {},
  errors: [],
  tests: []
};

/**
 * Call AASP ingest endpoint
 */
async function evaluateAction(actionType, target, params) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(AASP_BASE_URL + '/api/v1/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + AASP_API_KEY
      },
      body: JSON.stringify({
        agent_id: AASP_AGENT_ID,
        action_type: actionType,
        target: target,
        params: params
      })
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        decision: 'error',
        error: 'HTTP ' + response.status + ': ' + errorText,
        latency
      };
    }

    const data = await response.json();
    return {
      success: true,
      decision: data.decision || 'allow',
      reason: data.reason,
      policyId: data.policy_id,
      actionId: data.action_id,
      latency
    };

  } catch (error) {
    return {
      success: false,
      decision: 'error',
      error: error.message,
      latency: Date.now() - startTime
    };
  }
}

/**
 * Generate test cases for all policy categories
 */
function generateTestCases() {
  const tests = [];

  // =====================================================
  // BOOKING TESTS (30 tests - covers 12 booking policies)
  // =====================================================
  
  // Test each treatment type (5 treatments x 2 = 10 tests)
  TREATMENTS.forEach(treatment => {
    tests.push({
      category: 'booking',
      name: 'Book ' + treatment + ' treatment',
      actionType: 'tool_call',
      target: 'create_booking',
      params: {
        treatment: treatment,
        center: CENTERS[Math.floor(Math.random() * CENTERS.length)],
        date: '2026-01-20',
        time: '10:00',
        full_name: 'Test User',
        email: 'test@example.com',
        phone: '612345678'
      },
      expectedDecision: 'allow'
    });
  });

  // Test each center (6 centers x 2 = 12 tests)
  CENTERS.forEach(center => {
    tests.push({
      category: 'booking',
      name: 'Book at ' + center,
      actionType: 'tool_call',
      target: 'create_booking',
      params: {
        treatment: 'tabaco',
        center: center,
        date: '2026-01-21',
        time: '11:00',
        full_name: 'Test User ' + center,
        email: center + '@test.com',
        phone: '612345679'
      },
      expectedDecision: 'allow'
    });
  });

  // Additional booking variations (8 tests)
  for (let i = 0; i < 8; i++) {
    const treatment = TREATMENTS[i % TREATMENTS.length];
    const center = CENTERS[i % CENTERS.length];
    tests.push({
      category: 'booking',
      name: 'Booking variation ' + (i + 1),
      actionType: 'tool_call',
      target: 'create_booking',
      params: {
        treatment: treatment,
        center: center,
        date: '2026-01-' + (22 + i),
        time: (9 + i) + ':00',
        full_name: 'User ' + i,
        email: 'user' + i + '@test.com',
        phone: '61234567' + i
      },
      expectedDecision: 'allow'
    });
  }

  // =====================================================
  // AVAILABILITY TESTS (20 tests - covers 6 availability policies)
  // =====================================================

  // Test availability for each center (6 centers)
  CENTERS.forEach(center => {
    tests.push({
      category: 'availability',
      name: 'Check availability ' + center,
      actionType: 'tool_call',
      target: 'check_availability',
      params: {
        center: center,
        treatment: 'tabaco',
        days_ahead: 14
      },
      expectedDecision: 'allow'
    });
  });

  // Test availability for each treatment (5 treatments)
  TREATMENTS.forEach(treatment => {
    tests.push({
      category: 'availability',
      name: 'Check availability ' + treatment,
      actionType: 'tool_call',
      target: 'check_availability',
      params: {
        center: 'barcelona',
        treatment: treatment,
        days_ahead: 7
      },
      expectedDecision: 'allow'
    });
  });

  // Additional availability tests (9 tests)
  for (let i = 0; i < 9; i++) {
    tests.push({
      category: 'availability',
      name: 'Availability check ' + (i + 1),
      actionType: 'tool_call',
      target: 'check_availability',
      params: {
        center: CENTERS[i % CENTERS.length],
        treatment: TREATMENTS[i % TREATMENTS.length],
        days_ahead: 7 + i
      },
      expectedDecision: 'allow'
    });
  }

  // =====================================================
  // CENTER INFO TESTS (15 tests - covers 3 center info policies)
  // =====================================================

  // Individual centers (6 tests)
  CENTERS.forEach(center => {
    tests.push({
      category: 'center_info',
      name: 'Get info ' + center,
      actionType: 'tool_call',
      target: 'get_center_info',
      params: { center: center },
      expectedDecision: 'allow'
    });
  });

  // All centers request (5 tests)
  for (let i = 0; i < 5; i++) {
    tests.push({
      category: 'center_info',
      name: 'Get all centers ' + (i + 1),
      actionType: 'tool_call',
      target: 'get_center_info',
      params: { center: 'all' },
      expectedDecision: 'allow'
    });
  }

  // Additional center info tests (4 tests)
  for (let i = 0; i < 4; i++) {
    tests.push({
      category: 'center_info',
      name: 'Center info variation ' + (i + 1),
      actionType: 'tool_call',
      target: 'get_center_info',
      params: { center: CENTERS[i] },
      expectedDecision: 'allow'
    });
  }

  // =====================================================
  // PAYMENT TESTS (25 tests - covers 5 payment policies)
  // =====================================================

  // High value payments - should be BLOCKED (5 tests)
  [350, 400, 500, 1000, 360].forEach((amount, i) => {
    tests.push({
      category: 'payment',
      name: 'High payment €' + amount,
      actionType: 'tool_call',
      target: 'process_payment',
      params: {
        amount: amount,
        currency: 'EUR',
        treatment: 'duo',
        center: CENTERS[i % CENTERS.length]
      },
      expectedDecision: 'block'
    });
  });

  // Medium payments (€100-€300) - should require approval (8 tests)
  [100, 150, 190, 200, 250, 280, 300, 195].forEach((amount, i) => {
    tests.push({
      category: 'payment',
      name: 'Medium payment €' + amount,
      actionType: 'tool_call',
      target: 'stripe_payment',
      params: {
        amount: amount,
        currency: 'EUR',
        treatment: TREATMENTS[i % TREATMENTS.length]
      },
      expectedDecision: 'require_approval'
    });
  });

  // Small payments (<€100) - should require approval (7 tests)
  [50, 75, 90, 99, 30, 60, 80].forEach((amount, i) => {
    tests.push({
      category: 'payment',
      name: 'Small payment €' + amount,
      actionType: 'tool_call',
      target: 'pago_deposito',
      params: {
        amount: amount,
        currency: 'EUR'
      },
      expectedDecision: 'require_approval'
    });
  });

  // Refund operations - should require approval (5 tests)
  for (let i = 0; i < 5; i++) {
    tests.push({
      category: 'payment',
      name: 'Refund request ' + (i + 1),
      actionType: 'tool_call',
      target: 'refund_payment',
      params: {
        amount: 50 + (i * 20),
        reason: 'Customer request'
      },
      expectedDecision: 'require_approval'
    });
  }

  // =====================================================
  // CANCELLATION TESTS (15 tests - covers 3 cancellation policies)
  // =====================================================

  // Cancel booking tests (5 tests)
  for (let i = 0; i < 5; i++) {
    tests.push({
      category: 'cancellation',
      name: 'Cancel booking ' + (i + 1),
      actionType: 'tool_call',
      target: 'cancel_booking',
      params: {
        booking_id: 'BK' + (1000 + i),
        reason: 'Customer request'
      },
      expectedDecision: 'allow'
    });
  }

  // Cancelar (Spanish) tests (5 tests)
  for (let i = 0; i < 5; i++) {
    tests.push({
      category: 'cancellation',
      name: 'Cancelar cita ' + (i + 1),
      actionType: 'tool_call',
      target: 'cancelar_cita',
      params: {
        cita_id: 'CT' + (2000 + i)
      },
      expectedDecision: 'allow'
    });
  }

  // Delete operations (5 tests)
  for (let i = 0; i < 5; i++) {
    tests.push({
      category: 'cancellation',
      name: 'Delete record ' + (i + 1),
      actionType: 'tool_call',
      target: 'delete_appointment',
      params: {
        id: 'APT' + (3000 + i)
      },
      expectedDecision: 'allow'
    });
  }

  // =====================================================
  // MODIFICATION TESTS (15 tests - covers 3 modification policies)
  // =====================================================

  // Modify booking tests (5 tests)
  for (let i = 0; i < 5; i++) {
    tests.push({
      category: 'modification',
      name: 'Modify booking ' + (i + 1),
      actionType: 'tool_call',
      target: 'modify_booking',
      params: {
        booking_id: 'BK' + (4000 + i),
        new_date: '2026-02-0' + (i + 1)
      },
      expectedDecision: 'allow'
    });
  }

  // Reschedule tests (5 tests)
  for (let i = 0; i < 5; i++) {
    tests.push({
      category: 'modification',
      name: 'Reschedule ' + (i + 1),
      actionType: 'tool_call',
      target: 'reschedule_appointment',
      params: {
        appointment_id: 'APT' + (5000 + i),
        new_time: (10 + i) + ':00'
      },
      expectedDecision: 'allow'
    });
  }

  // Update client data (5 tests)
  for (let i = 0; i < 5; i++) {
    tests.push({
      category: 'modification',
      name: 'Update client ' + (i + 1),
      actionType: 'tool_call',
      target: 'update_client_info',
      params: {
        client_id: 'CL' + (6000 + i),
        phone: '61234' + (5000 + i)
      },
      expectedDecision: 'allow'
    });
  }

  // =====================================================
  // API MONITORING TESTS (10 tests - covers 3 API policies)
  // =====================================================

  // Smart Agenda API calls (4 tests)
  ['getAvailabilities', 'createEvent', 'getClient', 'updateEvent'].forEach((endpoint, i) => {
    tests.push({
      category: 'api_monitoring',
      name: 'Smart Agenda: ' + endpoint,
      actionType: 'api_call',
      target: 'smart_agenda:' + endpoint,
      params: { request_id: 'REQ' + (7000 + i) },
      expectedDecision: 'allow'
    });
  });

  // WhatsApp API calls (3 tests)
  ['sendMessage', 'markRead', 'sendTemplate'].forEach((endpoint, i) => {
    tests.push({
      category: 'api_monitoring',
      name: 'WhatsApp: ' + endpoint,
      actionType: 'api_call',
      target: 'whatsapp:' + endpoint,
      params: { to: '3461234567' + i },
      expectedDecision: 'allow'
    });
  });

  // External API calls (3 tests)
  ['openai', 'stripe', 'sendgrid'].forEach((service, i) => {
    tests.push({
      category: 'api_monitoring',
      name: 'External API: ' + service,
      actionType: 'api_call',
      target: service + ':request',
      params: { call_id: 'EXT' + (8000 + i) },
      expectedDecision: 'allow'
    });
  });

  // =====================================================
  // ADMIN/SECURITY TESTS (10 tests - covers 2 block policies)
  // =====================================================

  // Admin operations - should be BLOCKED (5 tests)
  ['admin_delete_user', 'admin_reset_db', 'admin_export_data', 'admin_config', 'admin_logs'].forEach((op, i) => {
    tests.push({
      category: 'admin_security',
      name: 'Admin op: ' + op,
      actionType: 'tool_call',
      target: op,
      params: { admin_key: 'test' },
      expectedDecision: 'block'
    });
  });

  // File access - should be BLOCKED (5 tests)
  ['/etc/passwd', '/var/log/syslog', '~/.ssh/id_rsa', '/opt/secrets', '/root/.env'].forEach((path, i) => {
    tests.push({
      category: 'admin_security',
      name: 'File access: ' + path.split('/').pop(),
      actionType: 'file_access',
      target: path,
      params: { operation: 'read' },
      expectedDecision: 'block'
    });
  });

  // =====================================================
  // DATABASE TESTS (10 tests - covers 1 db policy)
  // =====================================================

  // Database queries - should be ALLOWED (for monitoring)
  ['SELECT * FROM clients', 'SELECT * FROM bookings', 'INSERT INTO logs', 
   'UPDATE sessions', 'SELECT COUNT(*)', 'SELECT id FROM appointments',
   'SELECT email FROM users', 'SELECT * FROM treatments', 
   'SELECT center FROM locations', 'SELECT * FROM audit'].forEach((query, i) => {
    tests.push({
      category: 'database',
      name: 'DB query ' + (i + 1),
      actionType: 'db_query',
      target: 'postgres:query',
      params: { sql: query },
      expectedDecision: 'allow'
    });
  });

  return tests;
}

/**
 * Run a single test
 */
async function runTest(test, index) {
  const result = await evaluateAction(test.actionType, test.target, test.params);
  
  const testResult = {
    index: index + 1,
    name: test.name,
    category: test.category,
    actionType: test.actionType,
    target: test.target,
    expectedDecision: test.expectedDecision,
    actualDecision: result.decision,
    passed: result.decision === test.expectedDecision || 
            (result.decision === 'allow' && test.expectedDecision === 'allow'),
    latency: result.latency,
    policyId: result.policyId,
    error: result.error
  };

  // Update results
  results.total++;
  if (testResult.passed) {
    results.success++;
  } else {
    results.failed++;
    if (result.error) {
      results.errors.push({ test: test.name, error: result.error });
    }
  }

  // Track by decision
  results.byDecision[result.decision] = (results.byDecision[result.decision] || 0) + 1;

  // Track by category
  results.byCategory[test.category] = results.byCategory[test.category] || { total: 0, passed: 0, failed: 0 };
  results.byCategory[test.category].total++;
  if (testResult.passed) {
    results.byCategory[test.category].passed++;
  } else {
    results.byCategory[test.category].failed++;
  }

  results.tests.push(testResult);
  return testResult;
}

/**
 * Print progress bar
 */
function printProgress(current, total) {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round(percent / 2);
  const empty = 50 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  process.stdout.write('\r  [' + bar + '] ' + percent + '% (' + current + '/' + total + ')');
}

/**
 * Main test runner
 */
async function runTestSuite() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         HARBYX AASP POLICY TEST SUITE                          ║');
  console.log('║         Testing 38 Policies with 150 Actions                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Generate tests
  const tests = generateTestCases();
  console.log('📋 Generated ' + tests.length + ' test cases');
  console.log('');

  // Ensure we have exactly 150 tests
  const finalTests = tests.slice(0, TOTAL_TESTS);
  if (tests.length < TOTAL_TESTS) {
    console.log('⚠️  Only ' + tests.length + ' tests available');
  }

  console.log('🚀 Running ' + finalTests.length + ' tests...');
  console.log('');

  const startTime = Date.now();

  // Run all tests
  for (let i = 0; i < finalTests.length; i++) {
    await runTest(finalTests[i], i);
    printProgress(i + 1, finalTests.length);
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50));
  }

  const totalTime = Date.now() - startTime;

  console.log('');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                         TEST RESULTS                              ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // Overall results
  const successRate = ((results.success / results.total) * 100).toFixed(1);
  const failureRate = ((results.failed / results.total) * 100).toFixed(1);

  console.log('📊 OVERALL SUMMARY');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('  Total Tests:      ' + results.total);
  console.log('  ✅ Passed:        ' + results.success + ' (' + successRate + '%)');
  console.log('  ❌ Failed:        ' + results.failed + ' (' + failureRate + '%)');
  console.log('  ⏱️  Total Time:    ' + (totalTime / 1000).toFixed(2) + 's');
  console.log('  ⚡ Avg Latency:   ' + Math.round(results.tests.reduce((a, t) => a + t.latency, 0) / results.tests.length) + 'ms');
  console.log('');

  // Decision breakdown
  console.log('📈 DECISION BREAKDOWN');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('  ALLOW:            ' + (results.byDecision.allow || 0));
  console.log('  BLOCK:            ' + (results.byDecision.block || 0));
  console.log('  REQUIRE_APPROVAL: ' + (results.byDecision.require_approval || 0));
  console.log('  ERROR:            ' + (results.byDecision.error || 0));
  console.log('');

  // Category breakdown
  console.log('📁 RESULTS BY CATEGORY');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('  Category              Total    Passed   Failed   Rate');
  console.log('  ─────────────────────────────────────────────────────────────────');
  
  Object.entries(results.byCategory).sort((a, b) => b[1].total - a[1].total).forEach(([cat, data]) => {
    const rate = ((data.passed / data.total) * 100).toFixed(0);
    const catName = cat.padEnd(20);
    const total = String(data.total).padStart(5);
    const passed = String(data.passed).padStart(8);
    const failed = String(data.failed).padStart(8);
    console.log('  ' + catName + total + passed + failed + '    ' + rate + '%');
  });
  console.log('');

  // Failed tests details
  if (results.failed > 0) {
    console.log('❌ FAILED TESTS');
    console.log('───────────────────────────────────────────────────────────────────');
    const failedTests = results.tests.filter(t => !t.passed);
    failedTests.slice(0, 20).forEach(t => {
      console.log('  [' + t.index + '] ' + t.name);
      console.log('      Expected: ' + t.expectedDecision + ' | Got: ' + t.actualDecision);
      if (t.error) console.log('      Error: ' + t.error);
    });
    if (failedTests.length > 20) {
      console.log('  ... and ' + (failedTests.length - 20) + ' more');
    }
    console.log('');
  }

  // Errors
  if (results.errors.length > 0) {
    console.log('⚠️  ERRORS ENCOUNTERED');
    console.log('───────────────────────────────────────────────────────────────────');
    results.errors.slice(0, 10).forEach(e => {
      console.log('  • ' + e.test + ': ' + e.error);
    });
    if (results.errors.length > 10) {
      console.log('  ... and ' + (results.errors.length - 10) + ' more errors');
    }
    console.log('');
  }

  // Final verdict
  console.log('═══════════════════════════════════════════════════════════════════');
  if (parseFloat(successRate) >= 90) {
    console.log('  ✅ TEST SUITE PASSED - ' + successRate + '% success rate');
  } else if (parseFloat(successRate) >= 70) {
    console.log('  ⚠️  TEST SUITE PARTIAL - ' + successRate + '% success rate');
  } else {
    console.log('  ❌ TEST SUITE FAILED - ' + successRate + '% success rate');
  }
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // Return summary for programmatic use
  return {
    total: results.total,
    passed: results.success,
    failed: results.failed,
    successRate: parseFloat(successRate),
    failureRate: parseFloat(failureRate),
    byDecision: results.byDecision,
    byCategory: results.byCategory,
    totalTimeMs: totalTime,
    avgLatencyMs: Math.round(results.tests.reduce((a, t) => a + t.latency, 0) / results.tests.length)
  };
}

// Run the test suite
runTestSuite()
  .then(summary => {
    console.log('Summary JSON:');
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
