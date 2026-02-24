/**
 * LaserOstop Admin Dashboard JavaScript
 * Connects to VPS API at api.smart-cita.com/admin
 */

// Configuration
const API_BASE = 'https://api.smart-cita.com/admin';
const REFRESH_INTERVAL = 30000;
const SESSION_KEY = 'laserostop_admin_session';

// State
let currentPage = 1;
let allLogs = [];
let refreshTimer = null;
let charts = {};
let chartsInitialized = false;
let chatHistory = [];
let approvalRefreshTimer = null;

// ==================== AUTHENTICATION ====================

function getToken() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    return session.token || null;
  } catch { return null; }
}

function hasSessionToken() {
  return !!getToken();
}

function authHeaders() {
  return { 'Authorization': 'Bearer ' + getToken() };
}

async function handleLogin(event) {
  event.preventDefault();

  const password = document.getElementById('password-input').value;
  const loginBtn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<div class="spinner mx-auto"></div>';
  errorEl.classList.add('hidden');

  try {
    // Validate password by calling /stats with it as Bearer token
    const res = await fetch(API_BASE + '/stats', {
      headers: { 'Authorization': 'Bearer ' + password }
    });

    if (res.ok) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ token: password }));
      showDashboard();
    } else {
      errorEl.textContent = 'Contrasena incorrecta';
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

function handleLogout() {
  localStorage.removeItem(SESSION_KEY);
  stopAutoRefresh();
  if (approvalRefreshTimer) { clearInterval(approvalRefreshTimer); approvalRefreshTimer = null; }
  destroyCharts();
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('password-input').value = '';
}

// ==================== DASHBOARD ====================

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');

  destroyCharts();
  initCharts();
  loadStats();
  startAutoRefresh();
}

function destroyCharts() {
  if (charts.messages) { charts.messages.destroy(); charts.messages = null; }
  if (charts.platform) { charts.platform.destroy(); charts.platform = null; }
  if (charts.tokens) { charts.tokens.destroy(); charts.tokens = null; }
  chartsInitialized = false;
}

function initCharts() {
  if (chartsInitialized) return;

  charts.messages = new Chart(document.getElementById('messages-chart').getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Mensajes', data: [], borderColor: '#22A9AF', backgroundColor: 'rgba(34, 169, 175, 0.1)', fill: true, tension: 0.4 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  charts.platform = new Chart(document.getElementById('platform-chart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['WhatsApp', 'Messenger', 'Instagram'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#25D366', '#0084FF', '#E4405F'] }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  charts.tokens = new Chart(document.getElementById('tokens-chart').getContext('2d'), {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Tokens', data: [], backgroundColor: '#8B5CF6' }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  chartsInitialized = true;
}

// ==================== STATS / ANALYTICS ====================

async function loadStats() {
  try {
    const res = await fetch(API_BASE + '/logs', { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401) { handleLogout(); return; }
      throw new Error('Failed to load logs');
    }
    const data = await res.json();
    allLogs = data.logs || [];
    computeAndDisplayStats(allLogs);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function computeAndDisplayStats(logs) {
  const today = new Date().toISOString().slice(0, 10);

  // Today's stats
  const todayLogs = logs.filter(l => (l.timestamp || '').slice(0, 10) === today);
  const messagesToday = todayLogs.length;
  const messagesTotal = logs.length;
  const tokensToday = todayLogs.reduce((s, l) => s + (l.tokens || 0), 0);
  const costToday = tokensToday * 0.000002;
  const avgResponseTime = todayLogs.length > 0
    ? Math.round(todayLogs.reduce((s, l) => s + (l.responseTime || 0), 0) / todayLogs.length)
    : 0;

  document.getElementById('messages-today').textContent = formatNumber(messagesToday);
  document.getElementById('messages-total').textContent = formatNumber(messagesTotal);
  document.getElementById('tokens-today').textContent = formatNumber(tokensToday);
  document.getElementById('cost-today').textContent = '$' + costToday.toFixed(2);
  document.getElementById('avg-response-time').textContent = formatNumber(avgResponseTime);
  document.getElementById('bookings-today').textContent = '-';
  document.getElementById('bookings-total').textContent = 'Total: -';

  // Daily messages (last 7 days)
  const dailyMap = {};
  const dailyTokenMap = {};
  const platformCount = { whatsapp: 0, messenger: 0, instagram: 0 };

  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = 0;
    dailyTokenMap[key] = 0;
  }

  logs.forEach(l => {
    const day = (l.timestamp || '').slice(0, 10);
    if (dailyMap.hasOwnProperty(day)) { dailyMap[day]++; }
    if (dailyTokenMap.hasOwnProperty(day)) { dailyTokenMap[day] += (l.tokens || 0); }
    const p = (l.platform || '').toLowerCase();
    if (platformCount.hasOwnProperty(p)) platformCount[p]++;
  });

  // Update charts
  if (charts.messages) {
    charts.messages.data.labels = Object.keys(dailyMap).map(formatDateLabel);
    charts.messages.data.datasets[0].data = Object.values(dailyMap);
    charts.messages.update();
  }
  if (charts.platform) {
    charts.platform.data.datasets[0].data = [platformCount.whatsapp, platformCount.messenger, platformCount.instagram];
    charts.platform.update();
  }
  if (charts.tokens) {
    charts.tokens.data.labels = Object.keys(dailyTokenMap).map(formatDateLabel);
    charts.tokens.data.datasets[0].data = Object.values(dailyTokenMap);
    charts.tokens.update();
  }
}

// ==================== CONVERSATIONS ====================

async function loadConversations() {
  const tableBody = document.getElementById('logs-table-body');
  tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500"><div class="spinner mx-auto mb-2"></div>Cargando conversaciones...</td></tr>';

  try {
    // Use cached logs if available, otherwise fetch
    if (allLogs.length === 0) {
      const res = await fetch(API_BASE + '/logs', { headers: authHeaders() });
      if (!res.ok) {
        if (res.status === 401) { handleLogout(); return; }
        throw new Error('Failed');
      }
      const data = await res.json();
      allLogs = data.logs || [];
    }

    displayConversations(allLogs);
  } catch (error) {
    console.error('Error loading conversations:', error);
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-red-500">Error al cargar conversaciones</td></tr>';
  }
}

function displayConversations(logs) {
  const search = (document.getElementById('search-input').value || '').toLowerCase();
  const platformFilter = document.getElementById('platform-filter').value;

  // Filter
  let filtered = logs;
  if (search) {
    filtered = filtered.filter(l =>
      (l.userMessage || '').toLowerCase().includes(search) ||
      (l.botResponse || '').toLowerCase().includes(search)
    );
  }
  if (platformFilter) {
    filtered = filtered.filter(l => (l.platform || '').toLowerCase() === platformFilter);
  }

  const total = filtered.length;
  const perPage = 20;
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (currentPage > pages) currentPage = pages;
  const start = (currentPage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  const tableBody = document.getElementById('logs-table-body');

  if (pageItems.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">No hay conversaciones</td></tr>';
  } else {
    tableBody.innerHTML = pageItems.map(function(conv) {
      return '<tr>' +
        '<td class="whitespace-nowrap">' + formatDateTime(conv.timestamp) + '</td>' +
        '<td><span class="platform-badge ' + (conv.platform || '') + '">' + (conv.platform || '-') + '</span></td>' +
        '<td class="font-mono text-sm">...' + (conv.userId || '-') + '</td>' +
        '<td class="max-w-xs truncate" title="' + escapeAttr(conv.userMessage) + '">' + escapeHtml(conv.userMessage || '') + '</td>' +
        '<td class="max-w-xs truncate" title="' + escapeAttr(conv.botResponse) + '">' + escapeHtml((conv.botResponse || '').substring(0, 100)) + '</td>' +
        '<td>' + (conv.tokens || 0) + '</td>' +
        '<td>' + (conv.responseTime || 0) + 'ms</td>' +
        '</tr>';
    }).join('');
  }

  document.getElementById('pagination-info').textContent = 'Mostrando ' + pageItems.length + ' de ' + total;
  document.getElementById('prev-page').disabled = currentPage <= 1;
  document.getElementById('next-page').disabled = currentPage >= pages;
}

// ==================== CHAT TESTER ====================

async function handleChatSubmit(event) {
  event.preventDefault();

  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  const messagesContainer = document.getElementById('chat-messages');
  const statsEl = document.getElementById('chat-stats');

  chatHistory.push({ role: 'user', content: message });

  messagesContainer.innerHTML += '<div class="chat-bubble user">' + escapeHtml(message) + '</div>';
  input.value = '';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const loadingId = 'loading-' + Date.now();
  messagesContainer.innerHTML += '<div id="' + loadingId + '" class="chat-bubble bot"><div class="spinner"></div></div>';
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const res = await fetch(API_BASE + '/test-chat', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message, history: chatHistory.slice(-8) })
    });

    if (!res.ok) {
      if (res.status === 401) { handleLogout(); return; }
      throw new Error('Chat request failed');
    }

    const data = await res.json();
    chatHistory.push({ role: 'assistant', content: data.response });

    var el = document.getElementById(loadingId);
    if (el) el.remove();

    messagesContainer.innerHTML += '<div class="chat-bubble bot">' +
      escapeHtml(data.response).replace(/\n/g, '<br>') +
      '<div class="chat-meta">' + (data.tokens || 0) + ' tokens | ' + (data.responseTime || 0) + 'ms</div></div>';

    statsEl.classList.remove('hidden');
    document.getElementById('stat-tokens').textContent = data.tokens || 0;
    document.getElementById('stat-time').textContent = (data.responseTime || 0) + 'ms';

  } catch (error) {
    console.error('Chat error:', error);
    var el2 = document.getElementById(loadingId);
    if (el2) el2.remove();
    messagesContainer.innerHTML += '<div class="chat-bubble bot text-red-500">Error al procesar el mensaje</div>';
  }

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function clearChat() {
  chatHistory = [];
  document.getElementById('chat-messages').innerHTML = '<div class="chat-bubble bot">Hola! Soy el asistente virtual de LaserOstop Espana. Como puedo ayudarte?</div>';
  document.getElementById('chat-stats').classList.add('hidden');
}

// ==================== APPROVAL ====================

async function loadApprovalSettings() {
  try {
    const res = await fetch(API_BASE + '/settings', { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const toggle = document.getElementById('toggle-manual-approval');
    const status = document.getElementById('manual-approval-status');
    if (toggle && status) {
      toggle.checked = data.manualApproval;
      status.textContent = data.manualApproval ? 'Activo' : 'Inactivo';
      status.className = 'platform-status ' + (data.manualApproval ? 'enabled' : 'disabled');
    }
  } catch (e) { console.error('Failed to load approval settings:', e); }
}

async function toggleManualApproval(enabled) {
  const toggle = document.getElementById('toggle-manual-approval');
  try {
    const res = await fetch(API_BASE + '/settings', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualApproval: enabled })
    });
    if (!res.ok) throw new Error('Save failed');

    // Confirm
    const check = await fetch(API_BASE + '/settings', { headers: authHeaders() });
    const data = await check.json();
    if (data.manualApproval !== enabled) throw new Error('Mismatch');

    const status = document.getElementById('manual-approval-status');
    if (status) {
      status.textContent = enabled ? 'Activo' : 'Inactivo';
      status.className = 'platform-status ' + (enabled ? 'enabled' : 'disabled');
    }
    showSaveStatus('approval-save-status');
  } catch (e) {
    console.error('Failed to toggle:', e);
    if (toggle) toggle.checked = !enabled;
    alert('Error al guardar la configuracion');
  }
}

async function loadPendingMessages() {
  try {
    const res = await fetch(API_BASE + '/pending', { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('pending-count').textContent = data.count;
    renderPendingMessages(data.pending);
  } catch (e) { console.error('Failed to load pending:', e); }
}

function renderPendingMessages(messages) {
  const container = document.getElementById('pending-messages-container');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = '<div class="text-center py-12 text-gray-500">' +
      '<span class="material-icons text-6xl mb-4" style="opacity:0.3">inbox</span>' +
      '<h3 class="text-lg font-medium">No hay mensajes pendientes</h3>' +
      '<p class="text-sm">Los mensajes apareceran aqui cuando el modo de aprobacion manual este activo</p></div>';
    return;
  }

  container.innerHTML = messages.map(function(msg) {
    var badges = '';
    if (msg.wasTranscribed) badges += '<span style="background:#8b5cf6;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px;">🎤 Voice</span>';
    if (msg.attachmentType === 'image') badges += '<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px;">📷 Image</span>';
    if (msg.phoneDetected) badges += '<span style="background:#22c55e;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;margin-right:4px;">📞 ' + escapeHtml(msg.phoneDetected) + '</span>';

    return '<div class="bg-white rounded-xl shadow-sm p-4 mb-4" id="pending-' + msg.id + '">' +
      '<div class="flex items-center justify-between mb-3 pb-3 border-b">' +
        '<div class="flex items-center gap-3">' +
          '<span class="platform-badge ' + msg.platform + '">' + msg.platform + '</span>' +
          badges +
          '<span class="text-gray-600">' + escapeHtml(msg.contactName || '') + '</span>' +
        '</div>' +
        '<span class="text-gray-400 text-sm">' + new Date(msg.createdAt).toLocaleString() + '</span>' +
      '</div>' +
      '<div class="mb-3">' +
        '<p class="text-xs text-gray-500 uppercase mb-1">Mensaje del usuario</p>' +
        '<div class="bg-gray-100 rounded-lg p-3 text-gray-800">' + escapeHtml(msg.userMessage || '') + '</div>' +
      '</div>' +
      '<div class="mb-4">' +
        '<p class="text-xs text-gray-500 uppercase mb-1">Respuesta del bot (editable)</p>' +
        '<textarea id="response-' + msg.id + '" class="w-full border border-gray-300 rounded-lg p-3 text-gray-800 min-h-[100px] focus:ring-2 focus:ring-teal-500">' + escapeHtml(msg.botResponse || '') + '</textarea>' +
      '</div>' +
      '<div class="flex justify-end gap-3">' +
        '<button onclick="rejectMessage(\'' + msg.id + '\')" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2">' +
          '<span class="material-icons text-sm">close</span>Rechazar</button>' +
        '<button onclick="approveMessage(\'' + msg.id + '\')" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2">' +
          '<span class="material-icons text-sm">check</span>Aprobar y Enviar</button>' +
      '</div></div>';
  }).join('');
}

async function approveMessage(id) {
  var textarea = document.getElementById('response-' + id);
  var editedResponse = textarea ? textarea.value : null;
  try {
    const res = await fetch(API_BASE + '/approve/' + id, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ editedResponse: editedResponse })
    });
    if (!res.ok) throw new Error('Approve failed');
    var el = document.getElementById('pending-' + id);
    if (el) el.remove();
    var countEl = document.getElementById('pending-count');
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
    loadApprovalHistory();
  } catch (e) { alert('Error al aprobar: ' + e.message); }
}

async function rejectMessage(id) {
  if (!confirm('Rechazar este mensaje?')) return;
  try {
    const res = await fetch(API_BASE + '/reject/' + id, {
      method: 'POST',
      headers: authHeaders()
    });
    if (!res.ok) throw new Error('Reject failed');
    var el = document.getElementById('pending-' + id);
    if (el) el.remove();
    var countEl = document.getElementById('pending-count');
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
    loadApprovalHistory();
  } catch (e) { alert('Error al rechazar: ' + e.message); }
}

async function loadApprovalHistory() {
  try {
    const res = await fetch(API_BASE + '/history', { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    renderApprovalHistory(data.history);
  } catch (e) { console.error('Failed to load history:', e); }
}

function renderApprovalHistory(history) {
  const container = document.getElementById('approval-history-container');
  if (!container) return;
  if (history.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-gray-500">No hay historial</div>';
    return;
  }
  container.innerHTML = history.slice(0, 20).map(function(msg) {
    var statusClass = msg.status === 'approved' ? 'text-green-600' : 'text-red-600';
    var statusText = msg.status === 'approved' ? 'APROBADO' : 'RECHAZADO';
    return '<div class="bg-gray-50 rounded-lg p-3 mb-2">' +
      '<div class="flex items-center justify-between mb-2">' +
        '<div class="flex items-center gap-2">' +
          '<span class="platform-badge ' + msg.platform + '">' + msg.platform + '</span>' +
          '<span class="' + statusClass + ' text-xs font-medium">[' + statusText + ']</span>' +
        '</div>' +
        '<span class="text-gray-400 text-xs">' + new Date(msg.createdAt).toLocaleString() + '</span>' +
      '</div>' +
      '<p class="text-sm text-gray-600 truncate"><strong>Usuario:</strong> ' + escapeHtml(msg.userMessage || '') + '</p>' +
      '</div>';
  }).join('');
}

function initApprovalTab() {
  loadApprovalSettings();
  loadPendingMessages();
  loadApprovalHistory();
  if (approvalRefreshTimer) clearInterval(approvalRefreshTimer);
  approvalRefreshTimer = setInterval(loadPendingMessages, 15000);
}

// ==================== SETTINGS (PLATFORM TOGGLES) ====================

async function loadSettings() {
  try {
    const res = await fetch(API_BASE + '/platforms', { headers: authHeaders() });
    if (!res.ok) {
      if (res.status === 401) { handleLogout(); return; }
      throw new Error('Failed to load settings');
    }
    const data = await res.json();
    updateSettingsDisplay(data.platforms);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

function updateSettingsDisplay(platforms) {
  ['whatsapp', 'messenger', 'instagram'].forEach(function(p) {
    var toggle = document.getElementById('toggle-' + p);
    var status = document.getElementById(p + '-status');
    if (toggle && status) {
      toggle.checked = platforms[p];
      status.textContent = platforms[p] ? 'Activo' : 'Inactivo';
      status.className = 'platform-status ' + (platforms[p] ? 'enabled' : 'disabled');
    }
  });
}

async function togglePlatform(platform, enabled) {
  var toggle = document.getElementById('toggle-' + platform);
  var statusEl = document.getElementById(platform + '-status');
  if (toggle) toggle.disabled = true;

  try {
    const res = await fetch(API_BASE + '/platforms', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: platform, enabled: enabled })
    });
    if (!res.ok) {
      if (res.status === 401) { handleLogout(); return; }
      throw new Error('Failed');
    }

    if (statusEl) {
      statusEl.textContent = enabled ? 'Activo' : 'Inactivo';
      statusEl.className = 'platform-status ' + (enabled ? 'enabled' : 'disabled');
    }
    showSaveStatus('settings-save-status');
  } catch (error) {
    console.error('Error toggling platform:', error);
    if (toggle) toggle.checked = !enabled;
    alert('Error al actualizar la configuracion');
  } finally {
    if (toggle) toggle.disabled = false;
  }
}

// ==================== AUTO-REFRESH ====================

function startAutoRefresh() {
  stopAutoRefresh();
  var countdown = 30;
  var countdownEl = document.getElementById('refresh-countdown');

  refreshTimer = setInterval(function() {
    countdown--;
    if (countdownEl) countdownEl.textContent = countdown;
    if (countdown <= 0) {
      countdown = 30;
      loadStats();
    }
  }, 1000);
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

// ==================== TABS ====================

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(function(content) {
    content.classList.toggle('active', content.id === 'tab-' + tabId);
  });

  if (tabId === 'conversations') loadConversations();
  else if (tabId === 'settings') loadSettings();
  else if (tabId === 'approval') initApprovalTab();
}

// ==================== UTILITIES ====================

function formatNumber(num) {
  return (num || 0).toLocaleString('es-ES');
}

function formatDateLabel(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  var d = new Date(dateStr);
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return escapeHtml(text || '').replace(/"/g, '&quot;');
}

function showSaveStatus(id) {
  var el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    setTimeout(function() { el.classList.add('hidden'); }, 2000);
  }
}

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async function() {
  // Check existing session
  if (hasSessionToken()) {
    try {
      const res = await fetch(API_BASE + '/stats', { headers: authHeaders() });
      if (res.ok) {
        showDashboard();
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  // Login form
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
  });

  // Search
  document.getElementById('search-btn').addEventListener('click', function() {
    currentPage = 1;
    displayConversations(allLogs);
  });
  document.getElementById('search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') { currentPage = 1; displayConversations(allLogs); }
  });

  // Pagination
  document.getElementById('prev-page').addEventListener('click', function() {
    if (currentPage > 1) { currentPage--; displayConversations(allLogs); }
  });
  document.getElementById('next-page').addEventListener('click', function() {
    currentPage++;
    displayConversations(allLogs);
  });

  // Chat
  document.getElementById('chat-form').addEventListener('submit', handleChatSubmit);
  document.getElementById('clear-chat').addEventListener('click', clearChat);
});
