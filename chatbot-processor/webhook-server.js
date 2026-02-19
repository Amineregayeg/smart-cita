/**
 * Meta Webhook Server for LaserOstop
 * Handles WhatsApp, Facebook Messenger, and Instagram messages
 */
require("dotenv").config();
const http = require("http");
const crypto = require("crypto");
const { getRedisClient } = require("./lib/redis-client");

const PORT = process.env.WEBHOOK_PORT || 10001;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "laserostop_verify_2024";

function parseQuery(url) {
  const params = {};
  const queryStart = url.indexOf("?");
  if (queryStart === -1) return params;
  const query = url.slice(queryStart + 1);
  query.split("&").forEach(pair => {
    const [key, value] = pair.split("=");
    params[decodeURIComponent(key)] = decodeURIComponent(value || "");
  });
  return params;
}

function verifySignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const provided = signature.replace("sha256=", "");
    return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch (e) {
    return false;
  }
}

/**
 * Extract WhatsApp messages
 */
function extractWhatsAppMessages(body) {
  const messages = [];
  try {
    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== "messages") continue;
        const value = change.value || {};
        for (const msg of (value.messages || [])) {
          if (msg.type === "text") {
            const contact = (value.contacts || []).find(c => c.wa_id === msg.from) || {};
            messages.push({
              id: msg.id,
              from: msg.from,
              timestamp: parseInt(msg.timestamp),
              text: msg.text?.body || "",
              contactName: contact.profile?.name || "Unknown",
              phoneNumberId: value.metadata?.phone_number_id,
              platform: "whatsapp"
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("[WEBHOOK] WhatsApp extract error:", e.message);
  }
  return messages;
}

/**
 * Extract Facebook Messenger messages
 */
function extractMessengerMessages(body) {
  const messages = [];
  try {
    for (const entry of (body.entry || [])) {
      const pageId = entry.id;
      for (const event of (entry.messaging || [])) {
        if (event.message && event.message.text) {
          messages.push({
            id: event.message.mid,
            from: event.sender.id,
            timestamp: Math.floor(event.timestamp / 1000),
            text: event.message.text,
            contactName: "Messenger User",
            pageId: pageId,
            platform: "messenger"
          });
        }
      }
    }
  } catch (e) {
    console.error("[WEBHOOK] Messenger extract error:", e.message);
  }
  return messages;
}

/**
 * Extract Instagram messages
 */
function extractInstagramMessages(body) {
  const messages = [];
  try {
    for (const entry of (body.entry || [])) {
      const igId = entry.id;
      for (const event of (entry.messaging || [])) {
        if (event.message && event.message.text) {
          messages.push({
            id: event.message.mid,
            from: event.sender.id,
            timestamp: Math.floor(event.timestamp / 1000),
            text: event.message.text,
            contactName: "Instagram User",
            igId: igId,
            platform: "instagram"
          });
        }
      }
    }
  } catch (e) {
    console.error("[WEBHOOK] Instagram extract error:", e.message);
  }
  return messages;
}

/**
 * Extract messages based on webhook type
 */
function extractMessages(body) {
  const objectType = body.object;
  
  if (objectType === "whatsapp_business_account") {
    return extractWhatsAppMessages(body);
  } else if (objectType === "page") {
    return extractMessengerMessages(body);
  } else if (objectType === "instagram") {
    return extractInstagramMessages(body);
  }
  
  console.log("[WEBHOOK] Unknown object type:", objectType);
  return [];
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";
  const method = req.method || "GET";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Hub-Signature-256");

  if (url === "/health" || url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "webhook-server" }));
    return;
  }

  if (!url.startsWith("/webhook")) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  if (method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (method === "GET") {
    const params = parseQuery(url);
    const mode = params["hub.mode"];
    const token = params["hub.verify_token"];
    const challenge = params["hub.challenge"];

    console.log("[WEBHOOK] Verification request - mode:", mode, "token match:", token === VERIFY_TOKEN);

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[WEBHOOK] Verification SUCCESS - returning challenge");
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(challenge);
      return;
    }

    console.error("[WEBHOOK] Verification FAILED");
    res.writeHead(403);
    res.end("Verification failed");
    return;
  }

  if (method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        console.log("[WEBHOOK] POST received");

        const signature = req.headers["x-hub-signature-256"];
        const secret = process.env.META_APP_SECRET;

        if (secret && signature) {
          if (!verifySignature(body, signature, secret)) {
            console.error("[WEBHOOK] Invalid signature");
            res.writeHead(401);
            res.end("Invalid signature");
            return;
          }
        }

        const payload = JSON.parse(body);
        console.log("[WEBHOOK] Object type:", payload.object);
        console.log("[WEBHOOK] Payload:", JSON.stringify(payload).substring(0, 300));

        const messages = extractMessages(payload);
        console.log("[WEBHOOK] Extracted messages:", messages.length);

        if (messages.length === 0) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", messages: 0 }));
          return;
        }

        let queued = 0;
        const redis = await getRedisClient();
        if (redis) {
          for (const msg of messages) {
            const age = Date.now() - (msg.timestamp * 1000);
            if (age > 300000) {
              console.log("[WEBHOOK] Message too old, skipping");
              continue;
            }

            const key = "chatbot:processed:" + msg.id;
            const exists = await redis.get(key);
            if (exists) {
              console.log("[WEBHOOK] Message already processed");
              continue;
            }

            await redis.setex(key, 86400, "1");
            await redis.lpush("chatbot:messages:queue", JSON.stringify({
              platform: msg.platform,
              message: msg,
              receivedAt: Date.now()
            }));
            queued++;
            console.log("[WEBHOOK] Queued", msg.platform, "message from:", msg.from);
          }
        }

        console.log("[WEBHOOK] Queued", queued, "messages");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", received: messages.length, queued }));
      } catch (e) {
        console.error("[WEBHOOK] Error:", e.message);
        res.writeHead(200);
        res.end(JSON.stringify({ status: "error" }));
      }
    });
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log("[WEBHOOK] Server running on port", PORT);
  console.log("[WEBHOOK] Verify token:", VERIFY_TOKEN);
  console.log("[WEBHOOK] Supports: WhatsApp, Messenger, Instagram");
});
