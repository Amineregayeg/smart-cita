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
 * Check if user is authenticated
 */
function isAuthenticated() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return false;

  try {
    const { token, expiresAt } = JSON.parse(session);
    if (new Date(expiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
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
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        token: data.token,
        expiresAt: data.expiresAt
      }));
      showDashboard();
    } else {
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

  // Initialize
  initCharts();
  loadStats();
  loadConversations();
  startAutoRefresh();
}

/**
 * Initialize Chart.js charts
 */
function initCharts() {
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
}

/**
 * Update charts with new data
 */
function updateCharts(stats) {
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

  // Add user message
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
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleLogout();
        return;
      }
      throw new Error('Chat request failed');
    }

    const data = await response.json();

    // Remove loading, add bot response
    document.getElementById(loadingId).remove();
    messagesContainer.innerHTML += `
      <div class="chat-bubble bot">
        ${escapeHtml(data.response)}
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
  document.getElementById('chat-messages').innerHTML = `
    <div class="chat-bubble bot">
      Hola! Soy el asistente virtual de LaserOstop Espana. Como puedo ayudarte?
    </div>
  `;
  document.getElementById('chat-stats').classList.add('hidden');
}

// ==================== AUTO-REFRESH ====================

/**
 * Start auto-refresh timer
 */
function startAutoRefresh() {
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

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  if (isAuthenticated()) {
    showDashboard();
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
