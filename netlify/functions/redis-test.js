/**
 * Redis Connection Test
 * GET /.netlify/functions/redis-test
 */

exports.handler = async (event) => {
  const results = {
    envCheck: null,
    moduleLoad: null,
    connection: null,
    pingTest: null,
    error: null
  };

  // Step 1: Check environment variable
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    results.envCheck = 'MISSING - UPSTASH_REDIS_URL not set';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results, null, 2)
    };
  }
  results.envCheck = `OK - starts with: ${redisUrl.substring(0, 20)}...`;

  // Step 2: Load ioredis module
  let Redis;
  try {
    Redis = require('ioredis');
    results.moduleLoad = 'OK - ioredis loaded';
  } catch (err) {
    results.moduleLoad = `FAILED - ${err.message}`;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results, null, 2)
    };
  }

  // Step 3: Create connection
  let client;
  try {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 10000,
      commandTimeout: 10000,
      tls: {
        rejectUnauthorized: false
      }
    });
    results.connection = 'OK - client created';
  } catch (err) {
    results.connection = `FAILED - ${err.message}`;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results, null, 2)
    };
  }

  // Step 4: Test ping
  try {
    const pingResult = await client.ping();
    results.pingTest = `OK - ${pingResult}`;
    await client.quit();
  } catch (err) {
    results.pingTest = `FAILED - ${err.message}`;
    results.error = err.stack;
    try { await client.quit(); } catch (e) { /* ignore */ }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(results, null, 2)
  };
};
