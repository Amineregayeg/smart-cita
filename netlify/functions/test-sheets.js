/**
 * Test Google Sheets Integration
 * GET /api/test-sheets
 */

const { GoogleAuth } = require('google-auth-library');

const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || '1YDSzRMcY6bJPe2hbIdZ5xvQpIJDxEla0tYBM2KQYZ3Q';

async function getGoogleAccessToken() {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');

  if (!credentials.private_key || !credentials.client_email) {
    throw new Error('Google Sheets credentials not configured - missing private_key or client_email');
  }

  // Fix escaped newlines in private key
  credentials.private_key = credentials.private_key.split('\\n').join('\n');

  const auth = new GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  console.log('[TEST-SHEETS] Got access token via google-auth-library');
  return tokenResponse.token;
}

async function appendToGoogleSheet(tabName, rowData) {
  const accessToken = await getGoogleAccessToken();
  const range = `${tabName}!A:G`;

  console.log('[TEST-SHEETS] Appending to sheet:', GOOGLE_SHEETS_ID);
  console.log('[TEST-SHEETS] Tab:', tabName);
  console.log('[TEST-SHEETS] Data:', rowData);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [rowData]
      })
    }
  );

  const responseText = await response.text();
  console.log('[TEST-SHEETS] Append response status:', response.status);
  console.log('[TEST-SHEETS] Append response:', responseText);

  if (!response.ok) {
    return { success: false, error: responseText };
  }

  return { success: true, result: JSON.parse(responseText) };
}

exports.handler = async (event) => {
  console.log('[TEST-SHEETS] Starting test...');

  // Debug: show what's in the env var
  const rawCreds = process.env.GOOGLE_SHEETS_CREDENTIALS || '';

  let parsedCreds;
  let keyDebug = {};
  try {
    parsedCreds = JSON.parse(rawCreds);
    const pk = parsedCreds.private_key || '';
    keyDebug = {
      keyLength: pk.length,
      keyStart: pk.substring(0, 40),
      hasLiteralBackslashN: pk.includes('\\n'),
      hasRealNewline: pk.includes('\n'),
      charCodes30to35: pk.substring(27, 32).split('').map(c => c.charCodeAt(0))
    };
  } catch (e) {
    keyDebug = { parseError: e.message };
  }

  const debugInfo = {
    envVarLength: rawCreds.length,
    hasBackslashN: rawCreds.includes('\\n'),
    sheetId: process.env.GOOGLE_SHEETS_ID,
    keyDebug
  };

  try {
    const timestamp = new Date().toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const testData = [
      timestamp,
      '123456789',
      'Test User',
      'test@test.com',
      'Test question from API',
      '',
      ''
    ];

    const result = await appendToGoogleSheet('General', testData);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: result.success,
        message: result.success ? 'Test row added to Google Sheet!' : 'Failed to add row',
        details: result,
        debug: debugInfo
      })
    };
  } catch (error) {
    console.error('[TEST-SHEETS] Error:', error.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message,
        debug: debugInfo
      })
    };
  }
};
