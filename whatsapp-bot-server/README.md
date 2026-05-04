# WhatsApp Bot Server

Companion Node.js server for the Lovable dashboard. Runs `whatsapp-web.js` (Puppeteer + Chromium) and exposes a small REST + Socket.IO API protected by a bearer token.

> ⚠️ `whatsapp-web.js` is **not** an official WhatsApp API. Sessions can be banned for spammy behavior. Use responsibly.

---

## 1. Quick start (local)

```bash
cd whatsapp-bot-server
cp .env.example .env
# edit .env and set BOT_API_TOKEN to a long random string
npm install
npm start
```

Then open the Lovable dashboard → **Connection** → paste:
- **Server URL:** `http://localhost:3001` (or your tunneled URL)
- **API token:** the same `BOT_API_TOKEN`

Scan the QR code with WhatsApp on your phone (Settings → Linked Devices).

To expose localhost to your dashboard during testing, use [ngrok](https://ngrok.com) or [cloudflared](https://github.com/cloudflare/cloudflared):

```bash
ngrok http 3001
```

---

## 2. Deploy to Railway

1. Push this `whatsapp-bot-server/` folder to its own GitHub repo (or the same one).
2. https://railway.app → **New Project → Deploy from GitHub** → pick the repo.
3. Railway auto-detects the Dockerfile.
4. **Variables** tab → set:
   - `BOT_API_TOKEN` = long random string
   - `CORS_ORIGIN` = your Lovable preview/published URL (or `*` while testing)
5. **Settings → Networking → Generate Domain** to get a public HTTPS URL.
6. Paste that URL + token into the dashboard.
7. **Important:** add a **Volume** mounted at `/app/.wwebjs_auth` so the WhatsApp session survives redeploys.

## 3. Deploy to Render

1. New → **Web Service** → connect repo → root = `whatsapp-bot-server`.
2. Environment = **Docker**.
3. Add env vars (`BOT_API_TOKEN`, `CORS_ORIGIN`).
4. Add a **Disk** mounted at `/app/.wwebjs_auth` (1 GB is plenty).

## 4. Deploy on a VPS (Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser
git clone <your repo> && cd whatsapp-bot-server
cp .env.example .env && nano .env
npm install
sudo npm install -g pm2
pm2 start src/index.js --name wa-bot
pm2 save && pm2 startup
```

If Chromium lives elsewhere, set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` in `.env`.

---

## 5. API reference

All routes (except `/health`) require `Authorization: Bearer $BOT_API_TOKEN`.

| Method | Path | Description |
| --- | --- | --- |
| GET  | `/health` | Public health check |
| GET  | `/status` | `{ status, info, hasQr }` |
| GET  | `/qr` | Current QR string + data URL (404 if already paired) |
| POST | `/logout` | Destroy session, force re-pair |
| POST | `/send` | `{ to, body }` — `to` is digits or `xxx@c.us` |
| GET  | `/chats` | Up to 100 most recent chats |
| GET  | `/chats/:id/messages?limit=50` | Recent messages of a chat |
| POST | `/webhook-config` | `{ url, secret }` — set inbound webhook |

Socket.IO events (auth via `socket.io({ auth: { token } })`):
- `status` — `{ status, info? }`
- `qr` — `{ qr, dataUrl }`
- `message` — inbound `{ wa_id, body, wa_message_id, timestamp, type }`
- `ack` — delivery `{ wa_message_id, ack }`

## 6. Inbound message webhook

When a `WEBHOOK_URL` is configured (env var or `POST /webhook-config`), every inbound message is forwarded:

```
POST $WEBHOOK_URL
Content-Type: application/json
x-bot-secret: $WEBHOOK_SECRET

{ "wa_id": "1234@c.us", "body": "hi", "wa_message_id": "...", "timestamp": 1700000000, "type": "chat" }
```

Point this at the Lovable Cloud edge function `wa-webhook` (URL shown in the dashboard's **Connection** page) so messages are stored, auto-replies fire, and AI replies are generated and sent back through `POST /send`.
