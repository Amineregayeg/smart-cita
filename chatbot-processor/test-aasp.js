require("dotenv").config();
const { evaluateAction } = require("./lib/aasp-security");

async function test() {
  console.log("=== AASP Security Tests ===");
  console.log("");

  // Test 1: Small payment (should ALLOW)
  console.log("Test 1: Small payment (200 EUR)");
  var result1 = await evaluateAction("api_call", "stripe.payment.create", { amount: 20000 });
  console.log("Result:", result1.decision);
  console.log("");

  // Test 2: Medium payment (should REQUIRE APPROVAL)
  console.log("Test 2: Medium payment (700 EUR)");
  var result2 = await evaluateAction("api_call", "stripe.payment.create", { amount: 70000 });
  console.log("Result:", result2.decision);
  console.log("");

  // Test 3: Large payment (should BLOCK)
  console.log("Test 3: Large payment (1500 EUR)");
  var result3 = await evaluateAction("api_call", "stripe.payment.create", { amount: 150000 });
  console.log("Result:", result3.decision);
  console.log("");

  console.log("=== Tests Complete ===");
}

test().catch(console.error);
