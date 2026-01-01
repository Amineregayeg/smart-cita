/**
 * Test Suite Index
 * Exports all test modules for the test runner
 */

// Layer A - API Contract Tests
const apiContract = require('./layer-a/apiContract.spec');

// Layer B - Chatbot Integration Tests (T1-T10)
const t1Availability = require('./layer-b/T1-availability.spec');
const t2Overlaps = require('./layer-b/T2-overlaps.spec');
const t3WorkingHours = require('./layer-b/T3-workingHours.spec');
const t4RecaidaRules = require('./layer-b/T4-recaidaRules.spec');
const t5BookingConfirmation = require('./layer-b/T5-bookingConfirmation.spec');
const t6CallbackFlow = require('./layer-b/T6-callbackFlow.spec');
const t7NoWeb = require('./layer-b/T7-noWeb.spec');
const t8SideEffects = require('./layer-b/T8-sideEffects.spec');
const t9CancerPolicy = require('./layer-b/T9-cancerPolicy.spec');
const t10Hallucination = require('./layer-b/T10-hallucination.spec');

// Layer C - Database Verification Tests
const dbVerification = require('./layer-c/dbVerification.spec');

/**
 * All test suites
 */
const allSuites = {
  'layer-a': apiContract,
  'T1-availability': t1Availability,
  'T2-overlaps': t2Overlaps,
  'T3-working-hours': t3WorkingHours,
  'T4-recaida': t4RecaidaRules,
  'T5-booking': t5BookingConfirmation,
  'T6-callback': t6CallbackFlow,
  'T7-no-web': t7NoWeb,
  'T8-side-effects': t8SideEffects,
  'T9-cancer': t9CancerPolicy,
  'T10-hallucination': t10Hallucination,
  'layer-c': dbVerification
};

/**
 * Get tests by layer
 */
function getTestsByLayer(layer) {
  switch (layer) {
    case 'A':
      return [apiContract];
    case 'B':
      return [
        t1Availability,
        t2Overlaps,
        t3WorkingHours,
        t4RecaidaRules,
        t5BookingConfirmation,
        t6CallbackFlow,
        t7NoWeb,
        t8SideEffects,
        t9CancerPolicy,
        t10Hallucination
      ];
    case 'C':
      return [dbVerification];
    default:
      return Object.values(allSuites);
  }
}

/**
 * Get all tests flattened
 */
function getAllTests() {
  const tests = [];
  for (const suite of Object.values(allSuites)) {
    tests.push(...suite.tests);
  }
  return tests;
}

/**
 * Get quick smoke tests (subset for frequent runs)
 */
function getSmokeTests() {
  return [
    apiContract.tests[0], // Token auth
    t1Availability.tests[0], // Madrid availability
    t5BookingConfirmation.tests[0], // Booking creates entry
    t7NoWeb.tests[0], // No web in availability
    dbVerification.tests[0] // Booking persists
  ];
}

/**
 * Get critical tests (must pass)
 */
function getCriticalTests() {
  return [
    ...apiContract.tests,
    t1Availability.tests[0],
    t1Availability.tests[1],
    t2Overlaps.tests[0],
    t2Overlaps.tests[1],
    t5BookingConfirmation.tests[0],
    ...dbVerification.tests.slice(0, 4)
  ];
}

module.exports = {
  allSuites,
  getTestsByLayer,
  getAllTests,
  getSmokeTests,
  getCriticalTests,
  // Individual suites
  apiContract,
  t1Availability,
  t2Overlaps,
  t3WorkingHours,
  t4RecaidaRules,
  t5BookingConfirmation,
  t6CallbackFlow,
  t7NoWeb,
  t8SideEffects,
  t9CancerPolicy,
  t10Hallucination,
  dbVerification
};
