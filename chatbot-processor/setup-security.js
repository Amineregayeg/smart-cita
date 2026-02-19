/**
 * Setup script to initialize AASP security policies
 * Run once: node setup-security.js
 */

require("dotenv").config();
const { initializeSecurityPolicies } = require("./lib/aasp-security");

async function main() {
  console.log("=== LaserOstop Security Setup ===\n");
  console.log("AASP Agent ID:", process.env.AASP_AGENT_ID || "laserostop-chatbot");
  
  var apiKey = process.env.AASP_API_KEY;
  console.log("API Key:", apiKey ? "***" + apiKey.slice(-6) : "NOT SET");
  console.log("");

  if (!apiKey) {
    console.error("ERROR: AASP_API_KEY not set in environment");
    process.exit(1);
  }

  var success = await initializeSecurityPolicies();
  
  if (success) {
    console.log("\nSecurity policies configured successfully!");
    console.log("\nPolicies created:");
    console.log("  1. Payment Controls - Block >1000 EUR, approval >500 EUR");
    console.log("  2. Rate Limiting - Max 10 payment links per hour");
    console.log("  3. Booking Security - Audit all bookings, approval for cancellations");
  } else {
    console.error("\nFailed to configure security policies");
    process.exit(1);
  }
}

main().catch(function(err) {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
