/**
 * Netlify Function for Smart Agenda API Integration
 * Matches original Express backend behavior exactly
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Import SendGrid (CommonJS require works in Netlify Functions)
let sgMail;
try {
  sgMail = require('@sendgrid/mail');

  // Initialize SendGrid with API key from environment variables
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✅ SendGrid initialized with API key');
  } else {
    console.warn('⚠️ SENDGRID_API_KEY not found - admin emails will be skipped');
  }
} catch (error) {
  console.error('❌ Failed to load SendGrid:', error);
  sgMail = null;
}

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

    // Cache the token (valid for 2 hours)
    tokenCache = {
      token: data.token,
      userToken: data.user_token,
      expiry: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
    };

    console.log('✅ New token obtained and cached');
    return tokenCache.token;
  } catch (error) {
    console.error('❌ Token request error:', error.message);
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

// ========== API HANDLERS ==========

/**
 * GET /api/centers
 * Get all active centers - EXACTLY matches original Express backend
 */
async function getCenters() {
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

  return activeCenters;
}

/**
 * GET /api/appointment-types?centerId=X
 * Fetch appointment types for a specific center - EXACTLY matches original Express backend
 */
async function getAppointmentTypes(centerId) {
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

  return formattedTypes;
}

/**
 * GET /api/availability?startDate=X&endDate=Y
 * Get available time slots - EXACTLY matches original Express backend
 */
async function getAvailability(params) {
  const { centerId, typeId, startDate, endDate } = params;

  if (!startDate || !endDate) {
    throw new Error('startDate and endDate are required');
  }

  // Get resources first (practitioners)
  const resources = await smartAgendaRequest('/pdo_ressource');

  // Use generic resource (-1) or first available resource
  const resourceId = resources.find(r => r.id === '-1')?.id || resources[0]?.id || '-1';

  // Build query parameters
  const queryParams = new URLSearchParams({
    id_ressource: resourceId,
    date_debut: startDate,
    date_fin: endDate
  });

  if (typeId) {
    queryParams.append('id_type_rdv', typeId);
  }

  const availability = await smartAgendaRequest(`/getAvailabilities?${queryParams.toString()}`);

  return availability;
}

/**
 * Send admin notification email about new booking
 */
async function sendAdminNotificationEmail(bookingDetails) {
  // Skip if SendGrid not loaded or not configured
  if (!sgMail) {
    console.log('⚠️ SendGrid not loaded - skipping admin email');
    return;
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.log('⚠️ SendGrid API key not configured - skipping admin email');
    return;
  }

  console.log('📧 Preparing to send admin notification email...');

  const { fullName, email, phone, centerName, appointmentType, startTime, appointmentId } = bookingDetails;

  const msg = {
    to: process.env.ADMIN_EMAIL || 'laserostop.espagne@gmail.com',
    from: process.env.FROM_EMAIL || 'aminregeq1@gmail.com',
    subject: `🎯 Nueva Reserva - ${centerName}`,
    text: `
Nueva reserva confirmada:

📍 Centro: ${centerName}
👤 Cliente: ${fullName}
📧 Email: ${email}
📞 Teléfono: ${phone}
🎯 Tipo de sesión: ${appointmentType}
📅 Fecha y hora: ${new Date(startTime).toLocaleString('es-ES', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}
🆔 ID de cita: ${appointmentId}

---
Este email fue generado automáticamente por el sistema de reservas LaserOstop.
    `.trim(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #10b981; margin-top: 0;">🎯 Nueva Reserva Confirmada</h2>

          <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #059669;">Centro: ${centerName}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">👤 Cliente:</td>
              <td style="padding: 10px 0;">${fullName}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">📧 Email:</td>
              <td style="padding: 10px 0;"><a href="mailto:${email}" style="color: #10b981;">${email}</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">📞 Teléfono:</td>
              <td style="padding: 10px 0;"><a href="tel:${phone}" style="color: #10b981;">${phone}</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">🎯 Tipo de sesión:</td>
              <td style="padding: 10px 0;">${appointmentType}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">📅 Fecha y hora:</td>
              <td style="padding: 10px 0;">${new Date(startTime).toLocaleString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-weight: bold; color: #6b7280;">🆔 ID de cita:</td>
              <td style="padding: 10px 0;">${appointmentId}</td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            Este email fue generado automáticamente por el sistema de reservas LaserOstop
          </p>
        </div>
      </div>
    `
  };

  try {
    console.log('📤 Sending email to:', msg.to);
    console.log('📤 From:', msg.from);
    console.log('📤 Subject:', msg.subject);

    const result = await sgMail.send(msg);
    console.log('✅ SendGrid response:', JSON.stringify(result[0]?.statusCode));
    console.log('✅ Admin notification email sent successfully to:', msg.to);
  } catch (error) {
    console.error('❌ Failed to send admin email:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error response:', error.response?.body);
    // Don't throw - we don't want to fail the booking if email fails
  }
}

/**
 * POST /api/booking
 * Create a booking in Smart Agenda - EXACTLY matches original Express backend
 */
async function createBooking(bookingData) {
  const { fullName, email, phone, centerId, typeId, startTime, endTime, source } = bookingData;

  console.log('📋 Received booking request:', { fullName, email, phone, centerId, typeId, startTime, endTime, source: source || 'direct' });

  // Validate required fields
  if (!fullName || !email || !phone || !centerId || !typeId || !startTime || !endTime) {
    throw new Error('Missing required fields');
  }

  // Split full name into first and last name (BACKEND handles this, not frontend!)
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
      telephone: phone,
      id_groupe: centerId
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
    presta_id: typeId,        // IMPORTANT: presta_id = appointment TYPE (prestation/service), not practitioner!
    ressource_id: resourceId, // Resource/practitioner ID
    start_date: startTime,    // Start date/time
    end_date: endTime,        // End date/time
    equipe_id: centerId,      // Team/center ID
    internet: '1'             // Required for calendar visibility in Smart Agenda dashboard
  };
  console.log('Appointment data:', appointmentData);

  const appointment = await smartAgendaRequest('/pdo_events', {
    method: 'POST',
    body: JSON.stringify(appointmentData)
  });

  console.log('✅ Appointment created successfully:', appointment.id);

  // Send admin notification email (non-blocking, won't fail booking if email fails)
  try {
    // Get center and appointment type names for email
    // Use correct Smart Agenda endpoints: /pdo_groupe for centers, /pdo_type_rdv for types
    const centers = await smartAgendaRequest('/pdo_groupe');
    const centerName = centers.find(c => c.id === centerId)?.nom || `Center ${centerId}`;

    const types = await smartAgendaRequest('/pdo_type_rdv');
    const appointmentType = types.find(t => t.id === typeId)?.nom || `Type ${typeId}`;

    console.log('📧 Email data - Center:', centerName, '| Type:', appointmentType);

    await sendAdminNotificationEmail({
      fullName,
      email,
      phone,
      centerName,
      appointmentType,
      startTime,
      appointmentId: appointment.id
    });
  } catch (emailError) {
    console.error('📧 Email notification failed (non-critical):', emailError.message || emailError);
    // Continue - don't fail booking if email fails
  }

  return {
    success: true,
    appointmentId: appointment.id,
    clientId: client.id,
    message: 'Booking created successfully'
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
    let path = event.path;

    // Remove the function path if present
    path = path.replace('/.netlify/functions/api', '');

    // Remove the redirect source paths if present
    path = path.replace('/laserostop_espagna/api', '');
    path = path.replace('/api', '');

    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    // Remove duplicate slashes
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
          status: 'ok',
          timestamp: new Date().toISOString(),
          tokenCached: !!tokenCache.token
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
        details: error.toString(),
        timestamp: new Date().toISOString()
      })
    };
  }
};
