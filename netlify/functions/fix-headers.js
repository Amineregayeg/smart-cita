/**
 * One-time script to fix Google Sheet headers
 * GET /api/fix-headers
 */

const { SignJWT, importPKCS8 } = require('jose');

const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || '1YDSzRMcY6bJPe2hbIdZ5xvQpIJDxEla0tYBM2KQYZ3Q';

const SHEET_TABS = ['LS-Espagna', 'Barcelona', 'Atocha', 'Sevilla', 'Majadahonda', 'Chamartín', 'Torrejón'];

const HEADERS = ['Timestamp', 'Phone', 'Name', 'Preferred Time', 'Question', 'Center', 'Treatment'];

async function getGoogleAccessToken() {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
  if (!credentials.private_key || !credentials.client_email) {
    throw new Error('Google Sheets credentials not configured');
  }

  const privateKey = credentials.private_key.split('\\n').join('\n');
  const key = await importPKCS8(privateKey, 'RS256');

  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/spreadsheets'
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(credentials.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function updateHeaders(tabName, accessToken) {
  const range = `'${tabName}'!A1:G1`;

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [HEADERS]
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    return { tab: tabName, success: false, error };
  }

  return { tab: tabName, success: true };
}

exports.handler = async (event) => {
  try {
    const accessToken = await getGoogleAccessToken();

    const results = [];
    for (const tab of SHEET_TABS) {
      const result = await updateHeaders(tab, accessToken);
      results.push(result);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Headers updated on all sheets',
        headers: HEADERS,
        results
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
