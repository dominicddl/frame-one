# Frame One Deploy Guide

## Architecture Options

### Option 1: Single Host (Recommended for Demo)
- **Match server serves both API + Web** (one URL, no CORS, no dual tunnels)
- Fly.io / Render / Docker container runs match server which serves the web build

### Option 2: Split Hosts
- **Web** (Vercel): Static Vite build with `/api` rewrites to match server
- **Match** (Fly.io / Render): API server only

---

## Local Development (Same-Origin Proxy)

Vite dev server proxies `/api/*` to match server automatically:

```bash
# Terminal 1: Start match server
cd packages/match && npm run dev

# Terminal 2: Start web dev server
cd packages/web && npm run dev
```

Open `http://localhost:5173` — all `/api/*` calls proxy to `localhost:3001`.

For custom match URL (e.g., remote server):
```bash
MATCH_URL=https://my-match-server.fly.dev npm run dev
```

---

## Single-Host Deploy (Fly.io / Render)

The match server automatically serves the web build if `packages/web/dist` exists.

### Fly.io

```bash
cd packages/match
fly deploy  # Dockerfile builds both match + web
```

After deploy, open `https://frame-one-match-preview.fly.dev` — serves web AND API from same URL.

---

## Split-Host Deploy (Vercel + Fly)

### Web (Vercel)

1. Go to [vercel.com](https://vercel.com) → Import Project
2. Connect GitHub repo `dominicddl/frame-one`
3. Configure:
   - **Root Directory**: `packages/web`
   - **Framework**: Vite
   - **Build Command**: (auto-detected from vercel.json)
4. **No VITE_API_URL needed** — `vercel.json` has rewrites to proxy `/api/*` to match server

### Preview Deploys

Vercel auto-deploys preview URLs for each branch/PR. The `integration/demo-tonight` branch will get a preview URL like:
```
https://frame-one-git-integration-demo-tonight-<team>.vercel.app
```

---

## Match Server (Option A: Fly.io)

### Prerequisites

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh
fly auth login
```

### First-time Setup

```bash
cd packages/match

# Create app (once)
fly apps create frame-one-match-preview

# Set secrets (NEVER commit these)
fly secrets set OPENAI_API_KEY=sk-your-key-here

# Deploy
fly deploy
```

### Subsequent Deploys

```bash
cd packages/match
fly deploy
```

### URL

After deploy: `https://frame-one-match-preview.fly.dev`

---

## Match Server (Option B: Render)

### Setup

1. Go to [render.com](https://render.com) → New → Blueprint
2. Connect GitHub repo
3. Select `packages/match/render.yaml`
4. In Render Dashboard → Environment:
   - Set `OPENAI_API_KEY` (marked as secret)
5. Manual deploy for `integration/demo-tonight` branch

### URL

After deploy: `https://frame-one-match-preview.onrender.com`

---

## Environment Variables

### Web (Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Match server URL | `https://frame-one-match-preview.fly.dev` |

### Match (Fly.io / Render)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | Auto-set by host |
| `OPENAI_API_KEY` | OpenAI API key for vision matching | Optional (GPS fallback if missing) |

---

## Verify Deploy

```bash
# Health check
curl https://frame-one-match-preview.fly.dev/api/health

# Test match endpoint
curl -X POST https://frame-one-match-preview.fly.dev/api/match \
  -H "Content-Type: application/json" \
  -d '{"lat": 40.758, "lng": -73.9855}'
```
