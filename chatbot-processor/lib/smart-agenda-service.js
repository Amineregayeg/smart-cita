/**
 * Smart Agenda API Service
 * Provides availability checking and booking capabilities for chatbot
 */

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

class SmartAgendaService {
  constructor() {
    this.baseUrl = process.env.SMART_AGENDA_BASE_URL || 'https://www.smartagenda.fr/pro/laserostop-esh/api';
    this.credentials = {
      login: process.env.SMART_AGENDA_LOGIN,
      pwd: process.env.SMART_AGENDA_PWD,
      api_id: process.env.SMART_AGENDA_API_ID,
      api_key: process.env.SMART_AGENDA_API_KEY
    };
    this.tokenCache = { token: null, userToken: null, expiry: null };
  }

  // Center mapping: key -> { agendaId, name, groupId }
  static CENTERS = {
    'barcelona': { agendaId: '43', name: 'Barcelona Sants', groupId: '4' },
    'sevilla': { agendaId: '44', name: 'Sevilla', groupId: '5' },
    'chamartin': { agendaId: '48', name: 'Madrid Chamartín', groupId: '7' },
    'torrejon': { agendaId: '49', name: 'Torrejón de Ardoz', groupId: '6' },
    'atocha': { agendaId: '50', name: 'Madrid Atocha', groupId: '8' },
    'majadahonda': { agendaId: '51', name: 'Majadahonda', groupId: '10' }
  };

  // Treatment types per center: { agendaId: { treatmentKey: typeId } }
  static APPOINTMENT_TYPES = {
    '43': { // Barcelona
      'tabaco': '20',
      'duo': '21',
      'cannabis': '23',
      'recaida': '22',
      'azucar': '91'
    },
    '44': { // Sevilla
      'tabaco': '32',
      'duo': '34',
      'cannabis': '37',
      'recaida': '35',
      'azucar': '96'
    },
    '48': { // Chamartín
      'tabaco': '44',
      'duo': '46',
      'cannabis': '49',
      'recaida': '47',
      'azucar': '93'
    },
    '49': { // Torrejón
      'tabaco': '53',
      'duo': '56',
      'cannabis': '59',
      'recaida': '57',
      'azucar': '97'
    },
    '50': { // Atocha
      'tabaco': '63',
      'duo': '65',
      'cannabis': '68',
      'recaida': '66',
      'azucar': '92'
    },
    '51': { // Majadahonda
      'tabaco': '72',
      'duo': '74',
      'cannabis': '77',
      'recaida': '75',
      'azucar': '94'
    }
  };

  // Treatment info
  static TREATMENTS = {
    'tabaco': { name: 'Dejar de fumar (individual)', duration: 60, price: 190 },
    'duo': { name: 'Dejar de fumar (dúo)', duration: 90, price: 360 },
    'cannabis': { name: 'Adicción al cannabis', duration: 60, price: 250 },
    'azucar': { name: 'Adicción al azúcar', duration: 60, price: 200 },
    'recaida': { name: 'Sesión de recaída', duration: 30, price: 0 }
  };

  /**
   * Get authentication token
   */
  async getToken() {
    // Check cached token (with 5 min buffer)
    if (this.tokenCache.token && this.tokenCache.expiry && Date.now() < this.tokenCache.expiry - 300000) {
      return this.tokenCache.token;
    }

    console.log('[SMART-AGENDA] Requesting new token...');

    try {
      const response = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.credentials)
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('No token in response');
      }

      this.tokenCache = {
        token: data.token,
        userToken: data.user_token,
        expiry: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
      };

      console.log('[SMART-AGENDA] Token obtained');
      return this.tokenCache.token;

    } catch (error) {
      console.error('[SMART-AGENDA] Token error:', error.message);
      throw error;
    }
  }

  /**
   * Make authenticated API request
   */
  async apiRequest(endpoint, options = {}) {
    const token = await this.getToken();
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'X-SMARTAPI-TOKEN': token,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    return response;
  }

  /**
   * Check availability for a center and treatment
   * @param {string} centerKey - Center key (barcelona, sevilla, etc.)
   * @param {string} treatmentKey - Treatment key (tabaco, cannabis, etc.)
   * @param {number} daysAhead - Days to look ahead (default 14)
   * @returns {object} - Formatted availability result
   */
  async checkAvailability(centerKey, treatmentKey = 'tabaco', daysAhead = 14) {
    console.log(`[SMART-AGENDA] Checking availability: ${centerKey}, ${treatmentKey}, ${daysAhead} days`);

    try {
      // Validate center
      const center = SmartAgendaService.CENTERS[centerKey.toLowerCase()];
      if (!center) {
        return {
          success: false,
          error: 'invalid_center',
          message: `Centro no válido: ${centerKey}. Centros disponibles: Barcelona, Sevilla, Madrid Chamartín, Atocha, Majadahonda, Torrejón`
        };
      }

      // Get appointment type ID
      const typeId = SmartAgendaService.APPOINTMENT_TYPES[center.agendaId]?.[treatmentKey.toLowerCase()];
      if (!typeId) {
        return {
          success: false,
          error: 'invalid_treatment',
          message: `Tratamiento no válido: ${treatmentKey}. Opciones: tabaco, duo, cannabis, azucar`
        };
      }

      // Calculate date range
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + daysAhead);

      const payload = {
        pdo_type_rdv_id: typeId,
        pdo_agenda_id: center.agendaId,
        date_a_partir_de: startDate.toISOString().split('T')[0],
        date_fin: endDate.toISOString().split('T')[0]
      };

      const response = await this.apiRequest('/service/getAvailabilities', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // 404 means no availability
      if (response.status === 404) {
        return {
          success: true,
          center: center.name,
          treatment: SmartAgendaService.TREATMENTS[treatmentKey]?.name || treatmentKey,
          slots: [],
          message: `No hay disponibilidad en ${center.name} en los próximos ${daysAhead} días.`
        };
      }

      const data = await response.json();

      // Format slots for easy reading
      const formattedSlots = this.formatAvailability(data, center.name);

      return {
        success: true,
        center: center.name,
        centerId: center.agendaId,
        treatment: SmartAgendaService.TREATMENTS[treatmentKey]?.name || treatmentKey,
        treatmentId: typeId,
        price: SmartAgendaService.TREATMENTS[treatmentKey]?.price || 0,
        slots: formattedSlots,
        rawData: data // Keep raw data for booking
      };

    } catch (error) {
      console.error('[SMART-AGENDA] Availability error:', error.message);
      return {
        success: false,
        error: 'api_error',
        message: 'Error al consultar disponibilidad. Por favor, contacta por WhatsApp: +34 689 560 130'
      };
    }
  }

  /**
   * Format raw availability data into readable slots
   */
  formatAvailability(data, centerName) {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    const slots = [];
    const dayNames = {
      'Monday': 'Lunes',
      'Tuesday': 'Martes',
      'Wednesday': 'Miércoles',
      'Thursday': 'Jueves',
      'Friday': 'Viernes',
      'Saturday': 'Sábado',
      'Sunday': 'Domingo'
    };

    for (const day of data) {
      const dayName = dayNames[day.nj] || day.nj;
      const date = day.dj; // YYYY-MM-DD
      const times = day.det?.map(slot => slot.idp) || [];

      if (times.length > 0) {
        slots.push({
          dayName,
          date,
          displayDate: this.formatSpanishDate(date),
          times,
          timesFormatted: times.join(', ')
        });
      }
    }

    return slots;
  }

  /**
   * Format date in Spanish
   */
  formatSpanishDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    return date.toLocaleDateString('es-ES', options);
  }

  /**
   * Create a booking
   * @param {object} details - Booking details
   * @returns {object} - Booking result
   */
  async createBooking(details) {
    const { center, treatment, date, time, full_name, email, phone } = details;

    console.log(`[SMART-AGENDA] Creating booking: ${center}, ${date} ${time}, ${full_name}`);

    try {
      // Validate inputs
      if (!center || !treatment || !date || !time || !full_name || !email || !phone) {
        return {
          success: false,
          error: 'missing_fields',
          message: 'Faltan datos para la reserva. Necesito: centro, tratamiento, fecha, hora, nombre, email y teléfono.'
        };
      }

      // Validate email format
      if (!email.includes('@') || !email.includes('.')) {
        return {
          success: false,
          error: 'invalid_email',
          message: 'El email no parece válido. Por favor, verifica el formato.'
        };
      }

      // Validate phone (at least 9 digits)
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 9) {
        return {
          success: false,
          error: 'invalid_phone',
          message: 'El teléfono debe tener al menos 9 dígitos.'
        };
      }

      // Get center info
      const centerInfo = SmartAgendaService.CENTERS[center.toLowerCase()];
      if (!centerInfo) {
        return {
          success: false,
          error: 'invalid_center',
          message: `Centro no válido: ${center}`
        };
      }

      // Get appointment type
      const typeId = SmartAgendaService.APPOINTMENT_TYPES[centerInfo.agendaId]?.[treatment.toLowerCase()];
      if (!typeId) {
        return {
          success: false,
          error: 'invalid_treatment',
          message: `Tratamiento no válido: ${treatment}`
        };
      }

      // Calculate end time based on treatment duration
      const duration = SmartAgendaService.TREATMENTS[treatment.toLowerCase()]?.duration || 60;
      const startDateTime = `${date}T${time}:00`;
      const endDate = new Date(startDateTime);
      endDate.setMinutes(endDate.getMinutes() + duration);
      const endDateTime = endDate.toISOString().slice(0, 19);

      // Parse name for appointment
      const nameParts = full_name.trim().split(' ');
      const lastName = nameParts[nameParts.length - 1];

      // Step 1: Check/Create client
      const clientResult = await this.getOrCreateClient(full_name, email, phone);
      if (!clientResult.success) {
        return clientResult;
      }

      // Step 2: Get resource
      const resourcesResponse = await this.apiRequest('/pdo_ressource');
      const resources = await resourcesResponse.json();
      const resourceId = resources.find(r => r.id === '-1')?.id || resources[0]?.id || '-1';

      // Step 3: Create appointment
      const appointmentData = {
        client_id: clientResult.clientId,
        client_nom: lastName,  // Required by API (matches working laserostop_bf)
        presta_id: typeId,
        ressource_id: resourceId,
        start_date: startDateTime,
        end_date: endDateTime,
        equipe_id: centerInfo.agendaId,
        statut: 'C'  // Status: C = Confirmed (appears directly in agenda)
      };

      console.log('[SMART-AGENDA] Creating appointment:', appointmentData);

      const appointmentResponse = await this.apiRequest('/pdo_events', {
        method: 'POST',
        body: JSON.stringify(appointmentData)
      });

      const appointment = await appointmentResponse.json();

      if (!appointment.id) {
        throw new Error('No appointment ID returned');
      }

      console.log(`[SMART-AGENDA] Booking created: ${appointment.id}`);

      return {
        success: true,
        appointmentId: appointment.id,
        clientId: clientResult.clientId,
        center: centerInfo.name,
        treatment: SmartAgendaService.TREATMENTS[treatment.toLowerCase()]?.name || treatment,
        price: SmartAgendaService.TREATMENTS[treatment.toLowerCase()]?.price || 0,
        date: date,
        time: time,
        displayDate: this.formatSpanishDate(date),
        customerName: full_name,
        customerEmail: email,
        message: `Reserva confirmada en ${centerInfo.name} para el ${this.formatSpanishDate(date)} a las ${time}.`
      };

    } catch (error) {
      console.error('[SMART-AGENDA] Booking error:', error.message);
      return {
        success: false,
        error: 'booking_failed',
        message: 'No se pudo crear la reserva. Nuestro equipo te contactará. WhatsApp: +34 689 560 130',
        details: error.message
      };
    }
  }

  /**
   * Get existing client or create new one
   */
  async getOrCreateClient(fullName, email, phone) {
    try {
      // Check if client exists
      const clientsResponse = await this.apiRequest('/pdo_client');
      const clients = await clientsResponse.json();
      let client = clients.find(c => c.mail === email);

      if (client) {
        console.log(`[SMART-AGENDA] Existing client found: ${client.id}`);
        return { success: true, clientId: client.id, isNew: false };
      }

      // Create new client
      const nameParts = fullName.trim().split(' ');
      const lastName = nameParts[nameParts.length - 1];
      const firstName = nameParts.slice(0, -1).join(' ') || lastName;

      const clientData = {
        nom: lastName,
        prenom: firstName,
        mail: email,
        telephone: phone
      };

      console.log('[SMART-AGENDA] Creating new client:', clientData);

      const createResponse = await this.apiRequest('/pdo_client', {
        method: 'POST',
        body: JSON.stringify(clientData)
      });

      client = await createResponse.json();

      if (!client.id) {
        throw new Error('No client ID returned');
      }

      console.log(`[SMART-AGENDA] Client created: ${client.id}`);
      return { success: true, clientId: client.id, isNew: true };

    } catch (error) {
      console.error('[SMART-AGENDA] Client error:', error.message);
      return {
        success: false,
        error: 'client_error',
        message: 'Error al registrar tus datos. Por favor, contacta por WhatsApp: +34 689 560 130'
      };
    }
  }

  /**
   * Get center information
   */
  getCenterInfo(centerKey) {
    if (centerKey === 'all') {
      return {
        success: true,
        centers: Object.entries(SmartAgendaService.CENTERS).map(([key, info]) => ({
          key,
          name: info.name,
          ...this.getCenterDetails(key)
        }))
      };
    }

    const center = SmartAgendaService.CENTERS[centerKey.toLowerCase()];
    if (!center) {
      return {
        success: false,
        error: 'invalid_center',
        message: `Centro no encontrado: ${centerKey}`
      };
    }

    return {
      success: true,
      ...this.getCenterDetails(centerKey)
    };
  }

  /**
   * Get detailed center info
   */
  getCenterDetails(centerKey) {
    const details = {
      'barcelona': {
        name: 'LaserOstop Barcelona Sants',
        address: 'Carrer de Galileu, 65, Sants-Montjuïc, 08028 Barcelona',
        phone: '+34 689 560 130',
        mapLink: 'https://maps.google.com/?q=LaserOstop+Barcelona+Sants'
      },
      'sevilla': {
        name: 'LaserOstop Sevilla',
        address: 'Avenida Eduardo Dato 85, 41005 Sevilla',
        phone: '+34 689 560 130',
        mapLink: 'https://maps.google.com/?q=LaserOstop+Sevilla'
      },
      'chamartin': {
        name: 'LaserOstop Madrid Chamartín',
        address: 'Calle de Oruro, 9, Chamartín, 28016 Madrid',
        phone: '+34 919 305 313',
        mapLink: 'https://maps.google.com/?q=LaserOstop+Madrid+Chamartin'
      },
      'atocha': {
        name: 'LaserOstop Madrid Atocha',
        address: 'Calle Canarias 26, Atocha, 28045 Madrid',
        phone: '+34 613 255 948',
        mapLink: 'https://maps.google.com/?q=LaserOstop+Madrid+Atocha'
      },
      'torrejon': {
        name: 'LaserOstop Torrejón de Ardoz',
        address: 'Calle Pesquera, 10, 28850 Torrejón de Ardoz',
        phone: '+34 919 305 313',
        mapLink: 'https://maps.google.com/?q=LaserOstop+Torrejon'
      },
      'majadahonda': {
        name: 'LaserOstop Majadahonda',
        address: 'Calle del Dr Calero, 19, Centro comercial Tutti, 28220 Majadahonda',
        phone: '+34 919 305 313',
        mapLink: 'https://maps.google.com/?q=LaserOstop+Majadahonda'
      }
    };

    return details[centerKey.toLowerCase()] || { name: centerKey, address: 'Dirección no disponible' };
  }
}

module.exports = { SmartAgendaService };
