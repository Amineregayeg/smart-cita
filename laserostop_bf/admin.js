/**
 * LaserOstop Admin Dashboard JavaScript
 * Handles authentication, stats display, conversation logs, and chat testing
 */

// Configuration
const API_BASE = '/.netlify/functions';
const REFRESH_INTERVAL = 30000; // 30 seconds
const SESSION_KEY = 'laserostop_admin_session';

// State
let currentPage = 1;
let refreshTimer = null;
let charts = {};
let chartsInitialized = false;
let chatHistory = []; // For multi-turn booking conversations

// ==================== AUTHENTICATION ====================

/**
 * Hash password using SHA-256
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if user has a session token (doesn't validate it)
 */
function hasSessionToken() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return false;

  try {
    const { token, expiresAt } = JSON.parse(session);
    if (new Date(expiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return !!token;
  } catch {
    return false;
  }
}

/**
 * Get session token
 */
function getToken() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    return JSON.parse(session).token;
  } catch {
    return null;
  }
}

/**
 * Validate session with server
 */
async function validateSession() {
  const token = getToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE}/admin-stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Login handler
 */
async function handleLogin(event) {
  event.preventDefault();

  const password = document.getElementById('password-input').value;
  const loginBtn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<div class="spinner mx-auto"></div>';
  errorEl.classList.add('hidden');

  try {
    const passwordHash = await hashPassword(password);

    const response = await fetch(`${API_BASE}/admin-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passwordHash })
    });

    const data = await response.json();

    if (data.success) {
      // Clear any old session first
      localStorage.removeItem(SESSION_KEY);

      // Store new session
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        token: data.token,
        expiresAt: data.expiresAt
      }));

      console.log('Login successful, token stored');
      showDashboard();
    } else {
      errorEl.textContent = data.error || 'Contrasena incorrecta';
      errorEl.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = 'Error de conexion';
    errorEl.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span class="material-icons">login</span> Acceder';
  }
}

/**
 * Logout handler
 */
function handleLogout() {
  localStorage.removeItem(SESSION_KEY);
  stopAutoRefresh();
  destroyCharts();
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('password-input').value = '';
}

// ==================== DASHBOARD ====================

/**
 * Show dashboard after login
 */
function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');

  // Initialize charts (destroy first if they exist)
  destroyCharts();
  initCharts();

  // Load data
  loadStats();
  loadConversations();
  startAutoRefresh();
}

/**
 * Destroy existing charts
 */
function destroyCharts() {
  if (charts.messages) {
    charts.messages.destroy();
    charts.messages = null;
  }
  if (charts.platform) {
    charts.platform.destroy();
    charts.platform = null;
  }
  if (charts.tokens) {
    charts.tokens.destroy();
    charts.tokens = null;
  }
  chartsInitialized = false;
}

/**
 * Initialize Chart.js charts
 */
function initCharts() {
  if (chartsInitialized) return;

  // Messages per day chart
  const messagesCtx = document.getElementById('messages-chart').getContext('2d');
  charts.messages = new Chart(messagesCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Mensajes',
        data: [],
        borderColor: '#22A9AF',
        backgroundColor: 'rgba(34, 169, 175, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // Platform breakdown chart
  const platformCtx = document.getElementById('platform-chart').getContext('2d');
  charts.platform = new Chart(platformCtx, {
    type: 'doughnut',
    data: {
      labels: ['WhatsApp', 'Messenger', 'Instagram'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: ['#25D366', '#0084FF', '#E4405F']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  // Tokens usage chart
  const tokensCtx = document.getElementById('tokens-chart').getContext('2d');
  charts.tokens = new Chart(tokensCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Tokens',
        data: [],
        backgroundColor: '#8B5CF6'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  chartsInitialized = true;
}

/**
 * Load stats from API
 */
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/admin-stats`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log('Session invalid, logging out');
        handleLogout();
        return;
      }
      throw new Error('Failed to load stats');
    }

    const stats = await response.json();
    updateStatsDisplay(stats);
    updateCharts(stats);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

/**
 * Update stats display
 */
function updateStatsDisplay(stats) {
  document.getElementById('messages-today').textContent = formatNumber(stats.messagesToday);
  document.getElementById('messages-total').textContent = formatNumber(stats.messagesTotal);
  document.getElementById('tokens-today').textContent = formatNumber(stats.tokensToday);
  document.getElementById('cost-today').textContent = `$${stats.costToday.toFixed(2)}`;
  document.getElementById('avg-response-time').textContent = formatNumber(stats.avgResponseTime);

  // Booking stats
  document.getElementById('bookings-today').textContent = formatNumber(stats.bookingsToday || 0);
  document.getElementById('bookings-total').textContent = `Total: ${formatNumber(stats.bookingsTotal || 0)}`;
}

/**
 * Update charts with new data
 */
function updateCharts(stats) {
  if (!charts.messages || !charts.platform || !charts.tokens) return;

  // Messages chart
  const msgLabels = stats.dailyMessages.map(d => formatDate(d.date));
  const msgData = stats.dailyMessages.map(d => d.count);
  charts.messages.data.labels = msgLabels;
  charts.messages.data.datasets[0].data = msgData;
  charts.messages.update();

  // Platform chart
  const platformData = [
    stats.platformBreakdown.whatsapp,
    stats.platformBreakdown.messenger,
    stats.platformBreakdown.instagram
  ];
  charts.platform.data.datasets[0].data = platformData;
  charts.platform.update();

  // Tokens chart
  const tokenLabels = stats.dailyTokens.map(d => formatDate(d.date));
  const tokenData = stats.dailyTokens.map(d => d.tokens);
  charts.tokens.data.labels = tokenLabels;
  charts.tokens.data.datasets[0].data = tokenData;
  charts.tokens.update();
}

// ==================== CONVERSATIONS ====================

/**
 * Load conversation logs
 */
async function loadConversations() {
  const tableBody = document.getElementById('logs-table-body');
  const search = document.getElementById('search-input').value;
  const platform = document.getElementById('platform-filter').value;

  tableBody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-8 text-gray-500">
        <div class="spinner mx-auto mb-2"></div>
        Cargando conversaciones...
      </td>
    </tr>
  `;

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 20,
      ...(search && { search }),
      ...(platform && { platform })
    });

    const response = await fetch(`${API_BASE}/admin-conversations?${params}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleLogout();
        return;
      }
      throw new Error('Failed to load conversations');
    }

    const data = await response.json();
    displayConversations(data);
  } catch (error) {
    console.error('Error loading conversations:', error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-red-500">
          Error al cargar conversaciones
        </td>
      </tr>
    `;
  }
}

/**
 * Display conversations in table
 */
function displayConversations(data) {
  const tableBody = document.getElementById('logs-table-body');

  if (data.conversations.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-gray-500">
          No hay conversaciones
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = data.conversations.map(conv => `
    <tr class="cursor-pointer" onclick="showConversationDetail('${conv.id}')">
      <td class="whitespace-nowrap">${formatDateTime(conv.timestamp)}</td>
      <td><span class="platform-badge ${conv.platform}">${conv.platform}</span></td>
      <td class="font-mono text-sm">...${conv.userId}</td>
      <td class="max-w-xs truncate">${escapeHtml(conv.userMessage)}</td>
      <td class="max-w-xs truncate">${escapeHtml(conv.botResponse)}</td>
      <td>${conv.tokens}</td>
      <td>${conv.responseTime}ms</td>
    </tr>
  `).join('');

  // Update pagination
  document.getElementById('pagination-info').textContent =
    `Mostrando ${data.conversations.length} de ${data.total}`;

  document.getElementById('prev-page').disabled = currentPage <= 1;
  document.getElementById('next-page').disabled = currentPage >= data.pages;
}

/**
 * Show conversation detail (expand row)
 */
function showConversationDetail(id) {
  // TODO: Implement modal or expanded view
  console.log('Show detail for:', id);
}

// ==================== CHAT TESTER ====================

/**
 * Handle chat form submission
 */
async function handleChatSubmit(event) {
  event.preventDefault();

  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  const messagesContainer = document.getElementById('chat-messages');
  const statsEl = document.getElementById('chat-stats');

  // Add user message to history
  chatHistory.push({ role: 'user', content: message });

  // Add user message to UI
  messagesContainer.innerHTML += `
    <div class="chat-bubble user">${escapeHtml(message)}</div>
  `;

  input.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Add loading indicator
  const loadingId = 'loading-' + Date.now();
  messagesContainer.innerHTML += `
    <div id="${loadingId}" class="chat-bubble bot">
      <div class="spinner"></div>
    </div>
  `;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const response = await fetch(`${API_BASE}/admin-test-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        message,
        conversationHistory: chatHistory.slice(-8) // Send last 8 messages for context
      })
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleLogout();
        return;
      }
      throw new Error('Chat request failed');
    }

    const data = await response.json();

    // Add assistant response to history
    chatHistory.push({ role: 'assistant', content: data.response });

    // Build booking indicator if a booking was created
    let bookingBadge = '';
    if (data.bookingCreated && data.appointmentId) {
      bookingBadge = `<div class="booking-badge">✅ Reserva creada: ID ${data.appointmentId}</div>`;
    }

    // Remove loading, add bot response
    document.getElementById(loadingId).remove();
    messagesContainer.innerHTML += `
      <div class="chat-bubble bot">
        ${bookingBadge}
        ${escapeHtml(data.response).replace(/\n/g, '<br>')}
        <div class="chat-meta">${data.tokens} tokens | ${data.responseTime}ms</div>
      </div>
    `;

    // Update stats
    statsEl.classList.remove('hidden');
    document.getElementById('stat-tokens').textContent = data.tokens;
    document.getElementById('stat-time').textContent = `${data.responseTime}ms`;

  } catch (error) {
    console.error('Chat error:', error);
    document.getElementById(loadingId).remove();
    messagesContainer.innerHTML += `
      <div class="chat-bubble bot text-red-500">
        Error al procesar el mensaje
      </div>
    `;
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Clear chat history
 */
function clearChat() {
  chatHistory = []; // Reset conversation history
  document.getElementById('chat-messages').innerHTML = `
    <div class="chat-bubble bot">
      Hola! Soy el asistente virtual de LaserOstop Espana. Puedo ayudarte a consultar disponibilidad y reservar citas. Como puedo ayudarte?
    </div>
  `;
  document.getElementById('chat-stats').classList.add('hidden');
}

// ==================== SETTINGS ====================

/**
 * Load platform settings from API
 */
async function loadSettings() {
  try {
    const response = await fetch(`${API_BASE}/admin-settings`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleLogout();
        return;
      }
      throw new Error('Failed to load settings');
    }

    const data = await response.json();
    updateSettingsDisplay(data.platforms);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Update settings display with platform status
 */
function updateSettingsDisplay(platforms) {
  // WhatsApp
  const whatsappToggle = document.getElementById('toggle-whatsapp');
  const whatsappStatus = document.getElementById('whatsapp-status');
  if (whatsappToggle && whatsappStatus) {
    whatsappToggle.checked = platforms.whatsapp;
    whatsappStatus.textContent = platforms.whatsapp ? 'Activo' : 'Inactivo';
    whatsappStatus.className = `platform-status ${platforms.whatsapp ? 'enabled' : 'disabled'}`;
  }

  // Messenger
  const messengerToggle = document.getElementById('toggle-messenger');
  const messengerStatus = document.getElementById('messenger-status');
  if (messengerToggle && messengerStatus) {
    messengerToggle.checked = platforms.messenger;
    messengerStatus.textContent = platforms.messenger ? 'Activo' : 'Inactivo';
    messengerStatus.className = `platform-status ${platforms.messenger ? 'enabled' : 'disabled'}`;
  }

  // Instagram
  const instagramToggle = document.getElementById('toggle-instagram');
  const instagramStatus = document.getElementById('instagram-status');
  if (instagramToggle && instagramStatus) {
    instagramToggle.checked = platforms.instagram;
    instagramStatus.textContent = platforms.instagram ? 'Activo' : 'Inactivo';
    instagramStatus.className = `platform-status ${platforms.instagram ? 'enabled' : 'disabled'}`;
  }
}

/**
 * Toggle platform enabled/disabled
 */
async function togglePlatform(platform, enabled) {
  const toggle = document.getElementById(`toggle-${platform}`);
  const statusEl = document.getElementById(`${platform}-status`);
  const saveStatus = document.getElementById('settings-save-status');

  // Disable toggle while saving
  if (toggle) toggle.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/admin-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ platform, enabled })
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleLogout();
        return;
      }
      throw new Error('Failed to update settings');
    }

    const data = await response.json();

    // Update status text
    if (statusEl) {
      statusEl.textContent = enabled ? 'Activo' : 'Inactivo';
      statusEl.className = `platform-status ${enabled ? 'enabled' : 'disabled'}`;
    }

    // Show save confirmation
    if (saveStatus) {
      saveStatus.classList.remove('hidden');
      setTimeout(() => saveStatus.classList.add('hidden'), 2000);
    }

    console.log(`Platform ${platform} ${enabled ? 'enabled' : 'disabled'}`);

  } catch (error) {
    console.error('Error toggling platform:', error);
    // Revert toggle on error
    if (toggle) toggle.checked = !enabled;
    alert('Error al actualizar la configuracion');
  } finally {
    if (toggle) toggle.disabled = false;
  }
}

// ==================== AUTO-REFRESH ====================

/**
 * Start auto-refresh timer
 */
function startAutoRefresh() {
  stopAutoRefresh(); // Clear any existing timer

  let countdown = 30;
  const countdownEl = document.getElementById('refresh-countdown');

  refreshTimer = setInterval(() => {
    countdown--;
    countdownEl.textContent = countdown;

    if (countdown <= 0) {
      countdown = 30;
      loadStats();
    }
  }, 1000);
}

/**
 * Stop auto-refresh timer
 */
function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// ==================== TABS ====================

/**
 * Switch tab
 */
function switchTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });

  // Load tab-specific data
  if (tabId === 'conversations') {
    loadConversations();
  } else if (tabId === 'settings') {
    loadSettings();
  } else if (tabId === 'approval') {
    initApprovalTab();
  }
}


// ==================== UTILITIES ====================

/**
 * Format number with separators
 */
function formatNumber(num) {
  return num?.toLocaleString('es-ES') || '0';
}

/**
 * Format date for chart labels
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

/**
 * Format datetime for table
 */
function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
  // Clear any stale sessions on fresh page load
  // and validate existing session with server
  if (hasSessionToken()) {
    console.log('Found existing session, validating...');
    const isValid = await validateSession();
    if (isValid) {
      console.log('Session valid, showing dashboard');
      showDashboard();
    } else {
      console.log('Session invalid, clearing and showing login');
      localStorage.removeItem(SESSION_KEY);
    }
  }

  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Search button
  document.getElementById('search-btn').addEventListener('click', () => {
    currentPage = 1;
    loadConversations();
  });

  // Pagination
  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadConversations();
    }
  });

  document.getElementById('next-page').addEventListener('click', () => {
    currentPage++;
    loadConversations();
  });

  // Chat form
  document.getElementById('chat-form').addEventListener('submit', handleChatSubmit);

  // Clear chat button
  document.getElementById('clear-chat').addEventListener('click', clearChat);

  // Enter key in search
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      currentPage = 1;
      loadConversations();
    }
  });
});

// ==================== MESSAGE APPROVAL ====================
const APPROVAL_API = "https://api.smart-cita.com/admin";
const APPROVAL_PASSWORD = "laserostop2024";
let approvalRefreshTimer = null;

async function loadApprovalSettings() {
  try {
    const res = await fetch(APPROVAL_API + "/settings", {
      headers: { "Authorization": "Bearer " + APPROVAL_PASSWORD }
    });
    const data = await res.json();
    const toggle = document.getElementById("toggle-manual-approval");
    const status = document.getElementById("manual-approval-status");
    if (toggle && status) {
      toggle.checked = data.manualApproval;
      status.textContent = data.manualApproval ? "Activo" : "Inactivo";
      status.className = "platform-status " + (data.manualApproval ? "enabled" : "disabled");
    }
  } catch (e) { console.error("Failed to load approval settings:", e); }
}

async function toggleManualApproval(enabled) {
  try {
    await fetch(APPROVAL_API + "/settings", {
      method: "POST",
      headers: { "Authorization": "Bearer " + APPROVAL_PASSWORD, "Content-Type": "application/json" },
      body: JSON.stringify({ manualApproval: enabled })
    });
    const status = document.getElementById("manual-approval-status");
    if (status) {
      status.textContent = enabled ? "Activo" : "Inactivo";
      status.className = "platform-status " + (enabled ? "enabled" : "disabled");
    }
    const saveStatus = document.getElementById("approval-save-status");
    if (saveStatus) { saveStatus.classList.remove("hidden"); setTimeout(function() { saveStatus.classList.add("hidden"); }, 2000); }
  } catch (e) { console.error("Failed to toggle:", e); }
}

async function loadPendingMessages() {
  try {
    const res = await fetch(APPROVAL_API + "/pending", { headers: { "Authorization": "Bearer " + APPROVAL_PASSWORD } });
    const data = await res.json();
    const countEl = document.getElementById("pending-count");
    if (countEl) countEl.textContent = data.count;
    renderPendingMessages(data.pending);
  } catch (e) { console.error("Failed to load pending:", e); }
}

function renderPendingMessages(messages) {
  const container = document.getElementById("pending-messages-container");
  if (!container) return;
  if (messages.length === 0) {
    container.innerHTML = "<div class=\"text-center py-12 text-gray-500\"><span class=\"material-icons text-6xl mb-4\" style=\"opacity:0.3\">inbox</span><h3 class=\"text-lg font-medium\">No hay mensajes pendientes</h3><p class=\"text-sm\">Los mensajes apareceran aqui cuando el modo de aprobacion manual este activo</p></div>";
    return;
  }
  container.innerHTML = messages.map(function(msg) {
    return "<div class=\"bg-white rounded-xl shadow-sm p-4 mb-4\" id=\"pending-" + msg.id + "\"><div class=\"flex items-center justify-between mb-3 pb-3 border-b\"><div class=\"flex items-center gap-3\"><span class=\"platform-badge " + msg.platform + "\">" + msg.platform + "</span><span class=\"text-gray-600\">" + msg.contactName + "</span></div><span class=\"text-gray-400 text-sm\">" + new Date(msg.createdAt).toLocaleString() + "</span></div><div class=\"mb-3\"><p class=\"text-xs text-gray-500 uppercase mb-1\">Mensaje del usuario</p><div class=\"bg-gray-100 rounded-lg p-3 text-gray-800\">" + escapeHtmlApproval(msg.userMessage) + "</div></div><div class=\"mb-4\"><p class=\"text-xs text-gray-500 uppercase mb-1\">Respuesta del bot (editable)</p><textarea id=\"response-" + msg.id + "\" class=\"w-full border border-gray-300 rounded-lg p-3 text-gray-800 min-h-[100px] focus:ring-2 focus:ring-teal-500\">" + escapeHtmlApproval(msg.botResponse) + "</textarea></div><div class=\"flex justify-end gap-3\"><button onclick=\"rejectMessage( + msg.id + )\" class=\"px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2\"><span class=\"material-icons text-sm\">close</span>Rechazar</button><button onclick=\"approveMessage( + msg.id + )\" class=\"px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2\"><span class=\"material-icons text-sm\">check</span>Aprobar y Enviar</button></div></div>";
  }).join("");
}

async function approveMessage(id) {
  var textarea = document.getElementById("response-" + id);
  var editedResponse = textarea ? textarea.value : null;
  try {
    await fetch(APPROVAL_API + "/approve/" + id, { method: "POST", headers: { "Authorization": "Bearer " + APPROVAL_PASSWORD, "Content-Type": "application/json" }, body: JSON.stringify({ editedResponse: editedResponse }) });
    var el = document.getElementById("pending-" + id);
    if (el) el.remove();
    var countEl = document.getElementById("pending-count");
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
    loadApprovalHistory();
  } catch (e) { alert("Error al aprobar"); }
}

async function rejectMessage(id) {
  if (!confirm("Rechazar este mensaje?")) return;
  try {
    await fetch(APPROVAL_API + "/reject/" + id, { method: "POST", headers: { "Authorization": "Bearer " + APPROVAL_PASSWORD } });
    var el = document.getElementById("pending-" + id);
    if (el) el.remove();
    var countEl = document.getElementById("pending-count");
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
    loadApprovalHistory();
  } catch (e) { alert("Error al rechazar"); }
}

async function loadApprovalHistory() {
  try {
    const res = await fetch(APPROVAL_API + "/history", { headers: { "Authorization": "Bearer " + APPROVAL_PASSWORD } });
    const data = await res.json();
    renderApprovalHistory(data.history);
  } catch (e) { console.error("Failed to load history:", e); }
}

function renderApprovalHistory(history) {
  const container = document.getElementById("approval-history-container");
  if (!container) return;
  if (history.length === 0) { container.innerHTML = "<div class=\"text-center py-8 text-gray-500\">No hay historial</div>"; return; }
  container.innerHTML = history.slice(0, 20).map(function(msg) {
    var statusClass = msg.status === "approved" ? "text-green-600" : "text-red-600";
    var statusText = msg.status === "approved" ? "APROBADO" : "RECHAZADO";
    return "<div class=\"bg-gray-50 rounded-lg p-3 mb-2\"><div class=\"flex items-center justify-between mb-2\"><div class=\"flex items-center gap-2\"><span class=\"platform-badge " + msg.platform + "\">" + msg.platform + "</span><span class=\"" + statusClass + " text-xs font-medium\">[" + statusText + "]</span></div><span class=\"text-gray-400 text-xs\">" + new Date(msg.createdAt).toLocaleString() + "</span></div><p class=\"text-sm text-gray-600 truncate\"><strong>Usuario:</strong> " + escapeHtmlApproval(msg.userMessage) + "</p></div>";
  }).join("");
}

function escapeHtmlApproval(text) { if (!text) return ""; var div = document.createElement("div"); div.textContent = text; return div.innerHTML; }

function initApprovalTab() { loadApprovalSettings(); loadPendingMessages(); loadApprovalHistory(); if (approvalRefreshTimer) clearInterval(approvalRefreshTimer); approvalRefreshTimer = setInterval(loadPendingMessages, 15000); }
