/**
 * Test Executor Framework
 * Runs test scenarios and collects results
 */

const policy = require('../config/policy.json');
const chatbot = require('./chatbotClient');
const smartAgenda = require('./smartAgendaClient');
const testDataManager = require('./testDataManager');
const redis = require('./redisClient');

/**
 * Test result structure
 */
function createTestResult(testId, status, details = {}) {
  return {
    testId,
    status, // 'PASS' | 'FAIL' | 'ERROR' | 'SKIP'
    duration: details.duration || 0,
    error: details.error || null,
    expected: details.expected || null,
    actual: details.actual || null,
    bookingId: details.bookingId || null,
    timestamp: Date.now()
  };
}

/**
 * Run a single test
 */
async function runTest(testDefinition) {
  const startTime = Date.now();
  let bookingId = null;

  try {
    console.log(`[TEST] Running: ${testDefinition.id} - ${testDefinition.name}`);

    // Execute test
    const result = await testDefinition.run({
      chatbot,
      smartAgenda,
      testDataManager,
      policy
    });

    // Track booking ID for cleanup
    if (result.bookingId) {
      bookingId = result.bookingId;
    }

    const duration = Date.now() - startTime;

    if (result.passed) {
      console.log(`[TEST] PASS: ${testDefinition.id} (${duration}ms)`);
      return createTestResult(testDefinition.id, 'PASS', { duration });
    } else {
      console.log(`[TEST] FAIL: ${testDefinition.id} - ${result.error}`);
      return createTestResult(testDefinition.id, 'FAIL', {
        duration,
        error: result.error,
        expected: result.expected,
        actual: result.actual
      });
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TEST] ERROR: ${testDefinition.id} - ${error.message}`);
    return createTestResult(testDefinition.id, 'ERROR', {
      duration,
      error: error.message
    });

  } finally {
    // ALWAYS cleanup test bookings
    if (bookingId) {
      try {
        await testDataManager.deleteTestBooking(bookingId);
      } catch (cleanupError) {
        console.error(`[TEST] Cleanup failed for ${bookingId}:`, cleanupError.message);
      }
    }
  }
}

/**
 * Run a suite of tests
 */
async function runTestSuite(tests, suiteName = 'default') {
  const runId = `${suiteName}-${Date.now()}`;
  console.log(`\n[SUITE] Starting: ${suiteName} (${tests.length} tests)`);
  console.log(`[SUITE] Run ID: ${runId}`);

  const results = [];
  const startTime = Date.now();

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);

    // Store individual result
    await redis.storeTestResult(result);

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const duration = Date.now() - startTime;
  const passedCount = results.filter(r => r.status === 'PASS').length;
  const failedCount = results.filter(r => r.status === 'FAIL').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  const passRate = ((passedCount / results.length) * 100).toFixed(1);
  const avgResponseTime = (results.reduce((sum, r) => sum + r.duration, 0) / results.length).toFixed(0);

  const summary = {
    runId,
    suiteName,
    totalTests: results.length,
    passedCount,
    failedCount,
    errorCount,
    passRate: parseFloat(passRate),
    avgResponseTime: parseFloat(avgResponseTime),
    duration,
    timestamp: Date.now(),
    results
  };

  // Store run summary
  await redis.storeRunSummary(runId, summary);

  // Add alerts for failures
  if (failedCount > 0 || errorCount > 0) {
    await redis.addAlert({
      type: 'test_failure',
      suite: suiteName,
      passRate: parseFloat(passRate),
      failedTests: results.filter(r => r.status !== 'PASS').map(r => r.testId)
    });
  }

  console.log(`\n[SUITE] Complete: ${suiteName}`);
  console.log(`[SUITE] Results: ${passedCount} passed, ${failedCount} failed, ${errorCount} errors`);
  console.log(`[SUITE] Pass rate: ${passRate}%`);
  console.log(`[SUITE] Duration: ${duration}ms\n`);

  return summary;
}

/**
 * Create a test definition
 */
function defineTest(id, name, category, runFn) {
  return {
    id,
    name,
    category,
    run: runFn
  };
}

/**
 * Assertion helpers
 */
const assert = {
  equals: (actual, expected, message) => {
    if (actual === expected) {
      return { passed: true };
    }
    return {
      passed: false,
      error: message || `Expected "${expected}" but got "${actual}"`,
      expected,
      actual
    };
  },

  contains: (text, substring, message) => {
    if (text && text.toLowerCase().includes(substring.toLowerCase())) {
      return { passed: true };
    }
    return {
      passed: false,
      error: message || `Expected text to contain "${substring}"`,
      expected: substring,
      actual: text?.substring(0, 200)
    };
  },

  notContains: (text, substring, message) => {
    if (!text || !text.toLowerCase().includes(substring.toLowerCase())) {
      return { passed: true };
    }
    return {
      passed: false,
      error: message || `Expected text NOT to contain "${substring}"`,
      expected: `not "${substring}"`,
      actual: text?.substring(0, 200)
    };
  },

  matches: (text, pattern, message) => {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    if (text && regex.test(text)) {
      return { passed: true };
    }
    return {
      passed: false,
      error: message || `Expected text to match pattern ${pattern}`,
      expected: String(pattern),
      actual: text?.substring(0, 200)
    };
  },

  notMatches: (text, pattern, message) => {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    if (!text || !regex.test(text)) {
      return { passed: true };
    }
    return {
      passed: false,
      error: message || `Expected text NOT to match pattern ${pattern}`,
      expected: `not ${String(pattern)}`,
      actual: text?.substring(0, 200)
    };
  },

  isTrue: (condition, message) => {
    if (condition) {
      return { passed: true };
    }
    return {
      passed: false,
      error: message || 'Expected condition to be true',
      expected: true,
      actual: false
    };
  },

  isFalse: (condition, message) => {
    if (!condition) {
      return { passed: true };
    }
    return {
      passed: false,
      error: message || 'Expected condition to be false',
      expected: false,
      actual: true
    };
  },

  arrayContains: (array, item, message) => {
    if (array && array.includes(item)) {
      return { passed: true };
    }
    return {
      passed: false,
      error: message || `Expected array to contain "${item}"`,
      expected: item,
      actual: array
    };
  },

  slotsMatch: (botSlots, apiSlots, message) => {
    // Every slot bot shows must exist in API response
    for (const botSlot of botSlots) {
      const found = apiSlots.some(apiSlot =>
        apiSlot.date === botSlot.date &&
        apiSlot.times.includes(botSlot.time)
      );
      if (!found) {
        return {
          passed: false,
          error: message || `Bot showed slot ${botSlot.date} ${botSlot.time} not in API response`,
          expected: 'Slots from API only',
          actual: botSlot
        };
      }
    }
    return { passed: true };
  },

  noForbiddenContent: (text, forbiddenList, message) => {
    const lowerText = text?.toLowerCase() || '';
    for (const forbidden of forbiddenList) {
      if (lowerText.includes(forbidden.toLowerCase())) {
        return {
          passed: false,
          error: message || `Found forbidden content: "${forbidden}"`,
          expected: 'No forbidden content',
          actual: forbidden
        };
      }
    }
    return { passed: true };
  }
};

module.exports = {
  runTest,
  runTestSuite,
  defineTest,
  assert,
  createTestResult
};
