/**
 * AASP Security Layer for LaserOstop Chatbot
 * Updated: Uses /api/v1/ingest endpoint with correct format
 */

const AASP_BASE_URL = "https://app.harbyx.com";
const AASP_API_KEY = process.env.AASP_API_KEY;
const AASP_AGENT_ID = process.env.AASP_AGENT_ID || "laserostop-chatbot";

/**
 * Evaluate an action against security policies via HTTP API
 */
async function evaluateAction(actionType, target, params, context = {}) {
  try {
    console.log("[AASP] Evaluating: " + actionType + " -> " + target);
    console.log("[AASP] Params:", JSON.stringify(params));
    
    const response = await fetch(AASP_BASE_URL + "/api/v1/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + AASP_API_KEY
      },
      body: JSON.stringify({
        agent_id: AASP_AGENT_ID,
        action_type: actionType,
        target: target,
        params: params
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error("AASP evaluation failed: " + response.status + " - " + errorText);
    }

    const result = await response.json();
    console.log("[AASP] Decision: " + result.decision + " - " + result.reason);

    return {
      allowed: result.decision === "allow",
      decision: result.decision,
      reason: result.reason,
      actionId: result.action_id,
      policyId: result.policy_id,
      approvalId: result.approval_id
    };

  } catch (error) {
    console.error("[AASP] Evaluation error:", error.message);
    // Fail open for now - allow action but log error
    return {
      allowed: true,
      decision: "error",
      reason: "Security evaluation failed: " + error.message,
      error: true
    };
  }
}

/**
 * Create security policy via HTTP API
 */
async function createPolicy(policyConfig) {
  console.log("[AASP] Creating policy: " + policyConfig.name);
  
  const response = await fetch(AASP_BASE_URL + "/api/v1/policies", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + AASP_API_KEY
    },
    body: JSON.stringify(policyConfig)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error("Policy creation failed: " + response.status + " - " + errorText);
  }

  const result = await response.json();
  console.log("[AASP] Policy created: " + result.policy.id);
  return result;
}

/**
 * List all policies
 */
async function listPolicies() {
  const response = await fetch(AASP_BASE_URL + "/api/v1/policies", {
    method: "GET",
    headers: {
      "Authorization": "Bearer " + AASP_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error("Failed to list policies: " + response.status);
  }

  return await response.json();
}

/**
 * Delete a policy
 */
async function deletePolicy(policyId) {
  const response = await fetch(AASP_BASE_URL + "/api/v1/policies/" + policyId, {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + AASP_API_KEY
    }
  });

  return response.ok;
}

/**
 * Secure wrapper for payment processing
 */
async function securePaymentCheck(amount, currency = "EUR", metadata = {}) {
  const result = await evaluateAction(
    "tool_call",
    "process_payment",
    {
      amount: amount,
      currency: currency,
      ...metadata
    }
  );

  if (result.decision === "block") {
    return {
      allowed: false,
      blocked: true,
      reason: result.reason,
      message: "Payment blocked: " + result.reason
    };
  }

  if (result.decision === "require_approval") {
    return {
      allowed: false,
      requiresApproval: true,
      approvalId: result.approvalId,
      reason: result.reason,
      message: "Payment requires approval: " + result.reason
    };
  }

  return {
    allowed: true,
    decision: result.decision,
    actionId: result.actionId
  };
}

/**
 * Secure wrapper for booking cancellation
 */
async function secureCancellationCheck(bookingId, reason = "") {
  const result = await evaluateAction(
    "tool_call",
    "cancel_booking",
    {
      booking_id: bookingId,
      reason: reason
    }
  );

  return {
    allowed: result.allowed,
    decision: result.decision,
    reason: result.reason,
    approvalId: result.approvalId
  };
}

module.exports = {
  evaluateAction,
  createPolicy,
  listPolicies,
  deletePolicy,
  securePaymentCheck,
  secureCancellationCheck,
  AASP_BASE_URL,
  AASP_AGENT_ID
};
