const fs = require('fs');
const path = require('path');

const handlerPath = path.join(__dirname, 'lib/gpt-handler.js');
let content = fs.readFileSync(handlerPath, 'utf8');

// 1. Add AASP import after other requires
const importLine = "const { CHATBOT_TOOLS, executeToolCall } = require('../config/tools');";
const newImport = importLine + "\nconst { evaluateAction } = require('./aasp-security');";

if (!content.includes('aasp-security')) {
  content = content.replace(importLine, newImport);
  console.log('✓ Added AASP import');
} else {
  console.log('- AASP import already exists');
}

// 2. Find and replace the executeToolCall section
const oldToolCall = `console.log(\`[GPT] Executing tool: \${functionName}\`, args);

      // Execute the tool (pass platform for booking stats)
      const result = await executeToolCall(functionName, args, this.smartAgenda, platform);`;

const newToolCall = `console.log(\`[GPT] Executing tool: \${functionName}\`, args);

      // AASP Security Check - evaluate action before execution
      let aaspDecision = { allowed: true, decision: 'allow' };
      try {
        aaspDecision = await evaluateAction('tool_call', functionName, args, { platform });
        console.log(\`[AASP] Decision for \${functionName}: \${aaspDecision.decision}\`);
      } catch (aaspError) {
        console.error('[AASP] Evaluation error:', aaspError.message);
        // Fail open - allow action if AASP is unavailable
      }

      // Handle AASP decision
      let result;
      if (aaspDecision.decision === 'block') {
        console.log(\`[AASP] BLOCKED: \${functionName} - \${aaspDecision.reason}\`);
        result = {
          success: false,
          error: 'Esta acción ha sido bloqueada por políticas de seguridad.',
          blocked: true,
          reason: aaspDecision.reason
        };
      } else if (aaspDecision.decision === 'require_approval') {
        console.log(\`[AASP] REQUIRES APPROVAL: \${functionName}\`);
        result = {
          success: false,
          error: 'Esta acción requiere aprobación manual. Por favor, contacte con el centro.',
          requiresApproval: true,
          approvalId: aaspDecision.approvalId
        };
      } else {
        // Execute the tool (pass platform for booking stats)
        result = await executeToolCall(functionName, args, this.smartAgenda, platform);
      }`;

if (content.includes('AASP Security Check')) {
  console.log('- AASP integration already exists in handleToolCalls');
} else if (content.includes(oldToolCall)) {
  content = content.replace(oldToolCall, newToolCall);
  console.log('✓ Added AASP security check around tool execution');
} else {
  console.log('⚠ Could not find exact match for tool call pattern. Manual integration may be needed.');
}

// Write the updated content
fs.writeFileSync(handlerPath, content);
console.log('\n✓ gpt-handler.js updated successfully');
