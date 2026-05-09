# Self-Hosting the Dashboard

This is a standard **Vite + React + TypeScript** SPA. You can host the built `dist/` folder on any static host. The backend (database + edge functions) keeps running on Lovable Cloud — you don't have to move it.

> Want to also move the backend off Lovable Cloud? See the note at the bottom.

---

## 1. Get the code

In Lovable: top-right **GitHub → Connect to GitHub → Create repository**. Then on your machine:

```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>
npm install   # or: bun install
```

Create a `.env` file (these are safe-to-publish keys):

```env
VITE_SUPABASE_URL=https://yznpjqswsamvztijdvrr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bnBqcXN3c2Ftdnp0aWpkdnJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTE0MzAsImV4cCI6MjA5MzQ4NzQzMH0.QzFrM3_yEKsMdn3_oIihQSJXb83-fS8f8V_87X9jdtE
VITE_SUPABASE_PROJECT_ID=yznpjqswsamvztijdvrr
```

Build:

```bash
npm run build
# output: dist/
```

Test locally:

```bash
npm run preview   # http://localhost:4173
```

---

## 2. Best free hosting options (ranked)

| # | Host | Free tier | SPA routing | Best for |
|---|---|---|---|---|
| 1 | **Vercel** | Generous, no sleep | Auto | Easiest, 1-click GitHub deploy |
| 2 | **Netlify** | 100 GB/mo bandwidth | Auto (with `_redirects`) | Same as Vercel |
| 3 | **Cloudflare Pages** | Unlimited bandwidth | Auto | Fastest CDN, no limits |
| 4 | **GitHub Pages** | Free | Manual SPA hack needed | If repo is public |
| 5 | **Your own VPS / PC** | Free | nginx config | Full control |

---

### Option A — Vercel (recommended)

1. <https://vercel.com> → **Add New → Project** → import your GitHub repo
2. Framework preset: **Vite** (auto-detected)
3. Build command: `npm run build` · Output dir: `dist`
4. **Environment Variables** → add the three `VITE_*` vars from above
5. **Deploy**

SPA routing works out of the box. Custom domain: **Settings → Domains**.

---

### Option B — Netlify

Same as Vercel. Add this file so deep links don't 404:

```
# public/_redirects
/*  /index.html  200
```

---

### Option C — Cloudflare Pages

1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git**
2. Build command: `npm run build` · Output dir: `dist`
3. Env vars: add the three `VITE_*` vars
4. Add `public/_redirects` (same one-liner as Netlify) for SPA fallback

---

### Option D — Your own VPS / Raspberry Pi (nginx)

```bash
npm run build
scp -r dist/* user@server:/var/www/dashboard/
```

`/etc/nginx/sites-available/dashboard`:

```nginx
server {
  listen 80;
  server_name dashboard.example.com;
  root /var/www/dashboard;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;   # SPA fallback
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d dashboard.example.com   # free HTTPS
```

---

### Option E — Docker (anywhere)

`Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf`:

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  location / { try_files $uri /index.html; }
}
```

```bash
docker build -t wa-dashboard .
docker run -p 8080:80 wa-dashboard
```

---

## 3. After deploying

1. Open your new URL (e.g. `https://wa-dash.vercel.app`)
2. Go to **Connection** → paste your bot server URL + `BOT_API_TOKEN`
3. Done. Backend (DB + edge functions) is still on Lovable Cloud — no migration needed.

---

## 4. CORS heads-up

If your bot server has `CORS_ORIGIN` set to a specific URL, **update it** to match your new dashboard domain (or set `*` while testing). Edit the bot server `.env` and restart.

---

## 5. (Optional) Move the backend off Lovable Cloud too

The backend lives in `supabase/` (migrations + edge functions). To self-host:

1. Spin up a self-hosted Supabase: <https://supabase.com/docs/guides/self-hosting/docker>
2. `supabase link --project-ref <new-ref>` then `supabase db push` to apply migrations
3. `supabase functions deploy wa-proxy wa-webhook ai-test`
4. Update your `.env` `VITE_SUPABASE_*` vars to point at the new instance
5. Rebuild + redeploy the dashboard

This is a much bigger lift than just hosting the frontend — only do it if you actually need to.
