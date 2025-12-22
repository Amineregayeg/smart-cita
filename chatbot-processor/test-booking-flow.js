/**
 * Test Script for Booking Flow with Tool Calling
 * Tests the GPT handler with Smart Agenda integration
 */

require('dotenv').config();

const { GPTHandler } = require('./lib/gpt-handler');
const { SmartAgendaService } = require('./lib/smart-agenda-service');

async function testAvailabilityCheck() {
  console.log('\n=== Testing Availability Check ===\n');

  const smartAgenda = new SmartAgendaService();

  try {
    const result = await smartAgenda.checkAvailability('barcelona', 'tabaco', 7);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testCenterInfo() {
  console.log('\n=== Testing Center Info ===\n');

  const smartAgenda = new SmartAgendaService();

  const result = smartAgenda.getCenterInfo('all');
  console.log('Result:', JSON.stringify(result, null, 2));
}

async function testGPTWithTools() {
  console.log('\n=== Testing GPT with Tool Calling ===\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY not set');
    return;
  }

  const gptHandler = new GPTHandler();

  // Test 1: Simple question (no tools needed)
  console.log('Test 1: Simple question...');
  try {
    const response1 = await gptHandler.generateResponse(
      'Hola, cuanto cuesta el tratamiento para dejar de fumar?',
      []
    );
    console.log('Response:', response1.substring(0, 200) + '...\n');
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 2: Center info request (should trigger get_center_info tool)
  console.log('Test 2: Center info request...');
  try {
    const response2 = await gptHandler.generateResponse(
      'Donde estan los centros de Madrid?',
      []
    );
    console.log('Response:', response2.substring(0, 300) + '...\n');
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 3: Availability request (should trigger check_availability tool)
  console.log('Test 3: Availability request...');
  try {
    const response3 = await gptHandler.generateResponse(
      'Que disponibilidad hay en Barcelona para esta semana?',
      []
    );
    console.log('Response:', response3.substring(0, 400) + '...\n');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function runTests() {
  console.log('========================================');
  console.log('BOOKING FLOW TEST SUITE');
  console.log('========================================');

  // Check required environment variables
  console.log('\n--- Environment Check ---');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'NOT SET');
  console.log('SMART_AGENDA_BASE_URL:', process.env.SMART_AGENDA_BASE_URL ? 'Set' : 'NOT SET');
  console.log('SMART_AGENDA_LOGIN:', process.env.SMART_AGENDA_LOGIN ? 'Set' : 'NOT SET');
  console.log('SMART_AGENDA_PWD:', process.env.SMART_AGENDA_PWD ? 'Set' : 'NOT SET');
  console.log('SMART_AGENDA_API_ID:', process.env.SMART_AGENDA_API_ID ? 'Set' : 'NOT SET');
  console.log('SMART_AGENDA_API_KEY:', process.env.SMART_AGENDA_API_KEY ? 'Set' : 'NOT SET');

  const hasSmartAgendaCredentials = process.env.SMART_AGENDA_LOGIN && process.env.SMART_AGENDA_PWD;

  // Run tests
  await testCenterInfo();

  if (hasSmartAgendaCredentials) {
    await testAvailabilityCheck();
  } else {
    console.log('\n[SKIP] Availability test - Smart Agenda credentials not set');
  }

  if (process.env.OPENAI_API_KEY) {
    await testGPTWithTools();
  } else {
    console.log('\n[SKIP] GPT tests - OPENAI_API_KEY not set');
  }

  console.log('\n========================================');
  console.log('TEST COMPLETE');
  console.log('========================================');
}

runTests().catch(console.error);
