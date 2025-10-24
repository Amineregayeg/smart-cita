require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://laserostop-espana.netlify.app',
      'http://localhost:3000',
      'http://localhost:8080'
    ];

    // Check if CORS_ORIGIN env var is set and use it
    if (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*') {
      allowedOrigins.push(process.env.CORS_ORIGIN);
    }

    if (process.env.CORS_ORIGIN === '*' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('../')); // Serve frontend files

// Smart Agenda API Configuration from environment variables
const SMART_AGENDA_BASE_URL = process.env.SMART_AGENDA_BASE_URL;
const CREDENTIALS = {
  login: process.env.SMART_AGENDA_LOGIN,
  pwd: process.env.SMART_AGENDA_PWD,
  api_id: process.env.SMART_AGENDA_API_ID,
  api_key: process.env.SMART_AGENDA_API_KEY
};

// Validate required environment variables
const requiredEnvVars = [
  'SMART_AGENDA_BASE_URL',
  'SMART_AGENDA_LOGIN',
  'SMART_AGENDA_PWD',
  'SMART_AGENDA_API_ID',
  'SMART_AGENDA_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please create a .env file with the required variables.');
  process.exit(1);
}

// Token cache
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

    // Cache token (valid for 2 hours)
    tokenCache = {
      token: data.token,
      userToken: data.user_token,
      expiry: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
    };

    console.log('New token obtained successfully');
    return tokenCache.token;
  } catch (error) {
    console.error('Error getting token:', error);
    throw error;
  }
}

/**
 * Make authenticated request to Smart Agenda API
 */
async function smartAgendaRequest(endpoint, options = {}) {
  const token = await getToken();

  const url = `${SMART_AGENDA_BASE_URL}${endpoint}`;
  const headers = {
    'X-SMARTAPI-TOKEN': token,
    'Content-Type': 'application/json',
    ...options.headers
  };

  console.log(`Smart Agenda API: ${options.method || 'GET'} ${endpoint}`);

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Smart Agenda API error: ${response.status}`, errorText);
    throw new Error(`Smart Agenda API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ========== API ENDPOINTS ==========

/**
 * GET /api/centers - Get all active centers
 * Note: Both TEST and PROD use pdo_groupe for centers (locations)
 * pdo_agenda is for practitioners/staff, not centers
 */
app.get('/api/centers', async (req, res) => {
  try {
    const groups = await smartAgendaRequest('/pdo_groupe');

    // Filter active centers (etat !== "S") and sort by order
    const activeCenters = groups
      .filter(center => center.etat !== 'S')
      .sort((a, b) => parseInt(a.ordre) - parseInt(b.ordre))
      .map(center => ({
        id: center.id,
        name: center.libelle,
        order: parseInt(center.ordre),
        image: center.image,
        address: center.perso1 ? center.perso1.replace(/<[^>]*>/g, '') : '', // Strip HTML
        mapLink: center.perso2 ? center.perso2.match(/href="([^"]*)"/)?.[1] : '',
        bookingLink: center.link_rdv
      }));

    res.json(activeCenters);
  } catch (error) {
    console.error('Error fetching centers:', error);
    res.status(500).json({ error: 'Failed to fetch centers', message: error.message });
  }
});

/**
 * GET /api/appointment-types - Get appointment types for a center
 */
app.get('/api/appointment-types', async (req, res) => {
  try {
    const { centerId } = req.query;

    const types = await smartAgendaRequest('/pdo_type_rdv');

    // Filter by center only (no longer filtering by afficher_site or reservable flags)
    let filteredTypes = types;

    // If centerId provided, filter by center
    if (centerId) {
      filteredTypes = filteredTypes.filter(type => type.id_groupe === centerId);
    }

    const formattedTypes = filteredTypes.map(type => ({
      id: type.id,
      name: type.nom,
      duration: parseInt(type.duree),
      price: parseFloat(type.prix_ttc),
      deposit: type.acompte ? parseFloat(type.acompte) : 0,
      centerId: type.id_groupe,
      description: type.description,
      instructions: type.perso1,
      stripeLink: type.perso2,
      bookingLink: type.link_rdv,
      // Include flags for debugging/frontend filtering
      afficherSite: type.afficher_site,
      reservable: type.reservable
    }));

    res.json(formattedTypes);
  } catch (error) {
    console.error('Error fetching appointment types:', error);
    res.status(500).json({ error: 'Failed to fetch appointment types', message: error.message });
  }
});

/**
 * GET /api/availability - Get available time slots
 */
app.get('/api/availability', async (req, res) => {
  try {
    const { centerId, typeId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // Get resources first (practitioners)
    const resources = await smartAgendaRequest('/pdo_ressource');

    // Use generic resource (-1) or first available resource
    const resourceId = resources.find(r => r.id === '-1')?.id || resources[0]?.id || '-1';

    // Build query parameters for getAvailabilities service
    const params = new URLSearchParams({
      date_a_partir_de: startDate,
      date_fin: endDate
    });

    if (centerId) {
      params.append('pdo_agenda_id', centerId); // Filter by specific agenda/center
    }

    if (typeId) {
      params.append('pdo_type_rdv_id', typeId); // Filter by appointment type
    }

    const availability = await smartAgendaRequest(`/getAvailabilities?${params.toString()}`);

    res.json(availability);
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability', message: error.message });
  }
});

/**
 * POST /api/booking - Create a new booking
 */
app.post('/api/booking', async (req, res) => {
  try {
    const { fullName, email, phone, centerId, typeId, startTime, endTime, source } = req.body;

    console.log('📋 Received booking request:', { fullName, email, phone, centerId, typeId, startTime, endTime, source: source || 'direct' });

    // Validate required fields
    if (!fullName || !email || !phone || !centerId || !typeId || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Split full name into first and last name
    const nameParts = fullName.trim().split(' ');
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts.slice(0, -1).join(' ') || lastName;

    // Step 1: Check if client exists
    console.log('🔍 Checking for existing client with email:', email);
    const clients = await smartAgendaRequest('/pdo_client');
    let client = clients.find(c => c.mail === email);

    // Step 2: Create client if doesn't exist
    if (!client) {
      console.log('👤 Creating new client...');
      const clientData = {
        nom: lastName,
        prenom: firstName,
        mail: email,
        telephone: phone
        // Note: Not setting id_agenda or id_groupe - let API handle assignment
      };
      console.log('Client data:', clientData);

      client = await smartAgendaRequest('/pdo_client', {
        method: 'POST',
        body: JSON.stringify(clientData)
      });
      console.log('✅ Client created:', client.id);
    } else {
      console.log('✅ Existing client found:', client.id);
    }

    // Step 3: Get resource
    console.log('🔍 Fetching resources...');
    const resources = await smartAgendaRequest('/pdo_ressource');
    const resourceId = resources.find(r => r.id === '-1')?.id || resources[0]?.id || '-1';
    console.log('📌 Using resource ID:', resourceId);

    // Step 4: Create appointment
    console.log('📅 Creating appointment...');
    const appointmentData = {
      client_id: client.id,     // Client ID
      client_nom: lastName,     // Required by API
      presta_id: typeId,        // IMPORTANT: presta_id = appointment TYPE (prestation/service), not practitioner!
      ressource_id: resourceId, // Resource/practitioner ID
      start_date: startTime,    // Start date/time
      end_date: endTime,        // End date/time
      equipe_id: centerId,      // Required: column ID in agenda
      statut: 'C'               // Status: C = Confirmed
    };
    console.log('Appointment data:', appointmentData);

    const appointment = await smartAgendaRequest('/pdo_events', {
      method: 'POST',
      body: JSON.stringify(appointmentData)
    });

    console.log('✅ Appointment created successfully:', appointment.id);

    res.json({
      success: true,
      appointmentId: appointment.id,
      clientId: client.id,
      message: 'Booking created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating booking:', error.message);
    console.error('Full error:', error);
    res.status(500).json({
      error: 'Failed to create booking',
      message: error.message,
      details: error.toString()
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    tokenCached: !!tokenCache.token
  });
});

// ========== START SERVER ==========

app.listen(PORT, () => {
  console.log(`✅ LaserOstop API Server running on http://localhost:${PORT}`);
  const envName = SMART_AGENDA_BASE_URL.includes('-dev') ? 'laserostop-esh-dev (test)' : 'laserostop-esh (PRODUCTION)';
  console.log(`📍 Smart Agenda Environment: ${envName}`);
  console.log(`🔗 Frontend: http://localhost:${PORT}/lp_code/index.html`);
  console.log('\nAvailable endpoints:');
  console.log('  GET  /api/health');
  console.log('  GET  /api/centers');
  console.log('  GET  /api/appointment-types?centerId=1');
  console.log('  GET  /api/availability?startDate=2025-10-15&endDate=2025-10-22');
  console.log('  POST /api/booking');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});
