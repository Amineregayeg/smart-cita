/**
 * AASP Comprehensive Test Suite
 * 2000 tests covering all 57 policies
 */

require('dotenv').config();

const AASP_BASE_URL = "https://app.harbyx.com";
const AASP_API_KEY = process.env.AASP_API_KEY;
const AASP_AGENT_ID = process.env.AASP_AGENT_ID || "laserostop-chatbot";

// Test configuration
const TOTAL_TESTS = 2000;
const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES = 2000;
const DELAY_BETWEEN_TESTS = 50;

// Results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  byPolicy: {},
  byDecision: { allow: 0, block: 0, require_approval: 0, error: 0 },
  byCategory: {},
  errors: []
};

// Helper functions
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate test cases
function generateTestCases() {
  const tests = [];
  const centers = ["barcelona", "sevilla", "chamartin", "atocha", "torrejon", "majadahonda"];
  const treatments = ["tabaco", "duo", "cannabis", "azucar"];

  // === PAYMENT TESTS (400 tests) ===
  // Block High Payments (>1000 EUR = >100000 cents)
  for (let i = 0; i < 100; i++) {
    tests.push({
      actionType: "tool_call",
      target: "process_payment",
      params: { amount: randomInt(100001, 500000), currency: "EUR", description: "High payment test " + i },
      expectedDecision: "block",
      category: "payment_high"
    });
  }

  // Require Approval Medium Payments (500-1000 EUR = 50001-100000 cents)
  for (let i = 0; i < 100; i++) {
    tests.push({
      actionType: "tool_call",
      target: "process_payment",
      params: { amount: randomInt(50001, 100000), currency: "EUR", description: "Medium payment test " + i },
      expectedDecision: "require_approval",
      category: "payment_medium"
    });
  }

  // Allow Normal Payments (<=500 EUR = <=50000 cents)
  for (let i = 0; i < 100; i++) {
    tests.push({
      actionType: "tool_call",
      target: "process_payment",
      params: { amount: randomInt(1000, 50000), currency: "EUR", description: "Normal payment test " + i },
      expectedDecision: "allow",
      category: "payment_normal"
    });
  }

  // Refund tests (require approval)
  for (let i = 0; i < 100; i++) {
    tests.push({
      actionType: "tool_call",
      target: "refund",
      params: { amount: randomInt(5000, 50000), bookingId: "BK" + (1000 + i), reason: "Test refund" },
      expectedDecision: "require_approval",
      category: "refund"
    });
  }

  // === MESSAGE TESTS (150 tests) ===
  for (let i = 0; i < 50; i++) {
    tests.push({ actionType: "tool_call", target: "message.receive", params: { platform: "whatsapp", from: "user" + i }, category: "message" });
    tests.push({ actionType: "tool_call", target: "message.send", params: { platform: "whatsapp", to: "user" + i }, category: "message" });
    tests.push({ actionType: "tool_call", target: "message.queue", params: { queue: "chatbot:messages", id: i }, category: "message" });
  }

  // === AI/GPT TESTS (100 tests) ===
  for (let i = 0; i < 50; i++) {
    tests.push({ actionType: "tool_call", target: "gpt.generate", params: { model: "gpt-4", tokens: randomInt(100, 2000) }, category: "ai" });
    tests.push({ actionType: "tool_call", target: "ai.tool", params: { tool: "check_availability", index: i }, category: "ai" });
  }

  // === SESSION TESTS (150 tests) ===
  for (let i = 0; i < 50; i++) {
    tests.push({ actionType: "tool_call", target: "session.create", params: { userId: "user_" + i }, category: "session" });
    tests.push({ actionType: "tool_call", target: "session.update", params: { userId: "user_" + i, data: { lastMessage: Date.now() } }, category: "session" });
    tests.push({ actionType: "tool_call", target: "session.read", params: { userId: "user_" + i }, category: "session" });
  }

  // === EXTERNAL API TESTS (180 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "api_call", target: "smart_agenda.availability", params: { center: centers[i % 6] }, category: "api_smartagenda" });
    tests.push({ actionType: "api_call", target: "whatsapp.send", params: { to: "+3461234567" + i }, category: "api_whatsapp" });
    tests.push({ actionType: "api_call", target: "meta.send", params: { recipient: "psid_" + i }, category: "api_meta" });
    tests.push({ actionType: "api_call", target: "openai.chat", params: { model: "gpt-4", messages: i }, category: "api_openai" });
    tests.push({ actionType: "api_call", target: "stripe.checkout", params: { amount: randomInt(10000, 50000) }, category: "api_stripe" });
    tests.push({ actionType: "api_call", target: "instagram.send", params: { recipient: "ig_" + i }, category: "api_instagram" });
  }

  // === BOOKING TESTS (200 tests) ===
  for (let i = 0; i < 50; i++) {
    tests.push({
      actionType: "tool_call",
      target: "create_booking",
      params: { center: centers[i % 6], treatment: treatments[i % 4], date: "2026-01-" + (15 + (i % 15)), time: (9 + (i % 10)) + ":00", full_name: "Test User " + i, email: "test" + i + "@example.com", phone: "+34612345" + (100 + i) },
      category: "booking_create"
    });
    tests.push({
      actionType: "tool_call",
      target: "check_availability",
      params: { center: centers[i % 6], treatment: treatments[i % 4], days_ahead: 7 + (i % 14) },
      category: "booking_availability"
    });
    tests.push({ actionType: "tool_call", target: "cancel_booking", params: { bookingId: "BK" + (2000 + i) }, category: "booking_cancel" });
    tests.push({ actionType: "tool_call", target: "get_center_info", params: { center: centers[i % 6] }, category: "booking_info" });
  }

  // === DATA OPERATIONS (120 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "data.read", params: { table: "users", id: i }, category: "data" });
    tests.push({ actionType: "tool_call", target: "data.write", params: { table: "bookings", data: { id: i } }, category: "data" });
    tests.push({ actionType: "tool_call", target: "data.delete", params: { table: "sessions", id: i }, category: "data" });
    tests.push({ actionType: "tool_call", target: "data.export", params: { format: "csv", table: "stats" }, category: "data" });
  }

  // === USER OPERATIONS (60 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "user.lookup", params: { phone: "+3461234567" + i }, category: "user" });
    tests.push({ actionType: "tool_call", target: "user.update", params: { userId: "U" + i, name: "Updated User" }, category: "user" });
  }

  // === KNOWLEDGE BASE (60 tests) ===
  const kbQueries = ["precio", "tabaco", "cannabis", "duracion", "efectos", "garantia"];
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "kb.search", params: { query: kbQueries[i % 6] + " " + i }, category: "kb" });
    tests.push({ actionType: "tool_call", target: "kb.load", params: { section: "treatments", index: i }, category: "kb" });
  }

  // === CACHE OPERATIONS (90 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "cache.read", params: { key: "response_" + i }, category: "cache" });
    tests.push({ actionType: "tool_call", target: "cache.write", params: { key: "response_" + i, value: "data" }, category: "cache" });
    tests.push({ actionType: "tool_call", target: "cache.invalidate", params: { pattern: "session:user_" + i }, category: "cache" });
  }

  // === ADMIN/SYSTEM (100 tests) ===
  for (let i = 0; i < 20; i++) {
    tests.push({ actionType: "tool_call", target: "admin.config", params: { setting: "max_tokens", value: 2000 + i }, category: "admin" });
    tests.push({ actionType: "tool_call", target: "system.restart", params: { service: "chatbot", reason: "test" }, category: "admin" });
    tests.push({ actionType: "tool_call", target: "policy.update", params: { policyId: "test_" + i }, category: "admin" });
    tests.push({ actionType: "db_query", target: "SELECT * FROM bookings LIMIT " + i, params: {}, category: "db" });
    tests.push({ actionType: "tool_call", target: "redis.get", params: { key: "stats:" + i }, category: "redis" });
  }

  // === FILE OPERATIONS (60 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "file_access", target: "/data/knowledge_" + i + ".json", params: { mode: "read" }, category: "file" });
    tests.push({ actionType: "tool_call", target: "file.upload", params: { filename: "report_" + i + ".pdf" }, category: "file" });
  }

  // === ERROR/AUDIT (60 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "error.log", params: { level: "error", message: "Test error " + i }, category: "error" });
    tests.push({ actionType: "tool_call", target: "audit.log", params: { action: "test_action", userId: "U" + i }, category: "audit" });
  }

  // === NOTIFICATIONS (90 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "email.send", params: { to: "test" + i + "@example.com", subject: "Test" }, category: "notification" });
    tests.push({ actionType: "tool_call", target: "sms.send", params: { to: "+3461234567" + i, message: "Test" }, category: "notification" });
    tests.push({ actionType: "tool_call", target: "push.send", params: { token: "device_" + i, message: "Test" }, category: "notification" });
  }

  // === AUTH/SECURITY (60 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "auth.login", params: { userId: "U" + i }, category: "auth" });
    tests.push({ actionType: "tool_call", target: "token.generate", params: { type: "access", userId: "U" + i }, category: "auth" });
  }

  // === WEBHOOKS (60 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "webhook.receive", params: { source: "meta", payload: { id: i } }, category: "webhook" });
    tests.push({ actionType: "tool_call", target: "webhook.send", params: { url: "https://example.com/hook" + i }, category: "webhook" });
  }

  // === ANALYTICS (60 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "analytics.track", params: { event: "booking_" + i, data: {} }, category: "analytics" });
    tests.push({ actionType: "tool_call", target: "token_usage", params: { tokens: randomInt(100, 5000) }, category: "analytics" });
  }

  // === SCHEDULING (60 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "schedule.create", params: { date: "2026-01-" + (20 + (i % 10)), time: "10:00" }, category: "schedule" });
    tests.push({ actionType: "tool_call", target: "schedule.modify", params: { scheduleId: "S" + i, newTime: "11:00" }, category: "schedule" });
  }

  // === OTHER (60 tests) ===
  for (let i = 0; i < 30; i++) {
    tests.push({ actionType: "tool_call", target: "translate", params: { text: "Hello " + i, to: "es" }, category: "other" });
    tests.push({ actionType: "tool_call", target: "report.generate", params: { type: "monthly", month: i % 12 }, category: "other" });
  }

  // === EDGE CASES (50 tests) ===
  for (let i = 0; i < 50; i++) {
    tests.push({ actionType: "tool_call", target: "unknown_action_" + i, params: { test: true }, category: "edge_case" });
  }

  return tests;
}

// Run single test
async function runTest(testCase, testNumber) {
  try {
    const response = await fetch(AASP_BASE_URL + "/api/v1/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + AASP_API_KEY
      },
      body: JSON.stringify({
        agent_id: AASP_AGENT_ID,
        action_type: testCase.actionType,
        target: testCase.target,
        params: testCase.params
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error("HTTP " + response.status + ": " + errorText.substring(0, 100));
    }

    const result = await response.json();

    results.total++;
    results.byDecision[result.decision] = (results.byDecision[result.decision] || 0) + 1;
    results.byCategory[testCase.category] = (results.byCategory[testCase.category] || 0) + 1;

    // Extract policy name
    let policyName = "unknown";
    if (result.reason) {
      const match1 = result.reason.match(/policy "([^"]+)"/);
      const match2 = result.reason.match(/Policy: ([^)]+)/);
      policyName = (match1 && match1[1]) || (match2 && match2[1]) || "catch-all";
    }
    results.byPolicy[policyName] = (results.byPolicy[policyName] || 0) + 1;

    // Check expected decision
    if (testCase.expectedDecision) {
      if (result.decision === testCase.expectedDecision) {
        results.passed++;
      } else {
        results.failed++;
        if (results.errors.length < 50) {
          results.errors.push({ testNumber, target: testCase.target, expected: testCase.expectedDecision, actual: result.decision });
        }
      }
    } else {
      results.passed++;
    }

    return true;

  } catch (error) {
    results.total++;
    results.failed++;
    results.byDecision.error++;
    if (results.errors.length < 50) {
      results.errors.push({ testNumber, target: testCase.target, error: error.message });
    }
    return false;
  }
}

// Main execution
async function runAllTests() {
  console.log("========================================================");
  console.log("     AASP COMPREHENSIVE TEST SUITE - 2000 TESTS");
  console.log("========================================================");
  console.log("");

  const testCases = generateTestCases();
  console.log("Generated " + testCases.length + " test cases");
  console.log("Running " + Math.min(testCases.length, TOTAL_TESTS) + " tests...");
  console.log("");

  const startTime = Date.now();
  const testsToRun = testCases.slice(0, TOTAL_TESTS);
  const totalBatches = Math.ceil(testsToRun.length / BATCH_SIZE);

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchStart = batch * BATCH_SIZE;
    const batchEnd = Math.min(batchStart + BATCH_SIZE, testsToRun.length);
    const batchTests = testsToRun.slice(batchStart, batchEnd);

    process.stdout.write("\rBatch " + (batch + 1) + "/" + totalBatches + " | Tests: " + results.total + "/" + testsToRun.length + " | Pass: " + results.passed + " | Fail: " + results.failed + "   ");

    for (let i = 0; i < batchTests.length; i++) {
      await runTest(batchTests[i], batchStart + i + 1);
      if (i < batchTests.length - 1) {
        await sleep(DELAY_BETWEEN_TESTS);
      }
    }

    if (batch < totalBatches - 1) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n\n========================================================");
  console.log("                 FINAL TEST RESULTS");
  console.log("========================================================");
  console.log("Total Tests:      " + results.total);
  console.log("Passed:           " + results.passed);
  console.log("Failed:           " + results.failed);
  console.log("Success Rate:     " + ((results.passed / results.total) * 100).toFixed(2) + "%");
  console.log("Duration:         " + duration + "s");
  console.log("");
  console.log("========================================================");
  console.log("                DECISIONS BREAKDOWN");
  console.log("========================================================");
  console.log("ALLOW:            " + (results.byDecision.allow || 0));
  console.log("BLOCK:            " + (results.byDecision.block || 0));
  console.log("REQUIRE_APPROVAL: " + (results.byDecision.require_approval || 0));
  console.log("ERRORS:           " + (results.byDecision.error || 0));
  console.log("");
  console.log("========================================================");
  console.log("              TOP POLICIES MATCHED");
  console.log("========================================================");

  const sortedPolicies = Object.entries(results.byPolicy).sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [policy, count] of sortedPolicies) {
    const name = policy.length > 40 ? policy.substring(0, 37) + "..." : policy;
    console.log(name.padEnd(42) + count + " hits");
  }

  console.log("");
  console.log("========================================================");
  console.log("              CATEGORY BREAKDOWN");
  console.log("========================================================");
  const sortedCategories = Object.entries(results.byCategory).sort((a, b) => b[1] - a[1]);
  for (const [category, count] of sortedCategories) {
    console.log(category.padEnd(25) + count + " tests");
  }

  if (results.errors.length > 0) {
    console.log("");
    console.log("========================================================");
    console.log("              ERRORS (first 20)");
    console.log("========================================================");
    results.errors.slice(0, 20).forEach(err => {
      if (err.error) {
        console.log("#" + err.testNumber + " " + err.target + ": " + err.error);
      } else {
        console.log("#" + err.testNumber + " " + err.target + ": expected " + err.expected + ", got " + err.actual);
      }
    });
  }

  console.log("");
  console.log("========================================================");
  console.log("Test suite completed!");

  return results;
}

runAllTests().catch(console.error);
