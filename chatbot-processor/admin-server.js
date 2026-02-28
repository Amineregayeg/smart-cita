/**
 * Admin API Server for LaserOstop Chatbot
 * Handles message approval panel and settings
 */
require("dotenv").config();
const http = require("http");
const { getRedisClient } = require("./lib/redis-client");
const WhatsAppAdapter = require("./lib/platform-adapters/whatsapp-adapter");
const MetaAdapter = require("./lib/platform-adapters/meta-adapter");

const PORT = process.env.ADMIN_PORT || 10002;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "20252025";

const SETTINGS_KEY = "chatbot:settings";
const PENDING_QUEUE = "chatbot:pending:approval";
const HISTORY_KEY = "chatbot:approval:history";

// España comment & phone keys
const ESPANA_PHONES_KEY = "chatbot:phones";
const ESPANA_PENDING_COMMENTS = "chatbot:pending:comments";
const ESPANA_COMMENTS_HISTORY = "chatbot:comments:history";

// Tunisia-specific Redis keys
const TUNIS_SETTINGS_KEY = "chatbot:tunis:settings";
const TUNIS_PENDING_QUEUE = "chatbot:tunis:pending:approval";
const TUNIS_HISTORY_KEY = "chatbot:tunis:approval:history";
const TUNIS_PHONES_KEY = "chatbot:tunis:phones";
const TUNIS_PENDING_COMMENTS = "chatbot:tunis:pending:comments";

const adapters = {
  whatsapp: new WhatsAppAdapter(),
  meta: new MetaAdapter(),
  messenger: new MetaAdapter(),
  instagram: new MetaAdapter()
};

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// Parse URL path and query
function parseUrl(url) {
  const [path, queryString] = (url || "/").split("?");
  const query = {};
  if (queryString) {
    queryString.split("&").forEach(pair => {
      const [k, v] = pair.split("=");
      query[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
  }
  return { path, query };
}

// Simple auth check
function checkAuth(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    return auth.slice(7) === ADMIN_PASSWORD;
  }
  return false;
}

// CORS headers
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// JSON response helper
function jsonResponse(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  const method = req.method || "GET";
  const { path, query } = parseUrl(req.url);

  // Handle preflight
  if (method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check (no auth)
  if (path === "/health" || path === "/") {
    return jsonResponse(res, 200, { status: "ok", service: "admin-server" });
  }

  // Auth check for all admin routes
  if (path.startsWith("/admin") && !checkAuth(req)) {
    return jsonResponse(res, 401, { error: "Unauthorized" });
  }

  try {
    const redis = await getRedisClient();
    if (!redis) {
      return jsonResponse(res, 500, { error: "Redis unavailable" });
    }

    // ===== GET /admin/settings =====
    if (path === "/admin/settings" && method === "GET") {
      const settings = await redis.get(SETTINGS_KEY);
      return jsonResponse(res, 200, settings ? JSON.parse(settings) : { manualApproval: false });
    }

    // ===== POST /admin/settings =====
    if (path === "/admin/settings" && method === "POST") {
      const body = await parseBody(req);
      const current = await redis.get(SETTINGS_KEY);
      const settings = current ? JSON.parse(current) : { manualApproval: false };

      if (typeof body.manualApproval === "boolean") {
        settings.manualApproval = body.manualApproval;
      }

      await redis.set(SETTINGS_KEY, JSON.stringify(settings));
      console.log("[ADMIN] Settings updated:", settings);
      return jsonResponse(res, 200, { success: true, settings });
    }

    // ===== GET /admin/pending =====
    if (path === "/admin/pending" && method === "GET") {
      const dmItems = await redis.lrange(PENDING_QUEUE, 0, -1);
      const commentItems = await redis.lrange(ESPANA_PENDING_COMMENTS, 0, -1);

      const dmPending = dmItems.map(item => {
        const p = JSON.parse(item);
        p.type = p.type || 'dm';
        return p;
      });
      const commentPending = commentItems.map(item => {
        const p = JSON.parse(item);
        return {
          ...p,
          type: 'comment_reply',
          platform: 'comment',
          contactName: p.commenterName || 'Comentarista',
          userMessage: p.commentText || '',
          userId: p.commenterUserId || p.commentId
        };
      });

      const pending = [...dmPending, ...commentPending].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return jsonResponse(res, 200, { pending, count: pending.length });
    }

    // ===== POST /admin/approve/:id =====
    if (path.startsWith("/admin/approve/") && method === "POST") {
      const id = path.split("/")[3];
      const body = await parseBody(req);
      const editedResponse = body.editedResponse;

      // Search in DM queue first, then comment queue
      let found = null;
      let foundRaw = null;
      let isComment = false;

      const dmItems = await redis.lrange(PENDING_QUEUE, 0, -1);
      for (let i = 0; i < dmItems.length; i++) {
        const item = JSON.parse(dmItems[i]);
        if (item.id === id) {
          found = item;
          foundRaw = dmItems[i];
          break;
        }
      }

      if (!found) {
        const commentItems = await redis.lrange(ESPANA_PENDING_COMMENTS, 0, -1);
        for (let i = 0; i < commentItems.length; i++) {
          const item = JSON.parse(commentItems[i]);
          if (item.id === id) {
            found = item;
            foundRaw = commentItems[i];
            isComment = true;
            break;
          }
        }
      }

      if (!found) {
        return jsonResponse(res, 404, { error: "Message not found" });
      }

      // Remove from appropriate queue
      if (isComment) {
        await redis.lrem(ESPANA_PENDING_COMMENTS, 1, foundRaw);
      } else {
        await redis.lrem(PENDING_QUEUE, 1, foundRaw);
      }

      // Send the response
      const responseToSend = editedResponse || found.botResponse;
      let sent = false;

      try {
        if (isComment) {
          const metaAdapter = adapters.meta;
          await metaAdapter.replyToComment(found.commentId, responseToSend, found.pageId);
          sent = true;
          console.log("[ADMIN] Approved comment reply:", id);
        } else {
          const adapter = adapters[found.platform];
          if (adapter) {
            await adapter.sendMessage(found.userId, responseToSend, found.originalMessage);
            sent = true;
            console.log("[ADMIN] Approved and sent message:", id);
          }
        }
      } catch (sendErr) {
        console.error("[ADMIN] Send failed (approved anyway):", sendErr.message);
      }

      // Log to history
      found.status = "approved";
      found.approvedAt = Date.now();
      found.finalResponse = responseToSend;
      found.wasEdited = !!editedResponse;
      const historyKey = isComment ? ESPANA_COMMENTS_HISTORY : HISTORY_KEY;
      await redis.lpush(historyKey, JSON.stringify(found));
      await redis.ltrim(historyKey, 0, 99);

      return jsonResponse(res, 200, { success: true, id, sent });
    }

    // ===== POST /admin/reject/:id =====
    if (path.startsWith("/admin/reject/") && method === "POST") {
      const id = path.split("/")[3];

      let found = null;
      let foundRaw = null;
      let isComment = false;

      const dmItems = await redis.lrange(PENDING_QUEUE, 0, -1);
      for (let i = 0; i < dmItems.length; i++) {
        const item = JSON.parse(dmItems[i]);
        if (item.id === id) { found = item; foundRaw = dmItems[i]; break; }
      }

      if (!found) {
        const commentItems = await redis.lrange(ESPANA_PENDING_COMMENTS, 0, -1);
        for (let i = 0; i < commentItems.length; i++) {
          const item = JSON.parse(commentItems[i]);
          if (item.id === id) { found = item; foundRaw = commentItems[i]; isComment = true; break; }
        }
      }

      if (!found) {
        return jsonResponse(res, 404, { error: "Message not found" });
      }

      await redis.lrem(isComment ? ESPANA_PENDING_COMMENTS : PENDING_QUEUE, 1, foundRaw);

      found.status = "rejected";
      found.rejectedAt = Date.now();
      const historyKey = isComment ? ESPANA_COMMENTS_HISTORY : HISTORY_KEY;
      await redis.lpush(historyKey, JSON.stringify(found));
      await redis.ltrim(historyKey, 0, 99);

      console.log("[ADMIN] Rejected:", id);
      return jsonResponse(res, 200, { success: true, id, rejected: true });
    }

    // ===== GET /admin/history =====
    if (path === "/admin/history" && method === "GET") {
      const dmItems = await redis.lrange(HISTORY_KEY, 0, -1);
      const commentItems = await redis.lrange(ESPANA_COMMENTS_HISTORY, 0, -1);

      const dmHistory = dmItems.map(item => { const p = JSON.parse(item); p.type = p.type || 'dm'; return p; });
      const commentHistory = commentItems.map(item => {
        const p = JSON.parse(item);
        return { ...p, type: 'comment_reply', platform: 'comment', contactName: p.commenterName || 'Comentarista', userMessage: p.commentText || '' };
      });

      const history = [...dmHistory, ...commentHistory].sort((a, b) => (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0));
      return jsonResponse(res, 200, { history, count: history.length });
    }

    // ===== GET /admin/logs =====
    if (path === "/admin/logs" && method === "GET") {
      const items = await redis.lrange("chatbot:logs:recent", 0, 99);
      const logs = items.map(item => JSON.parse(item));
      return jsonResponse(res, 200, { logs, count: logs.length });
    }

    // ===== GET /admin/stats =====
    if (path === "/admin/stats" && method === "GET") {
      const dmPendingCount = await redis.llen(PENDING_QUEUE);
      const commentPendingCount = await redis.llen(ESPANA_PENDING_COMMENTS);
      const phonesCount = await redis.llen(ESPANA_PHONES_KEY);
      const settings = await redis.get(SETTINGS_KEY);
      const parsedSettings = settings ? JSON.parse(settings) : { manualApproval: false };

      return jsonResponse(res, 200, {
        pendingCount: dmPendingCount + commentPendingCount,
        phonesCount,
        manualApproval: parsedSettings.manualApproval,
        timestamp: new Date().toISOString()
      });
    }

    // ===== GET /admin/phones =====
    if (path === "/admin/phones" && method === "GET") {
      const items = await redis.lrange(ESPANA_PHONES_KEY, 0, -1);
      const phones = items.map(item => JSON.parse(item));
      return jsonResponse(res, 200, { phones, count: phones.length });
    }

    // ===== POST /admin/phones/:id/status =====
    if (path.match(/^\/admin\/phones\/[^/]+\/status$/) && method === "POST") {
      const id = path.split("/")[3];
      const body = await parseBody(req);
      const newStatus = body.status;

      if (!newStatus) {
        return jsonResponse(res, 400, { error: "Missing status" });
      }

      const items = await redis.lrange(ESPANA_PHONES_KEY, 0, -1);
      for (let i = 0; i < items.length; i++) {
        const lead = JSON.parse(items[i]);
        if (lead.id === id) {
          lead.status = newStatus;
          lead.updatedAt = Date.now();
          await redis.lset(ESPANA_PHONES_KEY, i, JSON.stringify(lead));
          console.log(`[ADMIN] Phone ${id} status → ${newStatus}`);
          return jsonResponse(res, 200, { success: true, id, status: newStatus });
        }
      }

      return jsonResponse(res, 404, { error: "Phone lead not found" });
    }

    // ===== GET /admin/phones/export =====
    if (path === "/admin/phones/export" && method === "GET") {
      const items = await redis.lrange(ESPANA_PHONES_KEY, 0, -1);
      const phones = items.map(item => JSON.parse(item));

      const csvHeader = "ID,Phone,Name,Platform,Status,Date,Context\n";
      const csvRows = phones.map(p =>
        `"${p.id}","${p.phone}","${(p.customerName || '').replace(/"/g, '""')}","${p.platform}","${p.status}","${new Date(p.timestamp).toISOString()}","${(p.userMessage || '').replace(/"/g, '""').substring(0, 100)}"`
      ).join("\n");

      res.writeHead(200, {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=espana_phone_leads.csv",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(csvHeader + csvRows);
      return;
    }

    // ===== TUNISIA ENDPOINTS =====

    // ===== GET /admin/tunis/settings =====
    if (path === "/admin/tunis/settings" && method === "GET") {
      const settings = await redis.get(TUNIS_SETTINGS_KEY);
      return jsonResponse(res, 200, settings ? JSON.parse(settings) : { manualApproval: true });
    }

    // ===== POST /admin/tunis/settings =====
    if (path === "/admin/tunis/settings" && method === "POST") {
      const body = await parseBody(req);
      const current = await redis.get(TUNIS_SETTINGS_KEY);
      const settings = current ? JSON.parse(current) : { manualApproval: true };

      if (typeof body.manualApproval === "boolean") {
        settings.manualApproval = body.manualApproval;
      }

      await redis.set(TUNIS_SETTINGS_KEY, JSON.stringify(settings));
      console.log("[ADMIN-TUNIS] Settings updated:", settings);
      return jsonResponse(res, 200, { success: true, settings });
    }

    // ===== GET /admin/tunis/pending =====
    if (path === "/admin/tunis/pending" && method === "GET") {
      const dmItems = await redis.lrange(TUNIS_PENDING_QUEUE, 0, -1);
      const commentItems = await redis.lrange(TUNIS_PENDING_COMMENTS, 0, -1);

      const dmPending = dmItems.map(item => {
        const p = JSON.parse(item);
        p.type = p.type || 'dm';
        return p;
      });
      const commentPending = commentItems.map(item => {
        const p = JSON.parse(item);
        return {
          ...p,
          type: 'comment_reply',
          platform: 'comment',
          contactName: p.commenterName || 'Commentateur',
          userMessage: p.commentText || '',
          userId: p.commenterUserId || p.commentId
        };
      });

      const pending = [...dmPending, ...commentPending].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return jsonResponse(res, 200, { pending, count: pending.length });
    }

    // ===== POST /admin/tunis/approve/:id =====
    if (path.startsWith("/admin/tunis/approve/") && method === "POST") {
      const id = path.split("/")[4];
      const body = await parseBody(req);
      const editedResponse = body.editedResponse;

      let found = null;
      let foundRaw = null;
      let isComment = false;

      const dmItems = await redis.lrange(TUNIS_PENDING_QUEUE, 0, -1);
      for (let i = 0; i < dmItems.length; i++) {
        const item = JSON.parse(dmItems[i]);
        if (item.id === id) { found = item; foundRaw = dmItems[i]; break; }
      }

      if (!found) {
        const commentItems = await redis.lrange(TUNIS_PENDING_COMMENTS, 0, -1);
        for (let i = 0; i < commentItems.length; i++) {
          const item = JSON.parse(commentItems[i]);
          if (item.id === id) { found = item; foundRaw = commentItems[i]; isComment = true; break; }
        }
      }

      if (!found) {
        return jsonResponse(res, 404, { error: "Message not found" });
      }

      await redis.lrem(isComment ? TUNIS_PENDING_COMMENTS : TUNIS_PENDING_QUEUE, 1, foundRaw);

      const responseToSend = editedResponse || found.botResponse;
      let sent = false;

      try {
        if (isComment) {
          const metaAdapter = adapters.meta;
          await metaAdapter.replyToComment(found.commentId, responseToSend, found.pageId);
          sent = true;
          console.log("[ADMIN-TUNIS] Approved comment reply:", id);
        } else {
          const msgAdapter = adapters[found.platform];
          if (msgAdapter) {
            await msgAdapter.sendMessage(found.userId, responseToSend, found.originalMessage);
            sent = true;
            console.log("[ADMIN-TUNIS] Approved and sent:", id);
          }
        }
      } catch (sendErr) {
        console.error("[ADMIN-TUNIS] Send failed (approved anyway):", sendErr.message);
      }

      found.status = "approved";
      found.approvedAt = Date.now();
      found.finalResponse = responseToSend;
      found.wasEdited = !!editedResponse;
      await redis.lpush(TUNIS_HISTORY_KEY, JSON.stringify(found));
      await redis.ltrim(TUNIS_HISTORY_KEY, 0, 99);

      return jsonResponse(res, 200, { success: true, id, sent });
    }

    // ===== POST /admin/tunis/reject/:id =====
    if (path.startsWith("/admin/tunis/reject/") && method === "POST") {
      const id = path.split("/")[4];

      let found = null;
      let foundRaw = null;
      let isComment = false;

      const dmItems = await redis.lrange(TUNIS_PENDING_QUEUE, 0, -1);
      for (let i = 0; i < dmItems.length; i++) {
        const item = JSON.parse(dmItems[i]);
        if (item.id === id) { found = item; foundRaw = dmItems[i]; break; }
      }

      if (!found) {
        const commentItems = await redis.lrange(TUNIS_PENDING_COMMENTS, 0, -1);
        for (let i = 0; i < commentItems.length; i++) {
          const item = JSON.parse(commentItems[i]);
          if (item.id === id) { found = item; foundRaw = commentItems[i]; isComment = true; break; }
        }
      }

      if (!found) {
        return jsonResponse(res, 404, { error: "Message not found" });
      }

      await redis.lrem(isComment ? TUNIS_PENDING_COMMENTS : TUNIS_PENDING_QUEUE, 1, foundRaw);

      found.status = "rejected";
      found.rejectedAt = Date.now();
      await redis.lpush(TUNIS_HISTORY_KEY, JSON.stringify(found));
      await redis.ltrim(TUNIS_HISTORY_KEY, 0, 99);

      console.log("[ADMIN-TUNIS] Rejected:", id);
      return jsonResponse(res, 200, { success: true, id, rejected: true });
    }

    // ===== GET /admin/tunis/history =====
    if (path === "/admin/tunis/history" && method === "GET") {
      const items = await redis.lrange(TUNIS_HISTORY_KEY, 0, -1);
      const history = items.map(item => JSON.parse(item));
      return jsonResponse(res, 200, { history, count: history.length });
    }

    // ===== GET /admin/tunis/phones =====
    if (path === "/admin/tunis/phones" && method === "GET") {
      const items = await redis.lrange(TUNIS_PHONES_KEY, 0, -1);
      const phones = items.map(item => JSON.parse(item));
      return jsonResponse(res, 200, { phones, count: phones.length });
    }

    // ===== POST /admin/tunis/phones/:id/status =====
    if (path.match(/^\/admin\/tunis\/phones\/[^/]+\/status$/) && method === "POST") {
      const id = path.split("/")[4];
      const body = await parseBody(req);
      const newStatus = body.status;

      if (!newStatus) {
        return jsonResponse(res, 400, { error: "Missing status" });
      }

      const items = await redis.lrange(TUNIS_PHONES_KEY, 0, -1);
      for (let i = 0; i < items.length; i++) {
        const lead = JSON.parse(items[i]);
        if (lead.id === id) {
          lead.status = newStatus;
          lead.updatedAt = Date.now();
          await redis.lset(TUNIS_PHONES_KEY, i, JSON.stringify(lead));
          console.log(`[ADMIN-TUNIS] Phone ${id} status → ${newStatus}`);
          return jsonResponse(res, 200, { success: true, id, status: newStatus });
        }
      }

      return jsonResponse(res, 404, { error: "Phone lead not found" });
    }

    // ===== GET /admin/tunis/phones/export =====
    if (path === "/admin/tunis/phones/export" && method === "GET") {
      const items = await redis.lrange(TUNIS_PHONES_KEY, 0, -1);
      const phones = items.map(item => JSON.parse(item));

      // Generate CSV
      const csvHeader = "ID,Phone,Name,Platform,Status,Date,Context\n";
      const csvRows = phones.map(p =>
        `"${p.id}","${p.phone}","${(p.customerName || '').replace(/"/g, '""')}","${p.platform}","${p.status}","${new Date(p.timestamp).toISOString()}","${(p.userMessage || '').replace(/"/g, '""').substring(0, 100)}"`
      ).join("\n");

      res.writeHead(200, {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=tunis_phone_leads.csv",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(csvHeader + csvRows);
      return;
    }

    // ===== GET /admin/tunis/stats =====
    if (path === "/admin/tunis/stats" && method === "GET") {
      const dmPendingCount = await redis.llen(TUNIS_PENDING_QUEUE);
      const commentPendingCount = await redis.llen(TUNIS_PENDING_COMMENTS);
      const phonesCount = await redis.llen(TUNIS_PHONES_KEY);
      const settings = await redis.get(TUNIS_SETTINGS_KEY);
      const parsedSettings = settings ? JSON.parse(settings) : { manualApproval: true };

      return jsonResponse(res, 200, {
        pendingCount: dmPendingCount + commentPendingCount,
        phonesCount,
        manualApproval: parsedSettings.manualApproval,
        timestamp: new Date().toISOString()
      });
    }

    // ===== POST /admin/tunis/test-chat =====
    if (path === "/admin/tunis/test-chat" && method === "POST") {
      const body = await parseBody(req);
      const userMessage = body.message;

      if (!userMessage) {
        return jsonResponse(res, 400, { error: "Missing message" });
      }

      try {
        const { GPTHandlerTunis } = require("./lib/gpt-handler-tunis");
        const testHandler = new GPTHandlerTunis();
        const response = await testHandler.generateResponse(userMessage, body.history || []);
        const { detectPhoneNumber } = require("./lib/phone-collector");
        const phone = detectPhoneNumber(userMessage);

        return jsonResponse(res, 200, {
          response,
          phoneDetected: phone || null,
          tokens: testHandler.lastTokenCount || 0
        });
      } catch (err) {
        console.error("[ADMIN-TUNIS] Test chat error:", err.message);
        return jsonResponse(res, 500, { error: err.message });
      }
    }

    // ===== GET /admin/tunis/logs =====
    if (path === "/admin/tunis/logs" && method === "GET") {
      const items = await redis.lrange("chatbot:tunis:logs:recent", 0, 99);
      const logs = items.map(item => JSON.parse(item));
      return jsonResponse(res, 200, { logs, count: logs.length });
    }

    // ===== POST /admin/test-chat (España) =====
    if (path === "/admin/test-chat" && method === "POST") {
      const body = await parseBody(req);
      const userMessage = body.message;

      if (!userMessage) {
        return jsonResponse(res, 400, { error: "Missing message" });
      }

      try {
        const { GPTHandler } = require("./lib/gpt-handler");
        const testHandler = new GPTHandler();
        const startTime = Date.now();
        const response = await testHandler.generateResponse(userMessage, body.history || [], {}, "test");
        const elapsed = Date.now() - startTime;

        return jsonResponse(res, 200, {
          response,
          tokens: testHandler.lastTokenCount || 0,
          responseTime: elapsed
        });
      } catch (err) {
        console.error("[ADMIN] Test chat error:", err.message);
        return jsonResponse(res, 500, { error: err.message });
      }
    }

    // ===== GET /admin/platforms =====
    if (path === "/admin/platforms" && method === "GET") {
      const platforms = {};
      for (const p of ["whatsapp", "messenger", "instagram"]) {
        const val = await redis.get(`chatbot:config:platform:${p}:enabled`);
        platforms[p] = val === null ? true : (val === "true" || val === "1");
      }
      return jsonResponse(res, 200, { platforms });
    }

    // ===== POST /admin/platforms =====
    if (path === "/admin/platforms" && method === "POST") {
      const body = await parseBody(req);
      const { platform, enabled } = body;

      if (!platform || typeof enabled !== "boolean") {
        return jsonResponse(res, 400, { error: "Missing platform or enabled" });
      }

      const key = `chatbot:config:platform:${platform}:enabled`;
      await redis.set(key, enabled ? "true" : "false");
      console.log(`[ADMIN] Platform ${platform} ${enabled ? "enabled" : "disabled"}`);
      return jsonResponse(res, 200, { success: true, platform, enabled });
    }

    // Not found
    return jsonResponse(res, 404, { error: "Not found" });

  } catch (error) {
    console.error("[ADMIN] Error:", error.message);
    return jsonResponse(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log("[ADMIN] Server running on port", PORT);
  console.log("[ADMIN] Password:", ADMIN_PASSWORD);
});
