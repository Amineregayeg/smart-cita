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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "laserostop2024";

const SETTINGS_KEY = "chatbot:settings";
const PENDING_QUEUE = "chatbot:pending:approval";
const HISTORY_KEY = "chatbot:approval:history";

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
      const items = await redis.lrange(PENDING_QUEUE, 0, -1);
      const pending = items.map(item => JSON.parse(item)).reverse();
      return jsonResponse(res, 200, { pending, count: pending.length });
    }

    // ===== POST /admin/approve/:id =====
    if (path.startsWith("/admin/approve/") && method === "POST") {
      const id = path.split("/")[3];
      const body = await parseBody(req);
      const editedResponse = body.editedResponse;

      // Find and remove from pending queue
      const items = await redis.lrange(PENDING_QUEUE, 0, -1);
      let found = null;
      let foundIndex = -1;

      for (let i = 0; i < items.length; i++) {
        const item = JSON.parse(items[i]);
        if (item.id === id) {
          found = item;
          foundIndex = i;
          break;
        }
      }

      if (!found) {
        return jsonResponse(res, 404, { error: "Message not found" });
      }

      // Remove from queue
      await redis.lrem(PENDING_QUEUE, 1, items[foundIndex]);

      // Send the message (use edited response if provided)
      const responseToSend = editedResponse || found.botResponse;
      const adapter = adapters[found.platform];

      if (adapter) {
        await adapter.sendMessage(found.userId, responseToSend, found.originalMessage);
        console.log("[ADMIN] Approved and sent message:", id);
      }

      // Log to history
      found.status = "approved";
      found.approvedAt = Date.now();
      found.finalResponse = responseToSend;
      found.wasEdited = !!editedResponse;
      await redis.lpush(HISTORY_KEY, JSON.stringify(found));
      await redis.ltrim(HISTORY_KEY, 0, 99); // Keep last 100

      return jsonResponse(res, 200, { success: true, id, sent: true });
    }

    // ===== POST /admin/reject/:id =====
    if (path.startsWith("/admin/reject/") && method === "POST") {
      const id = path.split("/")[3];

      const items = await redis.lrange(PENDING_QUEUE, 0, -1);
      let found = null;
      let foundIndex = -1;

      for (let i = 0; i < items.length; i++) {
        const item = JSON.parse(items[i]);
        if (item.id === id) {
          found = item;
          foundIndex = i;
          break;
        }
      }

      if (!found) {
        return jsonResponse(res, 404, { error: "Message not found" });
      }

      await redis.lrem(PENDING_QUEUE, 1, items[foundIndex]);

      // Log to history
      found.status = "rejected";
      found.rejectedAt = Date.now();
      await redis.lpush(HISTORY_KEY, JSON.stringify(found));
      await redis.ltrim(HISTORY_KEY, 0, 99);

      console.log("[ADMIN] Rejected message:", id);
      return jsonResponse(res, 200, { success: true, id, rejected: true });
    }

    // ===== GET /admin/history =====
    if (path === "/admin/history" && method === "GET") {
      const items = await redis.lrange(HISTORY_KEY, 0, -1);
      const history = items.map(item => JSON.parse(item));
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
      const pendingCount = await redis.llen(PENDING_QUEUE);
      const settings = await redis.get(SETTINGS_KEY);
      const parsedSettings = settings ? JSON.parse(settings) : { manualApproval: false };

      return jsonResponse(res, 200, {
        pendingCount,
        manualApproval: parsedSettings.manualApproval,
        timestamp: new Date().toISOString()
      });
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
