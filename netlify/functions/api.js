/**
 * Netlify Function for Smart Agenda API Integration
 * Handles all backend API calls for LaserOstop España booking system
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Smart Agenda API Configuration from environment variables
const SMART_AGENDA_BASE_URL = process.env.SMART_AGENDA_BASE_URL;
const CREDENTIALS = {
  login: process.env.SMART_AGENDA_LOGIN,
  pwd: process.env.SMART_AGENDA_PWD,
  api_id: process.env.SMART_AGENDA_API_ID,
  api_key: process.env.SMART_AGENDA_API_KEY
};

// Token cache (persists across function invocations within the same instance)
let tokenCache = {
  token: null,
  userToken: null,
  expiry: null
};

// ========== TOKEN MANAGEMENT ==========

/**
 * Get valid token from cache or request new one
 */
async function getToken() {
  // Check if cached token is still valid (with 5 min buffer)
  if (tokenCache.token && tokenCache.expiry && Date.now() < tokenCache.expiry - 300000) {
    console.log('Using cached token');
    return tokenCache.token;
  }

  console.log('Requesting new token from Smart Agenda...');

  try {
    const response = await fetch(`${SMART_AGENDA_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(CREDENTIALS)
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.token || !data.user_token) {
      throw new Error('Token response missing required fields');
    }

    // Cache the token (valid for 1 hour)
    tokenCache = {
      token: data.token,
      userToken: data.user_token,
      expiry: Date.now() + (60 * 60 * 1000) // 1 hour
    };

    console.log('✅ New token obtained and cached');
    return tokenCache.token;
  } catch (error) {
    console.error('❌ Token request error:', error.message);
    throw error;
  }
}

// ========== API HANDLERS ==========

/**
 * GET /api/centers
 * Fetch list of centers/agendas from Smart Agenda
 */
async function getCenters() {
  const token = await getToken();

  const response = await fetch(`${SMART_AGENDA_BASE_URL}/pdo_agenda?token=${token}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Centers API failed: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * GET /api/appointment-types?centerId=X
 * Fetch appointment types for a specific center
 */
async function getAppointmentTypes(centerId) {
  const token = await getToken();

  const response = await fetch(
    `${SMART_AGENDA_BASE_URL}/pdo_type_rdv?token=${token}&equipe_id=${centerId}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Appointment types API failed: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * GET /api/availability?centerId=X&typeId=Y&startDate=Z&endDate=W
 * Fetch availability for appointments (currently disabled - API not available)
 */
async function getAvailability(params) {
  // DISABLED: Smart Agenda API doesn't support /getAvailabilities endpoint (returns HTTP 400)
  console.log('Availability API disabled - Smart Agenda limitation');
  return {};
}

/**
 * POST /api/booking
 * Create a booking in Smart Agenda
 */
async function createBooking(bookingData) {
  const token = await getToken();
  const { centerId, typeId, resourceId, startTime, endTime, client } = bookingData;

  // Step 1: Create or find client
  let clientId;

  // Try to find existing client by email
  const searchResponse = await fetch(
    `${SMART_AGENDA_BASE_URL}/pdo_client?token=${token}&email=${encodeURIComponent(client.email)}`,
    {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }
  );

  if (searchResponse.ok) {
    const clients = await searchResponse.json();
    if (clients && clients.length > 0) {
      clientId = clients[0].id;
      console.log(`Found existing client: ${clientId}`);
    }
  }

  // Create new client if not found
  if (!clientId) {
    const clientData = {
      nom: client.lastName,
      prenom: client.firstName,
      email: client.email,
      tel: client.phone,
      equipe_id: centerId
    };

    const createClientResponse = await fetch(
      `${SMART_AGENDA_BASE_URL}/pdo_client?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      }
    );

    if (!createClientResponse.ok) {
      throw new Error(`Failed to create client: ${createClientResponse.status}`);
    }

    const newClient = await createClientResponse.json();
    clientId = newClient.id;
    console.log(`Created new client: ${clientId}`);
  }

  // Step 2: Create appointment/event
  const appointmentData = {
    client_id: clientId,
    presta_id: typeId,          // Appointment TYPE (prestation/service)
    ressource_id: resourceId,   // Practitioner/resource ID
    start_date: startTime,
    end_date: endTime,
    equipe_id: centerId,
    statut: 'C',                // Status: C = Confirmed
    internet: '1',              // Mark as online booking
    venu: '1'                   // Mark as confirmed
  };

  const createEventResponse = await fetch(
    `${SMART_AGENDA_BASE_URL}/pdo_event?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointmentData)
    }
  );

  if (!createEventResponse.ok) {
    const errorText = await createEventResponse.text();
    throw new Error(`Failed to create event: ${createEventResponse.status} - ${errorText}`);
  }

  const event = await createEventResponse.json();
  console.log(`✅ Booking created successfully: Event ID ${event.id}`);

  return {
    success: true,
    bookingId: event.id,
    clientId: clientId,
    event: event
  };
}

// ========== NETLIFY FUNCTION HANDLER ==========

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse the path to determine which API endpoint to call
    // Handle both direct function calls and redirects
    let path = event.path.replace('/.netlify/functions/api', '');

    // Remove duplicate slashes if any
    path = path.replace(/\/+/g, '/');

    const method = event.httpMethod;

    console.log(`[API] ${method} ${event.path} -> ${path}`);

    // Route to appropriate handler
    if (path === '/centers' && method === 'GET') {
      const data = await getCenters();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    if (path === '/appointment-types' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const centerId = params.centerId;

      if (!centerId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'centerId is required' })
        };
      }

      const data = await getAppointmentTypes(centerId);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    if (path === '/availability' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const data = await getAvailability(params);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    if (path === '/booking' && method === 'POST') {
      const bookingData = JSON.parse(event.body);
      const result = await createBooking(bookingData);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result)
      };
    }

    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'smart-agenda-api'
        })
      };
    }

    // Unknown endpoint
    console.log(`[API] 404 - No route matched for: ${method} ${path}`);
    console.log(`[API] Available routes: GET /centers, GET /appointment-types, GET /availability, POST /booking, GET /health`);
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'Not found',
        path: path,
        method: method,
        originalPath: event.path,
        message: 'No API route matches this request'
      })
    };

  } catch (error) {
    console.error('❌ API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
