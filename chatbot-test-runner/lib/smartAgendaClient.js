/**
 * Smart Agenda API Client
 * Handles authentication, availability checks, booking operations
 */

require('dotenv').config();

const SMART_AGENDA_BASE_URL = process.env.SMART_AGENDA_BASE_URL;
const SMART_AGENDA_LOGIN = process.env.SMART_AGENDA_LOGIN;
const SMART_AGENDA_PWD = process.env.SMART_AGENDA_PWD;
const SMART_AGENDA_API_ID = process.env.SMART_AGENDA_API_ID;
const SMART_AGENDA_API_KEY = process.env.SMART_AGENDA_API_KEY;

// Token cache
let tokenCache = {
  token: null,
  expiry: null
};

/**
 * Get authentication token (with caching)
 */
async function getToken() {
  // Check if cached token is still valid (with 5 min buffer)
  if (tokenCache.token && tokenCache.expiry && Date.now() < tokenCache.expiry - 300000) {
    return tokenCache.token;
  }

  const response = await fetch(`${SMART_AGENDA_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      login: SMART_AGENDA_LOGIN,
      pwd: SMART_AGENDA_PWD,
      api_id: SMART_AGENDA_API_ID,
      api_key: SMART_AGENDA_API_KEY
    })
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  const data = await response.json();
  tokenCache = {
    token: data.token,
    expiry: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
  };

  return tokenCache.token;
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
  const token = await getToken();

  const response = await fetch(`${SMART_AGENDA_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'X-SMARTAPI-TOKEN': token,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  return response;
}

/**
 * Get availability for a center and treatment type
 */
async function getAvailability(agendaId, typeId, startDate, endDate) {
  const response = await apiRequest('/service/getAvailabilities', {
    method: 'POST',
    body: JSON.stringify({
      pdo_type_rdv_id: typeId,
      pdo_agenda_id: agendaId,
      date_a_partir_de: startDate,
      date_fin: endDate
    })
  });

  if (response.status === 404) {
    return []; // No availability
  }

  if (!response.ok) {
    throw new Error(`Availability request failed: ${response.status}`);
  }

  const data = await response.json();

  // Transform to standard format
  const slots = [];
  for (const day of (data || [])) {
    const times = day.det?.map(slot => slot.idp) || [];
    if (times.length > 0) {
      slots.push({
        date: day.dj,
        dayName: day.nj,
        times: times
      });
    }
  }

  return slots;
}

/**
 * Get all centers/agendas
 */
async function getCenters() {
  const response = await apiRequest('/pdo_agenda');
  if (!response.ok) {
    throw new Error(`Get centers failed: ${response.status}`);
  }
  return await response.json();
}

/**
 * Get all appointment types
 */
async function getAppointmentTypes() {
  const response = await apiRequest('/pdo_type_rdv');
  if (!response.ok) {
    throw new Error(`Get appointment types failed: ${response.status}`);
  }
  return await response.json();
}

/**
 * Get booking by ID
 */
async function getBooking(bookingId) {
  const response = await apiRequest(`/pdo_events/${bookingId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Get booking failed: ${response.status}`);
  }
  return await response.json();
}

/**
 * Get all bookings (with optional date filter)
 */
async function getAllBookings(dateFrom = null, dateTo = null) {
  let endpoint = '/pdo_events';
  if (dateFrom && dateTo) {
    endpoint += `?date_debut=${dateFrom}&date_fin=${dateTo}`;
  }

  const response = await apiRequest(endpoint);
  if (!response.ok) {
    throw new Error(`Get all bookings failed: ${response.status}`);
  }
  return await response.json();
}

/**
 * Create a booking
 */
async function createBooking(bookingData) {
  // First get or create client
  const clientsResponse = await apiRequest('/pdo_client');
  const clients = await clientsResponse.json();
  let client = clients.find(c => c.mail === bookingData.email);

  if (!client) {
    const nameParts = bookingData.fullName.trim().split(' ');
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts.slice(0, -1).join(' ') || lastName;

    const createClientResponse = await apiRequest('/pdo_client', {
      method: 'POST',
      body: JSON.stringify({
        nom: lastName,
        prenom: firstName,
        mail: bookingData.email,
        telephone: bookingData.phone
      })
    });

    if (!createClientResponse.ok) {
      throw new Error(`Create client failed: ${createClientResponse.status}`);
    }
    client = await createClientResponse.json();
  }

  // Get resource
  const resourcesResponse = await apiRequest('/pdo_ressource');
  const resources = await resourcesResponse.json();
  const resourceId = resources.find(r => r.id === '-1')?.id || resources[0]?.id || '-1';

  // Calculate end time
  const duration = bookingData.duration || 60;
  const startDateTime = `${bookingData.date}T${bookingData.time}:00`;
  const endDate = new Date(startDateTime);
  endDate.setMinutes(endDate.getMinutes() + duration);

  const nameParts = bookingData.fullName.trim().split(' ');
  const lastName = nameParts[nameParts.length - 1];

  // Create appointment
  const appointmentResponse = await apiRequest('/pdo_events', {
    method: 'POST',
    body: JSON.stringify({
      client_id: client.id,
      client_nom: lastName,
      presta_id: bookingData.typeId,
      ressource_id: resourceId,
      start_date: startDateTime,
      end_date: endDate.toISOString().slice(0, 19),
      equipe_id: bookingData.agendaId,
      statut: 'C'
    })
  });

  if (!appointmentResponse.ok) {
    const errorText = await appointmentResponse.text();
    throw new Error(`Create booking failed: ${appointmentResponse.status} - ${errorText}`);
  }

  const appointment = await appointmentResponse.json();
  return {
    success: true,
    appointmentId: appointment.id,
    clientId: client.id
  };
}

/**
 * Delete a booking by ID
 */
async function deleteBooking(bookingId) {
  const response = await apiRequest(`/pdo_events/${bookingId}`, {
    method: 'DELETE'
  });

  return response.ok || response.status === 204;
}

/**
 * Check for overlapping bookings
 */
async function checkOverlaps(agendaId, date, startTime, endTime) {
  const bookings = await getAllBookings(date, date);

  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  const overlaps = bookings.filter(booking => {
    if (booking.equipe_id !== agendaId) return false;

    const bookingStart = new Date(booking.start_date);
    const bookingEnd = new Date(booking.end_date);

    // Check for overlap
    return (startDateTime < bookingEnd && endDateTime > bookingStart);
  });

  return overlaps;
}

/**
 * Count recaida bookings for a specific day and center
 */
async function countRecaidasForDay(agendaId, date, recaidaTypeId) {
  const bookings = await getAllBookings(date, date);

  return bookings.filter(booking =>
    booking.equipe_id === agendaId &&
    booking.presta_id === recaidaTypeId
  ).length;
}

module.exports = {
  getToken,
  apiRequest,
  getAvailability,
  getCenters,
  getAppointmentTypes,
  getBooking,
  getAllBookings,
  createBooking,
  deleteBooking,
  checkOverlaps,
  countRecaidasForDay
};
