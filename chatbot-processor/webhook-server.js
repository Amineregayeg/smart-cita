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

// España center page/IG IDs
const ESPANA_PAGES = new Set([
  "961642687025824",   // LaserOstop - Centros antitabaco (Facebook)
  "755909964271820",   // LaserOstop Valencia (Facebook)
  "753892517805817",   // LaserOstop Sevilla (Facebook)
  "692019233999955",   // LaserOstop Barcelona Sants (Facebook)
  "17841478706257146", // LaserOstop - Centros antitabaco (Instagram)
  "17841478547583918", // LaserOstop Valencia (Instagram)
  "17841476737014491", // LaserOstop Sevilla (Instagram)
  "17841477108011572"  // LaserOstop Barcelona Sants (Instagram)
]);

// Tunisia center page/IG IDs
const TUNIS_PAGES = new Set([
  "683497724836566",  // LaserOstop Tunis Lac 1 (Facebook)
  "17841474028143993", // LaserOstop Tunis Lac 1 (Instagram)
  "907630839110873"   // LaserOstop Sfax (Facebook)
]);

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
        if (event.message && event.message.is_echo) continue;
        if (event.message && (event.message.text || event.message.attachments)) {
          const attachments = event.message.attachments || [];
          const audioAttachment = attachments.find(a => a.type === "audio");
          messages.push({
            id: event.message.mid,
            from: event.sender.id,
            timestamp: Math.floor(event.timestamp / 1000),
            text: event.message.text || null,
            attachments: attachments.map(a => ({
              type: a.type,
              url: a.payload?.url,
              stickerId: a.payload?.sticker_id
            })),
            hasAudio: !!audioAttachment,
            audioUrl: audioAttachment?.payload?.url || null,
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
        if (event.message && event.message.is_echo) continue;
        if (event.message && (event.message.text || event.message.attachments)) {
          const attachments = event.message.attachments || [];
          const audioAttachment = attachments.find(a => a.type === "audio");
          messages.push({
            id: event.message.mid,
            from: event.sender.id,
            timestamp: Math.floor(event.timestamp / 1000),
            text: event.message.text || null,
            attachments: attachments.map(a => ({
              type: a.type,
              url: a.payload?.url,
              stickerId: a.payload?.sticker_id
            })),
            hasAudio: !!audioAttachment,
            audioUrl: audioAttachment?.payload?.url || null,
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
 * Extract comments from feed webhook events (Facebook/Instagram)
 * Feed events come via object:"page" with entry.changes[].field:"feed"
 */
function extractFeedComments(body) {
  const comments = [];
  try {
    for (const entry of (body.entry || [])) {
      const pageId = entry.id;
      for (const change of (entry.changes || [])) {
        if (change.field !== "feed") continue;
        const value = change.value || {};
        // Only process comments (not reactions, shares, etc.)
        if (value.item !== "comment") continue;
        // Only process new comments (verb: "add")
        if (value.verb !== "add") continue;
        // Skip if no message text
        if (!value.message) continue;

        comments.push({
          commentId: value.comment_id,
          postId: value.post_id,
          parentId: value.parent_id,
          pageId: pageId,
          commenterName: value.from?.name || "Unknown",
          commenterUserId: value.from?.id || null,
          commentText: value.message,
          verb: value.verb,
          createdTime: value.created_time
        });
      }
    }
  } catch (e) {
    console.error("[WEBHOOK] Feed comment extract error:", e.message);
  }
  return comments;
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

        // Extract DM messages (Messenger, Instagram, WhatsApp)
        const messages = extractMessages(payload);

        // Extract feed comments (Facebook page comments)
        const comments = (payload.object === "page") ? extractFeedComments(payload) : [];

        console.log("[WEBHOOK] Extracted messages:", messages.length, "comments:", comments.length);

        if (messages.length === 0 && comments.length === 0) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", messages: 0, comments: 0 }));
          return;
        }

        let queued = 0;
        let commentsQueued = 0;
        const redis = await getRedisClient();
        if (redis) {
          // Queue DM messages
          for (const msg of messages) {
            const sourceId = msg.pageId || msg.igId || null;

            // Determine which queue to use based on source page
            let queueName = null;
            if (sourceId && TUNIS_PAGES.has(sourceId)) {
              queueName = "chatbot:tunis:messages:queue";
            } else if (!sourceId || ESPANA_PAGES.has(sourceId)) {
              queueName = "chatbot:messages:queue";
            } else {
              console.log(`[WEBHOOK] Skipping message from unknown page: ${sourceId}`);
              continue;
            }

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
            await redis.lpush(queueName, JSON.stringify({
              platform: msg.platform,
              message: msg,
              receivedAt: Date.now()
            }));
            queued++;
            const region = queueName.includes("tunis") ? "TUNIS" : "ESPAÑA";
            console.log(`[WEBHOOK] Queued ${msg.platform} message from ${msg.from} → ${region}`);
          }

          // Queue comments for auto-reply
          for (const comment of comments) {
            const pageId = comment.pageId;

            // Determine region
            let region = null;
            if (TUNIS_PAGES.has(pageId)) {
              region = "tunis";
            } else if (ESPANA_PAGES.has(pageId)) {
              region = "espana";
            } else {
              console.log(`[WEBHOOK] Skipping comment from unknown page: ${pageId}`);
              continue;
            }

            // Dedup comments
            const commentKey = "chatbot:comment:seen:" + comment.commentId;
            const exists = await redis.get(commentKey);
            if (exists) {
              console.log("[WEBHOOK] Comment already seen");
              continue;
            }
            await redis.setex(commentKey, 86400, "1");

            // Queue to the appropriate comment queue
            const commentQueue = region === "tunis"
              ? "chatbot:tunis:comments:queue"
              : "chatbot:comments:queue";

            await redis.lpush(commentQueue, JSON.stringify({
              comment: comment,
              region: region,
              receivedAt: Date.now()
            }));
            commentsQueued++;
            console.log(`[WEBHOOK] Queued comment from ${comment.commenterName} on ${pageId} → ${region.toUpperCase()}`);
          }
        }

        console.log("[WEBHOOK] Queued", queued, "messages +", commentsQueued, "comments");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", received: messages.length, queued, comments: comments.length, commentsQueued }));
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
