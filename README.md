# FRAME ONE / Movie Map

Hackathon webapp: snap where you are in NYC → match a film scene → overlay still on your photo → unlock map stamps.

See `docs/SHARED-UNDERSTANDING.md` for product truth, and `docs/handoffs/` for Person A / Person B scopes.

---

## Ownership (read this)

| Who | Owns | Branch prefix |
|-----|------|---------------|
| **Person A** | `packages/web/` **only** — UI, screens, frontend | `feat/web-*` |
| **Person B** | `packages/data/` **only** — DB, seed spots, stills | `feat/data-*` |
| **Dominic** (overviewer) | `packages/match/` (AI matching), `packages/shared/`, glue, CONTRACT | `feat/match-*` or PRs to `main` |

- **Do not** commit into someone else’s package.
- `packages/shared` is the type contract — change **only with Dominic**.
- Both packages import types from `@frame-one/shared`.
- **Person B** adds spot data and images in `packages/data/`; **Dominic** wires matching logic in `packages/match/`.
- Open PRs into `main`. Full contract: [`docs/CONTRACT.md`](docs/CONTRACT.md).

---

## Quick start

```bash
cd /workspace/frame-one
npm install
npm run build -w @frame-one/shared   # once (or after shared changes)
npm run dev                          # Match :3001 + Web :5173
```

Or separately:

```bash
npm run dev:match   # http://localhost:3001
npm run dev:web     # http://localhost:5173
```

`scripts/dev.sh` is a thin wrapper around `npm run dev`.

### Sanity checks

```bash
curl -s http://localhost:3001/api/health
curl -s -X POST http://localhost:3001/api/match \
  -H 'Content-Type: application/json' \
  -d '{"lat":40.7580,"lng":-73.9855,"movieQuery":"Spider-Man"}'
```

---

## Layout

```
frame-one/
  packages/shared/   # @frame-one/shared — types only
  packages/match/    # @frame-one/match — Express on :3001 (AI matching + alignment)
  packages/data/     # @frame-one/data — spot seed data + still/vantage assets
  packages/web/      # @frame-one/web — Vite+React+TS on :5173
  docs/CONTRACT.md
  docs/SHARED-UNDERSTANDING.md
  docs/handoffs/
```

---

## How Dominic glues

1. Keep `MatchRequest` / `MatchResponse` / `Spot` / `GoNextItem` frozen in `@frame-one/shared` + `docs/CONTRACT.md`.
2. Person A builds screens against those shapes; Person B seeds spots + images; Dominic implements AI matching.
3. If shapes must change, Dominic updates shared + CONTRACT; A and B pull and adjust their side only.
4. CORS and `VITE_API_URL` (default `http://localhost:3001`) connect the two apps; Vite also proxies `/api`.

---

## Scripts

| Script | What |
|--------|------|
| `npm run dev` | concurrently match + web |
| `npm run dev:match` | Match server only |
| `npm run dev:web` | Web only |
| `npm run build` | shared → match → web |
