# Hosting Guide — WhatsApp Bot Server

`whatsapp-web.js` runs a real Chromium browser (via Puppeteer) and must keep a long-lived session. That rules out serverless platforms (Vercel, Netlify, Cloudflare Workers, Supabase Edge Functions). You need a host that gives you:

- A long-running Node.js process (no cold-start sleep ideally)
- ~512 MB RAM minimum (Chromium is hungry)
- Persistent disk for `.wwebjs_auth/` so you don't re-scan the QR every restart
- Outbound internet (for WhatsApp Web)

---

## TL;DR — Best free options (ranked)

| # | Host | Free tier | Sleeps? | Persistent disk | Verdict |
|---|---|---|---|---|---|
| 1 | **Your own PC / Raspberry Pi** | Free forever | No | Yes | **Best**. Zero limits, full control |
| 2 | **Fly.io** | 3 shared-cpu-1x VMs, 3 GB volume | No (with `auto_stop=off`) | Yes (volumes) | Best cloud free tier for this |
| 3 | **Oracle Cloud Always Free** | 2 AMD VMs or 4 ARM cores / 24 GB | No | Yes | Most powerful free, harder signup |
| 4 | **Render** | 750 hr/mo web service | **Yes, after 15 min** | Paid only ($1/mo disk) | OK for testing only — session dies on sleep |
| 5 | **Railway** | $5 trial credit, then paid | No | Yes | Easiest deploy, but not truly free |
| 6 | **Koyeb** | 1 nano service | No | No persistent disk on free | QR re-scan every restart |

> **Recommendation:** Run it on a spare laptop / Raspberry Pi if you have one. Otherwise use **Fly.io** — it's the only free cloud tier that gives persistent volumes + always-on.

---

## Option 1 — Your own machine (recommended, 100% free)

### Windows / macOS / Linux

```bash
cd whatsapp-bot-server
cp .env.example .env
# edit .env -> set BOT_API_TOKEN to a long random string
npm install
npm start
```

To expose `http://localhost:3001` to your Lovable dashboard on the internet, use **Cloudflare Tunnel** (free, no account needed for quick tunnels):

```bash
# install once
# macOS:   brew install cloudflared
# Windows: winget install --id Cloudflare.cloudflared
# Linux:   see https://github.com/cloudflare/cloudflared/releases

cloudflared tunnel --url http://localhost:3001
```

It prints a URL like `https://random-words-1234.trycloudflare.com`. Paste that as **Server URL** in the dashboard.

Keep it running with **PM2** so it survives reboots:

```bash
npm i -g pm2
pm2 start src/index.js --name wa-bot
pm2 save
pm2 startup     # follow the printed command
```

### Raspberry Pi (3B+ or newer)

Same as Linux above, but install Chromium first:

```bash
sudo apt-get update && sudo apt-get install -y chromium-browser
echo "PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser" >> .env
```

---

## Option 2 — Fly.io (best free cloud)

Fly gives you 3 small VMs and 3 GB persistent volumes free, and they don't sleep.

### One-time setup

1. Install flyctl: <https://fly.io/docs/hands-on/install-flyctl/>
2. `fly auth signup` (credit card required for verification, but won't be charged on free tier)

### Deploy

```bash
cd whatsapp-bot-server
fly launch --no-deploy --name my-wa-bot --region fra
# answer "No" to Postgres / Redis / deploy now
fly volumes create wa_data --size 1 --region fra
fly secrets set BOT_API_TOKEN=$(openssl rand -hex 32) CORS_ORIGIN='*'
```

Open the generated `fly.toml` and add:

```toml
[mounts]
  source = "wa_data"
  destination = "/app/.wwebjs_auth"

[[services]]
  internal_port = 3001
  protocol = "tcp"
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
```

Make sure `[[services.ports]]` has `port = 443` with `handlers = ["tls", "http"]`.

Then:

```bash
fly deploy
fly status   # grab the *.fly.dev URL
```

Use `https://my-wa-bot.fly.dev` as **Server URL** in the dashboard.

---

## Option 3 — Oracle Cloud Always Free (most powerful)

Oracle's "Always Free" tier gives you a VM that runs forever. Setup is heavier (account verification can be strict) but the result is essentially a free VPS.

1. Sign up: <https://www.oracle.com/cloud/free/>
2. Create an **Ampere A1 ARM** VM (Ubuntu 22.04, 1 OCPU / 6 GB RAM is plenty)
3. Open port 3001 (or 443 if you put nginx in front) in the VCN security list
4. SSH in and follow the **Raspberry Pi** instructions above
5. Use `https://your-domain` (recommended, via Caddy/nginx + Let's Encrypt) or `http://<public-ip>:3001`

---

## Option 4 — Render (easy but sleeps)

Free Render web services **sleep after 15 min of inactivity**, which logs out WhatsApp and forces a QR re-scan. Fine for kicking the tires, not for production.

1. Push `whatsapp-bot-server/` to GitHub
2. Render → **New → Web Service** → connect repo → root dir = `whatsapp-bot-server`
3. Environment: **Docker**
4. Add env vars: `BOT_API_TOKEN`, `CORS_ORIGIN`
5. (Paid only) Add a **Disk** mounted at `/app/.wwebjs_auth` — without this every wake = new QR

---

## Option 5 — Railway (easiest, ~$5/mo after trial)

1. Push repo to GitHub
2. <https://railway.app> → **New → Deploy from GitHub** → pick the repo
3. Variables: `BOT_API_TOKEN`, `CORS_ORIGIN`
4. **Settings → Networking → Generate Domain**
5. Add **Volume** mounted at `/app/.wwebjs_auth`

---

## After deploying — connect to the dashboard

1. Open the dashboard → **Connection** page
2. Paste:
   - **Bot Server URL** = your public URL (e.g. `https://my-wa-bot.fly.dev`)
   - **API Token** = the `BOT_API_TOKEN` you set
3. Click **Save & Connect**
4. A QR code appears — open WhatsApp on your phone → **Settings → Linked Devices → Link a Device** → scan
5. Status flips to **Connected**. Done.

---

## Troubleshooting

- **QR never appears** → check server logs; usually a missing Chromium. On VPS set `PUPPETEER_EXECUTABLE_PATH`.
- **Session keeps logging out** → no persistent disk mounted at `.wwebjs_auth`. Add a volume.
- **401 from dashboard** → `BOT_API_TOKEN` mismatch.
- **CORS error** → set `CORS_ORIGIN` to your dashboard URL (or `*` while testing).
- **High memory / OOM** → Chromium needs ≥512 MB. Resize the instance.

---

## Cost summary

| Setup | Monthly cost |
|---|---|
| Own PC / Pi + Cloudflare Tunnel | **$0** |
| Fly.io free tier | **$0** |
| Oracle Always Free | **$0** |
| Render free (with re-scan) | **$0** |
| Render + 1 GB disk | ~$1 |
| Railway after trial | ~$5 |
