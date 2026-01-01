/**
 * Chatbot Test Runner Server
 * Express server with scheduled test runs and dashboard
 */

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const path = require('path');

const { runTestSuite } = require('./lib/testExecutor');
const redis = require('./lib/redisClient');
const testDataManager = require('./lib/testDataManager');
const testSuites = require('./tests');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store last run info in memory
let lastRunInfo = {
  status: 'idle',
  startTime: null,
  endTime: null,
  currentSuite: null,
  progress: 0
};

/**
 * Run all test suites
 */
async function runAllTests(runType = 'scheduled') {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[RUNNER] Starting ${runType} test run`);
  console.log(`[RUNNER] Time: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  lastRunInfo = {
    status: 'running',
    startTime: Date.now(),
    endTime: null,
    currentSuite: null,
    progress: 0,
    runType
  };

  const allResults = [];
  const suiteNames = Object.keys(testSuites.allSuites);
  let completed = 0;

  for (const suiteName of suiteNames) {
    const suite = testSuites.allSuites[suiteName];
    lastRunInfo.currentSuite = suite.name;
    lastRunInfo.progress = Math.round((completed / suiteNames.length) * 100);

    try {
      const result = await runTestSuite(suite.tests, suiteName);
      allResults.push(result);
    } catch (error) {
      console.error(`[RUNNER] Suite ${suiteName} failed:`, error.message);
      allResults.push({
        suiteName,
        error: error.message,
        passRate: 0
      });
    }

    completed++;
  }

  // Calculate overall stats
  const totalTests = allResults.reduce((sum, r) => sum + (r.totalTests || 0), 0);
  const totalPassed = allResults.reduce((sum, r) => sum + (r.passedCount || 0), 0);
  const totalFailed = allResults.reduce((sum, r) => sum + (r.failedCount || 0), 0);
  const totalErrors = allResults.reduce((sum, r) => sum + (r.errorCount || 0), 0);
  const overallPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

  const summary = {
    runType,
    timestamp: Date.now(),
    totalTests,
    totalPassed,
    totalFailed,
    totalErrors,
    passRate: parseFloat(overallPassRate),
    suites: allResults
  };

  // Store overall summary
  await redis.storeRunSummary(`full-run-${Date.now()}`, summary);

  lastRunInfo = {
    status: 'completed',
    startTime: lastRunInfo.startTime,
    endTime: Date.now(),
    currentSuite: null,
    progress: 100,
    summary
  };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[RUNNER] Test run complete`);
  console.log(`[RUNNER] Results: ${totalPassed}/${totalTests} passed (${overallPassRate}%)`);
  console.log(`${'='.repeat(60)}\n`);

  return summary;
}

/**
 * Run smoke tests only (quick check)
 */
async function runSmokeTests() {
  console.log('[RUNNER] Running smoke tests...');

  const smokeTests = testSuites.getSmokeTests();
  return await runTestSuite(smokeTests, 'smoke');
}

/**
 * Run critical tests only
 */
async function runCriticalTests() {
  console.log('[RUNNER] Running critical tests...');

  const criticalTests = testSuites.getCriticalTests();
  return await runTestSuite(criticalTests, 'critical');
}

// ================== API ROUTES ==================

/**
 * Dashboard page
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

/**
 * Get current status
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: lastRunInfo.status,
    startTime: lastRunInfo.startTime,
    endTime: lastRunInfo.endTime,
    currentSuite: lastRunInfo.currentSuite,
    progress: lastRunInfo.progress,
    uptime: process.uptime()
  });
});

/**
 * Get latest results
 */
app.get('/api/results/latest', async (req, res) => {
  try {
    const summary = await redis.getLatestRunSummary();
    const results = await redis.getLatestResults();

    res.json({
      summary,
      results,
      lastRunInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get metrics history
 */
app.get('/api/metrics/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const metrics = await redis.getMetricsHistory(days);

    res.json({ metrics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pending alerts
 */
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await redis.getPendingAlerts();
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear alerts
 */
app.post('/api/alerts/clear', async (req, res) => {
  try {
    await redis.clearAlerts();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger manual test run
 */
app.post('/api/run', async (req, res) => {
  if (lastRunInfo.status === 'running') {
    return res.status(409).json({
      error: 'Test run already in progress',
      currentSuite: lastRunInfo.currentSuite,
      progress: lastRunInfo.progress
    });
  }

  const runType = req.body.type || 'manual';

  // Start async
  runAllTests(runType).catch(err => {
    console.error('[RUNNER] Test run failed:', err);
    lastRunInfo.status = 'error';
    lastRunInfo.error = err.message;
  });

  res.json({
    status: 'started',
    runType,
    message: 'Test run started'
  });
});

/**
 * Run smoke tests
 */
app.post('/api/run/smoke', async (req, res) => {
  if (lastRunInfo.status === 'running') {
    return res.status(409).json({ error: 'Test run already in progress' });
  }

  try {
    const result = await runSmokeTests();
    res.json({ status: 'completed', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run critical tests
 */
app.post('/api/run/critical', async (req, res) => {
  if (lastRunInfo.status === 'running') {
    return res.status(409).json({ error: 'Test run already in progress' });
  }

  try {
    const result = await runCriticalTests();
    res.json({ status: 'completed', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get test data count
 */
app.get('/api/testdata/count', async (req, res) => {
  try {
    const count = await testDataManager.countTestBookings();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger cleanup
 */
app.post('/api/testdata/cleanup', async (req, res) => {
  try {
    const result = await testDataManager.cleanupAllTestBookings();
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// ================== SCHEDULED JOBS ==================

// Full test run every 4 hours
cron.schedule('0 */4 * * *', async () => {
  console.log('[CRON] Starting scheduled full test run');
  try {
    await runAllTests('scheduled');
  } catch (error) {
    console.error('[CRON] Scheduled run failed:', error);
  }
});

// Smoke tests every hour
cron.schedule('0 * * * *', async () => {
  if (lastRunInfo.status === 'running') {
    console.log('[CRON] Skipping smoke test - full run in progress');
    return;
  }

  console.log('[CRON] Starting hourly smoke test');
  try {
    await runSmokeTests();
  } catch (error) {
    console.error('[CRON] Smoke test failed:', error);
  }
});

// Daily cleanup at 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('[CRON] Starting daily test data cleanup');
  try {
    await testDataManager.cleanupAllTestBookings();
  } catch (error) {
    console.error('[CRON] Cleanup failed:', error);
  }
});

// ================== START SERVER ==================

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Chatbot Test Runner`);
  console.log(`  Server running on port ${PORT}`);
  console.log(`  Dashboard: http://localhost:${PORT}`);
  console.log(`${'='.repeat(60)}`);
  console.log('\nScheduled jobs:');
  console.log('  - Full test run: Every 4 hours');
  console.log('  - Smoke tests: Every hour');
  console.log('  - Cleanup: Daily at 3 AM');
  console.log('\nAPI endpoints:');
  console.log('  GET  /api/status - Current status');
  console.log('  GET  /api/results/latest - Latest results');
  console.log('  GET  /api/metrics/history - Historical metrics');
  console.log('  POST /api/run - Trigger manual run');
  console.log('  POST /api/run/smoke - Run smoke tests');
  console.log('  POST /api/run/critical - Run critical tests');
  console.log(`${'='.repeat(60)}\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[SERVER] Shutting down...');
  await redis.closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[SERVER] Shutting down...');
  await redis.closeConnection();
  process.exit(0);
});
