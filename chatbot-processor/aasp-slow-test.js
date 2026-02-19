/**
 * AASP Slow Test - Respects Rate Limits
 * Tests each policy category with longer delays
 */
require('dotenv').config();

const AASP_BASE_URL = "https://app.harbyx.com";
const AASP_API_KEY = process.env.AASP_API_KEY;
const AASP_AGENT_ID = process.env.AASP_AGENT_ID || "laserostop-chatbot";

const results = { total: 0, passed: 0, failed: 0, byPolicy: {}, byDecision: {} };

async function test(name, actionType, target, params, expected) {
  try {
    const res = await fetch(AASP_BASE_URL + "/api/v1/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + AASP_API_KEY },
      body: JSON.stringify({ agent_id: AASP_AGENT_ID, action_type: actionType, target: target, params: params })
    });
    
    if (!res.ok) {
      const err = await res.text();
      console.log("  FAIL: " + name + " - HTTP " + res.status);
      results.failed++;
      return false;
    }
    
    const data = await res.json();
    results.total++;
    results.byDecision[data.decision] = (results.byDecision[data.decision] || 0) + 1;
    
    const policyMatch = data.reason.match(/policy "([^"]+)"|Policy: ([^)]+)/);
    const policy = policyMatch ? (policyMatch[1] || policyMatch[2]) : "unknown";
    results.byPolicy[policy] = (results.byPolicy[policy] || 0) + 1;
    
    if (!expected || data.decision === expected) {
      console.log("  PASS: " + name + " -> " + data.decision + " (" + policy + ")");
      results.passed++;
      return true;
    } else {
      console.log("  FAIL: " + name + " -> Expected " + expected + ", got " + data.decision);
      results.failed++;
      return false;
    }
  } catch (e) {
    console.log("  ERROR: " + name + " - " + e.message);
    results.failed++;
    return false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTests() {
  console.log("=== AASP Policy Verification Tests ===\n");
  const delay = 500; // 500ms between tests to avoid rate limits
  
  // Payment Security
  console.log("--- PAYMENT SECURITY ---");
  await test("Block 1500EUR payment", "tool_call", "process_payment", {amount: 150000, currency: "EUR"}, "block"); await sleep(delay);
  await test("Block 2000EUR payment", "tool_call", "process_payment", {amount: 200000, currency: "EUR"}, "block"); await sleep(delay);
  await test("Approve 700EUR payment", "tool_call", "process_payment", {amount: 70000, currency: "EUR"}, "require_approval"); await sleep(delay);
  await test("Approve 900EUR payment", "tool_call", "process_payment", {amount: 90000, currency: "EUR"}, "require_approval"); await sleep(delay);
  await test("Allow 200EUR payment", "tool_call", "process_payment", {amount: 20000, currency: "EUR"}, "allow"); await sleep(delay);
  await test("Allow 450EUR payment", "tool_call", "process_payment", {amount: 45000, currency: "EUR"}, "allow"); await sleep(delay);
  await test("Require refund approval", "tool_call", "refund", {amount: 19000, bookingId: "BK123"}, "require_approval"); await sleep(delay);
  
  // Booking Operations
  console.log("\n--- BOOKING OPERATIONS ---");
  await test("Create booking", "tool_call", "create_booking", {center: "barcelona", treatment: "tabaco"}, "allow"); await sleep(delay);
  await test("Check availability", "tool_call", "check_availability", {center: "sevilla", days_ahead: 14}, "allow"); await sleep(delay);
  await test("Cancel booking", "tool_call", "cancel_booking", {bookingId: "BK456"}, "allow"); await sleep(delay);
  await test("Get center info", "tool_call", "get_center_info", {center: "chamartin"}, "allow"); await sleep(delay);
  
  // Messages
  console.log("\n--- MESSAGE OPERATIONS ---");
  await test("Receive message", "tool_call", "message.receive", {platform: "whatsapp", from: "user1"}, "allow"); await sleep(delay);
  await test("Send message", "tool_call", "message.send", {platform: "whatsapp", to: "user1"}, "allow"); await sleep(delay);
  await test("Queue message", "tool_call", "message.queue", {queue: "chatbot:messages"}, "allow"); await sleep(delay);
  
  // AI/GPT
  console.log("\n--- AI/GPT OPERATIONS ---");
  await test("GPT generate", "tool_call", "gpt.generate", {model: "gpt-4", tokens: 500}, "allow"); await sleep(delay);
  await test("AI tool call", "tool_call", "ai.tool", {tool: "check_availability"}, "allow"); await sleep(delay);
  
  // Sessions
  console.log("\n--- SESSION OPERATIONS ---");
  await test("Create session", "tool_call", "session.create", {userId: "U123"}, "allow"); await sleep(delay);
  await test("Update session", "tool_call", "session.update", {userId: "U123"}, "allow"); await sleep(delay);
  await test("Read session", "tool_call", "session.read", {userId: "U123"}, "allow"); await sleep(delay);
  
  // External APIs
  console.log("\n--- EXTERNAL API CALLS ---");
  await test("Smart Agenda API", "api_call", "smart_agenda.availability", {center: "barcelona"}, "allow"); await sleep(delay);
  await test("WhatsApp API", "api_call", "whatsapp.send", {to: "+34612345678"}, "allow"); await sleep(delay);
  await test("Meta API", "api_call", "meta.send", {recipient: "psid123"}, "allow"); await sleep(delay);
  await test("OpenAI API", "api_call", "openai.chat", {model: "gpt-4"}, "allow"); await sleep(delay);
  await test("Stripe API", "api_call", "stripe.checkout", {amount: 19000}, "allow"); await sleep(delay);
  await test("Instagram API", "api_call", "instagram.send", {recipient: "ig123"}, "allow"); await sleep(delay);
  
  // Data Operations
  console.log("\n--- DATA OPERATIONS ---");
  await test("Data read", "tool_call", "data.read", {table: "users"}, "allow"); await sleep(delay);
  await test("Data write", "tool_call", "data.write", {table: "bookings"}, "allow"); await sleep(delay);
  await test("Data delete", "tool_call", "data.delete", {table: "sessions"}, "allow"); await sleep(delay);
  await test("Data export", "tool_call", "data.export", {format: "csv"}, "allow"); await sleep(delay);
  
  // User Operations
  console.log("\n--- USER OPERATIONS ---");
  await test("User lookup", "tool_call", "user.lookup", {phone: "+34612345678"}, "allow"); await sleep(delay);
  await test("User update", "tool_call", "user.update", {userId: "U123"}, "allow"); await sleep(delay);
  
  // Knowledge Base
  console.log("\n--- KNOWLEDGE BASE ---");
  await test("KB search", "tool_call", "kb.search", {query: "precio tabaco"}, "allow"); await sleep(delay);
  await test("KB load", "tool_call", "kb.load", {section: "treatments"}, "allow"); await sleep(delay);
  
  // Cache Operations
  console.log("\n--- CACHE OPERATIONS ---");
  await test("Cache read", "tool_call", "cache.read", {key: "response_123"}, "allow"); await sleep(delay);
  await test("Cache write", "tool_call", "cache.write", {key: "response_123"}, "allow"); await sleep(delay);
  await test("Cache invalidate", "tool_call", "cache.invalidate", {pattern: "session:*"}, "allow"); await sleep(delay);
  
  // Admin/System
  console.log("\n--- ADMIN/SYSTEM ---");
  await test("Config change", "tool_call", "admin.config", {setting: "max_tokens"}, "allow"); await sleep(delay);
  await test("System restart", "tool_call", "system.restart", {service: "chatbot"}, "allow"); await sleep(delay);
  await test("Policy update", "tool_call", "policy.update", {policyId: "test"}, "allow"); await sleep(delay);
  await test("DB query", "db_query", "SELECT * FROM bookings", {}, "allow"); await sleep(delay);
  await test("Redis op", "tool_call", "redis.get", {key: "stats"}, "allow"); await sleep(delay);
  
  // File Operations
  console.log("\n--- FILE OPERATIONS ---");
  await test("File access", "file_access", "/data/knowledge.json", {mode: "read"}, "allow"); await sleep(delay);
  await test("File upload", "tool_call", "file.upload", {filename: "report.pdf"}, "allow"); await sleep(delay);
  
  // Error/Audit
  console.log("\n--- ERROR/AUDIT ---");
  await test("Error log", "tool_call", "error.log", {level: "error"}, "allow"); await sleep(delay);
  await test("Audit log", "tool_call", "audit.log", {action: "login"}, "allow"); await sleep(delay);
  
  // Notifications
  console.log("\n--- NOTIFICATIONS ---");
  await test("Email send", "tool_call", "email.send", {to: "test@example.com"}, "allow"); await sleep(delay);
  await test("SMS send", "tool_call", "sms.send", {to: "+34612345678"}, "allow"); await sleep(delay);
  await test("Push send", "tool_call", "push.send", {token: "device_123"}, "allow"); await sleep(delay);
  
  // Auth/Security
  console.log("\n--- AUTH/SECURITY ---");
  await test("Auth login", "tool_call", "auth.login", {userId: "U123"}, "allow"); await sleep(delay);
  await test("Token generate", "tool_call", "token.generate", {type: "access"}, "allow"); await sleep(delay);
  
  // Webhooks
  console.log("\n--- WEBHOOKS ---");
  await test("Webhook receive", "tool_call", "webhook.receive", {source: "meta"}, "allow"); await sleep(delay);
  await test("Webhook send", "tool_call", "webhook.send", {url: "https://example.com"}, "allow"); await sleep(delay);
  
  // Analytics
  console.log("\n--- ANALYTICS ---");
  await test("Analytics track", "tool_call", "analytics.track", {event: "booking"}, "allow"); await sleep(delay);
  await test("Token usage", "tool_call", "token_usage", {tokens: 1500}, "allow"); await sleep(delay);
  
  // Scheduling
  console.log("\n--- SCHEDULING ---");
  await test("Schedule create", "tool_call", "schedule.create", {date: "2026-01-20"}, "allow"); await sleep(delay);
  await test("Schedule modify", "tool_call", "schedule.modify", {scheduleId: "S123"}, "allow"); await sleep(delay);
  
  // Other
  console.log("\n--- OTHER ---");
  await test("Translate", "tool_call", "translate", {text: "Hello", to: "es"}, "allow"); await sleep(delay);
  await test("Report generate", "tool_call", "report.generate", {type: "monthly"}, "allow"); await sleep(delay);
  
  // Edge cases (catch-all)
  console.log("\n--- EDGE CASES (catch-all) ---");
  await test("Unknown action 1", "tool_call", "random_unknown_action", {}, "allow"); await sleep(delay);
  await test("Unknown action 2", "tool_call", "xyz_test_action", {}, "allow"); await sleep(delay);
  await test("Unknown API", "api_call", "external.unknown.api", {}, "allow"); await sleep(delay);
  
  // Summary
  console.log("\n===========================================");
  console.log("           FINAL RESULTS");
  console.log("===========================================");
  console.log("Total:  " + results.total);
  console.log("Passed: " + results.passed);
  console.log("Failed: " + results.failed);
  console.log("Rate:   " + ((results.passed/results.total)*100).toFixed(1) + "%");
  console.log("\nDecisions:");
  Object.entries(results.byDecision).forEach(([k,v]) => console.log("  " + k + ": " + v));
  console.log("\nPolicies matched:");
  Object.entries(results.byPolicy).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log("  " + k + ": " + v));
}

runTests();
