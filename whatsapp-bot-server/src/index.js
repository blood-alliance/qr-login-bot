/* eslint-disable no-console */
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const fetch = require("node-fetch");
const QRCode = require("qrcode");
const { Server: SocketServer } = require("socket.io");
const { Client, LocalAuth } = require("whatsapp-web.js");

const PORT = process.env.PORT || 3001;
const BOT_API_TOKEN = process.env.BOT_API_TOKEN;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim());

if (!BOT_API_TOKEN) {
  console.error("FATAL: BOT_API_TOKEN env var is required.");
  process.exit(1);
}

let WEBHOOK_URL = process.env.WEBHOOK_URL || "";
let WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

const state = {
  status: "starting", // starting | qr | authenticated | ready | disconnected
  qr: null,
  qrDataUrl: null,
  info: null,
};

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: CORS_ORIGIN } });

// Auth middleware (REST)
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (token !== BOT_API_TOKEN) return res.status(401).json({ error: "unauthorized" });
  next();
}

// Auth middleware (Socket.IO)
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token !== BOT_API_TOKEN) return next(new Error("unauthorized"));
  next();
});

io.on("connection", (socket) => {
  socket.emit("status", { status: state.status, info: state.info });
  if (state.qrDataUrl) socket.emit("qr", { qr: state.qr, dataUrl: state.qrDataUrl });
});

// ---- whatsapp-web.js client ----
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
});

client.on("qr", async (qr) => {
  state.status = "qr";
  state.qr = qr;
  try {
    state.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
  } catch (e) {
    state.qrDataUrl = null;
  }
  io.emit("qr", { qr, dataUrl: state.qrDataUrl });
  io.emit("status", { status: state.status });
  console.log("[wa] QR received");
});

client.on("authenticated", () => {
  state.status = "authenticated";
  state.qr = null;
  state.qrDataUrl = null;
  io.emit("status", { status: state.status });
  console.log("[wa] authenticated");
});

client.on("auth_failure", (m) => {
  console.error("[wa] auth_failure", m);
  state.status = "disconnected";
  io.emit("status", { status: state.status, error: m });
});

client.on("ready", () => {
  state.status = "ready";
  state.info = client.info ? { wid: client.info.wid?._serialized, pushname: client.info.pushname } : null;
  io.emit("status", { status: state.status, info: state.info });
  console.log("[wa] ready as", state.info?.pushname);
});

client.on("disconnected", (reason) => {
  console.warn("[wa] disconnected", reason);
  state.status = "disconnected";
  state.info = null;
  io.emit("status", { status: state.status, reason });
});

client.on("message", async (msg) => {
  if (msg.fromMe) return;
  const payload = {
    wa_id: msg.from,
    body: msg.body || "",
    wa_message_id: msg.id?._serialized,
    timestamp: msg.timestamp,
    type: msg.type,
  };
  io.emit("message", payload);
  if (WEBHOOK_URL) {
    try {
      await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bot-secret": WEBHOOK_SECRET,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("[webhook] failed", e.message);
    }
  }
});

client.on("message_ack", (msg, ack) => {
  io.emit("ack", { wa_message_id: msg.id?._serialized, ack });
});

client.initialize().catch((e) => {
  console.error("[wa] initialize error", e);
  state.status = "disconnected";
});

// ---- REST API ----
app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/status", auth, (_req, res) => {
  res.json({ status: state.status, info: state.info, hasQr: !!state.qr });
});

app.get("/qr", auth, (_req, res) => {
  if (!state.qr) return res.status(404).json({ error: "no_qr" });
  res.json({ qr: state.qr, dataUrl: state.qrDataUrl });
});

app.post("/webhook-config", auth, (req, res) => {
  const { url, secret } = req.body || {};
  if (typeof url === "string") WEBHOOK_URL = url;
  if (typeof secret === "string") WEBHOOK_SECRET = secret;
  res.json({ ok: true, url: WEBHOOK_URL });
});

app.post("/logout", auth, async (_req, res) => {
  try {
    await client.logout();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/send", auth, async (req, res) => {
  try {
    const { to, body } = req.body || {};
    if (!to || !body) return res.status(400).json({ error: "to and body required" });
    if (state.status !== "ready") return res.status(409).json({ error: "not_ready", status: state.status });

    // Normalize: accept "1234567890" or "1234567890@c.us"
    const chatId = String(to).includes("@") ? to : `${String(to).replace(/\D/g, "")}@c.us`;
    const sent = await client.sendMessage(chatId, body);
    res.json({ ok: true, id: sent.id?._serialized });
  } catch (e) {
    console.error("[send]", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/chats", auth, async (_req, res) => {
  try {
    if (state.status !== "ready") return res.status(409).json({ error: "not_ready" });
    const chats = await client.getChats();
    res.json(
      chats.slice(0, 100).map((c) => ({
        id: c.id?._serialized,
        name: c.name,
        isGroup: c.isGroup,
        unreadCount: c.unreadCount,
        timestamp: c.timestamp,
        lastMessage: c.lastMessage?.body || null,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/chats/:id/messages", auth, async (req, res) => {
  try {
    if (state.status !== "ready") return res.status(409).json({ error: "not_ready" });
    const chat = await client.getChatById(req.params.id);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const messages = await chat.fetchMessages({ limit });
    res.json(
      messages.map((m) => ({
        id: m.id?._serialized,
        body: m.body,
        fromMe: m.fromMe,
        timestamp: m.timestamp,
        type: m.type,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`whatsapp-bot-server listening on :${PORT}`);
});
