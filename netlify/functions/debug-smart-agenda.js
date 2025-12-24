/**
 * Debug Smart Agenda Endpoint
 * GET /.netlify/functions/debug-smart-agenda
 *
 * Returns diagnostic information about Smart Agenda API configuration:
 * - Token status
 * - All centers with their availability
 * - Opening hours (pdo_events_ouverture) counts
 * - Recent bookings
 */

const { validateAdminSession } = require('./shared/redis-client');

// Center mapping
const CENTERS = {
  'barcelona': { agendaId: '43', name: 'Barcelona Sants' },
  'sevilla': { agendaId: '44', name: 'Sevilla' },
  'chamartin': { agendaId: '48', name: 'Madrid Chamartín' },
  'torrejon': { agendaId: '49', name: 'Torrejón de Ardoz' },
  'atocha': { agendaId: '50', name: 'Madrid Atocha' },
  'majadahonda': { agendaId: '51', name: 'Majadahonda' }
};

const APPOINTMENT_TYPES = {
  '43': { 'tabaco': '20' },
  '44': { 'tabaco': '32' },
  '48': { 'tabaco': '44' },
  '49': { 'tabaco': '53' },
  '50': { 'tabaco': '63' },
  '51': { 'tabaco': '72' }
};

// Token cache
let tokenCache = { token: null, expiry: null };

async function getSmartAgendaToken() {
  if (tokenCache.token && tokenCache.expiry && Date.now() < tokenCache.expiry - 300000) {
    return { token: tokenCache.token, cached: true };
  }

  const baseUrl = process.env.SMART_AGENDA_BASE_URL || 'https://www.smartagenda.fr/pro/laserostop-esh/api';
  const response = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: process.env.SMART_AGENDA_LOGIN,
      pwd: process.env.SMART_AGENDA_PWD,
      api_id: process.env.SMART_AGENDA_API_ID,
      api_key: process.env.SMART_AGENDA_API_KEY
    })
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  const data = await response.json();
  tokenCache = { token: data.token, expiry: Date.now() + (2 * 60 * 60 * 1000) };
  return { token: data.token, cached: false };
}

async function smartAgendaRequest(token, endpoint, options = {}) {
  const baseUrl = process.env.SMART_AGENDA_BASE_URL || 'https://www.smartagenda.fr/pro/laserostop-esh/api';

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      'X-SMARTAPI-TOKEN': token,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  return response;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Validate admin session
  const authHeader = event.headers.authorization || '';
  const sessionToken = authHeader.replace('Bearer ', '');

  if (!sessionToken) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authorization required' }) };
  }

  const isValid = await validateAdminSession(sessionToken);
  if (!isValid) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };
  }

  try {
    const diagnostic = {
      timestamp: new Date().toISOString(),
      config: {
        baseUrl: process.env.SMART_AGENDA_BASE_URL || 'https://www.smartagenda.fr/pro/laserostop-esh/api',
        hasLogin: !!process.env.SMART_AGENDA_LOGIN,
        hasPwd: !!process.env.SMART_AGENDA_PWD,
        hasApiId: !!process.env.SMART_AGENDA_API_ID,
        hasApiKey: !!process.env.SMART_AGENDA_API_KEY
      },
      token: null,
      openingHours: null,
      recentBookings: null,
      centerAvailability: {}
    };

    // Get token
    try {
      const tokenResult = await getSmartAgendaToken();
      diagnostic.token = {
        success: true,
        cached: tokenResult.cached,
        tokenPreview: tokenResult.token.substring(0, 10) + '...'
      };

      const token = tokenResult.token;

      // Get opening hours (pdo_events_ouverture / planificar)
      try {
        const openingResponse = await smartAgendaRequest(token, '/pdo_events_ouverture');
        if (openingResponse.ok) {
          const openingHours = await openingResponse.json();
          const byCenter = {};
          for (const [key, center] of Object.entries(CENTERS)) {
            const centerOpenings = openingHours.filter(oh => oh.equipe_id === center.agendaId);
            byCenter[key] = {
              name: center.name,
              agendaId: center.agendaId,
              openingSlots: centerOpenings.length,
              sampleSlots: centerOpenings.slice(0, 3).map(oh => ({
                presta_id: oh.presta_id,
                start: oh.start_date,
                end: oh.end_date
              }))
            };
          }
          diagnostic.openingHours = {
            total: openingHours.length,
            byCenter
          };
        } else {
          diagnostic.openingHours = { error: `Status ${openingResponse.status}` };
        }
      } catch (e) {
        diagnostic.openingHours = { error: e.message };
      }

      // Get recent bookings (pdo_events)
      try {
        const eventsResponse = await smartAgendaRequest(token, '/pdo_events');
        if (eventsResponse.ok) {
          const events = await eventsResponse.json();
          diagnostic.recentBookings = {
            total: events.length,
            lastBookingId: events.length > 0 ? events[events.length - 1].id : null,
            last5: events.slice(-5).map(e => ({
              id: e.id,
              client_id: e.client_id,
              start_date: e.start_date,
              statut: e.statut,
              equipe_id: e.equipe_id
            }))
          };
        } else {
          diagnostic.recentBookings = { error: `Status ${eventsResponse.status}` };
        }
      } catch (e) {
        diagnostic.recentBookings = { error: e.message };
      }

      // Check availability for each center (next 7 days, tabaco treatment)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      for (const [key, center] of Object.entries(CENTERS)) {
        try {
          const typeId = APPOINTMENT_TYPES[center.agendaId]?.['tabaco'];
          if (!typeId) {
            diagnostic.centerAvailability[key] = { error: 'No type ID configured' };
            continue;
          }

          const availResponse = await smartAgendaRequest(token, '/service/getAvailabilities', {
            method: 'POST',
            body: JSON.stringify({
              pdo_type_rdv_id: typeId,
              pdo_agenda_id: center.agendaId,
              date_a_partir_de: startDate.toISOString().split('T')[0],
              date_fin: endDate.toISOString().split('T')[0]
            })
          });

          if (availResponse.ok) {
            const availData = await availResponse.json();
            const slots = [];
            for (const day of (availData || [])) {
              if (day.det && day.det.length > 0) {
                slots.push({
                  date: day.dj,
                  times: day.det.map(s => s.idp)
                });
              }
            }

            diagnostic.centerAvailability[key] = {
              name: center.name,
              agendaId: center.agendaId,
              typeId,
              daysWithSlots: slots.length,
              slots: slots.slice(0, 3)
            };
          } else if (availResponse.status === 404) {
            diagnostic.centerAvailability[key] = {
              name: center.name,
              daysWithSlots: 0,
              slots: [],
              note: 'No availability (404)'
            };
          } else {
            diagnostic.centerAvailability[key] = {
              name: center.name,
              error: `Status ${availResponse.status}`
            };
          }
        } catch (e) {
          diagnostic.centerAvailability[key] = {
            name: center.name,
            error: e.message
          };
        }
      }

    } catch (e) {
      diagnostic.token = { success: false, error: e.message };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(diagnostic, null, 2)
    };

  } catch (error) {
    console.error('[DEBUG-SMART-AGENDA] Error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error', message: error.message })
    };
  }
};
