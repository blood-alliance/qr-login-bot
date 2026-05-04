
# WhatsApp Bot with QR Login

Two deliverables: (1) a **Lovable dashboard web app** for QR login, chats, broadcasts, and AI replies, and (2) a **standalone Node.js bot server** using `whatsapp-web.js` that you deploy yourself (Railway, Render, VPS, Raspberry Pi, etc.). The dashboard talks to the bot server over HTTPS + WebSocket.

## Why two pieces

`whatsapp-web.js` runs a headless Chromium (Puppeteer) and needs a long-lived process to keep the WhatsApp session alive. Lovable Cloud edge functions are short-lived and can't run Chromium, so the bot itself must live on your own host. Lovable handles the UI, auth, AI, and persistence.

## Architecture

```text
 ┌────────────────────┐    HTTPS / WebSocket    ┌──────────────────────────┐
 │  Lovable Dashboard │ ──────────────────────▶ │  Node.js Bot Server      │
 │  (React + Cloud)   │ ◀────────────────────── │  whatsapp-web.js +       │
 │                    │                         │  Puppeteer (you host)    │
 └─────────┬──────────┘                         └────────────┬─────────────┘
           │                                                 │
           ▼                                                 ▼
   Lovable Cloud DB                                  WhatsApp Web (QR)
   (chats, contacts,                                 LocalAuth session
    broadcasts, rules,                               persisted on disk
    AI config)
```

## Deliverable 1 — Bot server (you deploy)

A separate folder `whatsapp-bot-server/` generated for you to download and deploy. Includes:

- `whatsapp-web.js` client with `LocalAuth` so the QR scan only happens once
- Express REST API + Socket.IO for realtime QR + message events
- Shared-secret bearer token auth (`BOT_API_TOKEN`) so only your dashboard can call it
- Endpoints:
  - `GET /status` — connected / qr / disconnected
  - `GET /qr` — current QR string (also pushed via socket `qr` event)
  - `POST /logout` — destroy session
  - `GET /chats`, `GET /chats/:id/messages`
  - `POST /send` `{ to, body }` — send message / broadcast
  - `POST /webhook-config` — set dashboard webhook URL for inbound messages
- On every inbound message: POST to a Lovable Cloud edge function webhook so the dashboard records it and triggers auto-reply / AI logic
- `Dockerfile` + `README` with one-click deploy instructions for Railway and Render, plus VPS/PM2 instructions

## Deliverable 2 — Lovable dashboard

### Pages
- **Login** — email/password (Lovable Cloud auth)
- **Connection** — shows live QR code (rendered from string via `qrcode` lib), connection status, "Logout / re-pair" button. Also a settings panel for **Bot Server URL** + **API token** (stored per-user in DB, token encrypted via edge function)
- **Chats** — list of conversations from the bot, click to view message history, send a reply
- **Broadcasts** — pick contacts or paste numbers, compose message, schedule/send now, see delivery log
- **Auto-reply rules** — list of `{ trigger keyword/regex, response, enabled }` rows
- **AI Assistant** — toggle "AI replies on", system prompt textarea, model picker (Lovable AI: Gemini 3 Flash default, Gemini 2.5 Pro, GPT-5 etc.), per-contact opt-in/out
- **Activity log** — incoming/outgoing message stream

### Lovable Cloud schema
- `bot_settings` — server URL, encrypted token, AI enabled, system prompt, model
- `contacts` — wa_id, name, ai_enabled
- `messages` — wa_id, direction, body, timestamp, ack
- `auto_replies` — trigger, response, match_type, enabled
- `broadcasts` — body, sent_at, recipient_count
- `broadcast_recipients` — broadcast_id, wa_id, status
All tables protected with RLS scoped to the owning user; `user_roles` table + `has_role()` for an admin role.

### Edge functions
- `wa-webhook` — public endpoint the bot server posts to on inbound messages. Stores message, runs auto-reply rule match, and if AI enabled calls Lovable AI Gateway then POSTs reply back to bot server's `/send`
- `wa-proxy` — authenticated proxy the dashboard uses to call the bot server (keeps the bot token server-side)
- `ai-test` — lets the AI page test a prompt before saving

### AI replies
- Default model: `google/gemini-3-flash-preview` via Lovable AI Gateway
- Full conversation history per contact sent as context
- System prompt customizable from the dashboard
- Handles 429 / 402 with friendly toasts

## User flow

1. Sign up in dashboard → deploy the generated bot server (README walks through Railway in ~3 min) → paste server URL + token into Connection page
2. Dashboard opens socket → bot emits QR → user scans with phone → status flips to **Connected**
3. Inbound WhatsApp messages flow: phone → bot → `wa-webhook` → DB + optional AI reply → bot → recipient
4. User can browse chats, send broadcasts, edit rules, toggle AI any time

## Out of scope / caveats

- WhatsApp does not officially support `whatsapp-web.js`; sessions can be banned for spammy use. README will warn.
- Media (images/voice) — text-only in v1; can add later
- Multi-device per user — one WhatsApp account per dashboard user in v1

## What I'll need from you after approval

- Confirm where you'll host the bot server (just affects which README section to feature)
- Nothing else upfront — Lovable Cloud + Lovable AI auto-provision; you'll paste the bot URL + token after deploying the server
