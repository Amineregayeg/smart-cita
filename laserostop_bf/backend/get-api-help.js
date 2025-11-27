/**
 * Get Smart Agenda API help documentation
 */
require('dotenv').config({ path: './.env' });
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');

const SMART_AGENDA_BASE_URL = process.env.SMART_AGENDA_BASE_URL;
const CREDENTIALS = {
  login: process.env.SMART_AGENDA_LOGIN,
  pwd: process.env.SMART_AGENDA_PWD,
  api_id: process.env.SMART_AGENDA_API_ID,
  api_key: process.env.SMART_AGENDA_API_KEY
};

async function test() {
  try {
    // Get token
    console.log('Getting token...');
    const tokenResponse = await fetch(`${SMART_AGENDA_BASE_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDENTIALS)
    });

    const tokenData = await tokenResponse.json();
    console.log('✅ Token obtained');

    // Get help documentation
    console.log('\nFetching /help documentation...');
    const helpResponse = await fetch(`${SMART_AGENDA_BASE_URL}/help`, {
      headers: { 'X-SMARTAPI-TOKEN': tokenData.token }
    });

    const helpHtml = await helpResponse.text();

    // Save to file
    fs.writeFileSync('api-help.html', helpHtml);
    console.log('✅ Saved to api-help.html');

    // Extract text content (simple approach)
    const textOnly = helpHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    console.log('\n=== API DOCUMENTATION ===\n');
    console.log(textOnly);

  } catch (error) {
    console.error('Error:', error);
  }
}

test();
