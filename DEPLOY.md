# Frame One Deploy Guide

## Architecture

- **Web** (Vercel): Static Vite build from `packages/web`
- **Match** (Fly.io / Render): Node.js API server from `packages/match`

---

## Web (Vercel)

### Setup

1. Go to [vercel.com](https://vercel.com) → Import Project
2. Connect GitHub repo `dominicddl/frame-one`
3. Configure:
   - **Root Directory**: `packages/web`
   - **Framework**: Vite
   - **Build Command**: (auto-detected from vercel.json)
4. Set Environment Variable:
   ```
   VITE_API_URL = https://frame-one-match-preview.fly.dev
   ```
   (Replace with your actual Match server URL)

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
