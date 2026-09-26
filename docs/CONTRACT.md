# API & ownership contract — FRAME ONE / Movie Map

**Overviewer:** Dominic. Change this file (or `packages/shared`) only with him.

---

## Ownership (conflict avoidance)

| Path | Owner | Commits |
|------|--------|---------|
| `packages/web/` | **Person A** (frontend) | Only Person A |
| `packages/data/` | **Person B** (data & assets) | Only Person B |
| `packages/match/` | **Dominic** (AI matching) | Only Dominic |
| `packages/shared/` | **Dominic** (glue) | Change only with overviewer |
| `docs/` | Team + Dominic | Prefer PR; freeze shapes here |

**Branches:** `feat/web-*` (Person A), `feat/data-*` (Person B), `feat/match-*` (Dominic). Open PRs into `main`. Do not edit the other person’s package.

All packages import types from `@frame-one/shared`. Do not duplicate type definitions in web, data, or match.

---

## Shared types (`@frame-one/shared`)

```ts
interface Spot {
  spotId: string;
  filmTitle: string;
  year: number;
  lat: number;
  lng: number;
  neighbourhood: string;
  stillUrl: string;
  vantageUrl: string;
  keywords: string[];
}

interface MatchRequest {
  lat: number;
  lng: number;
  movieQuery?: string;
  photoDataUrl?: string;
}

interface GoNextItem {
  spotId: string;
  label: string;
  lat: number;
  lng: number;
}

interface MatchResponse {
  spotId: string;
  filmTitle: string;
  year: number;
  lat: number;
  lng: number;
  stillUrl: string;
  vantageUrl: string;
  mergeOk: boolean;
  goNext: GoNextItem[];
}
```

---

## Endpoints (Dominic — `:3001`)

### `GET /api/health`
```json
{ "ok": true, "service": "frame-one-match", "spots": 3 }
```

### `GET /api/spots`
Returns curated catalog for map pins (no unlock state yet — client may track unlocks).

### `POST /api/match`
**Request:**
```json
{
  "lat": 40.7580,
  "lng": -73.9855,
  "movieQuery": "Spider-Man",
  "photoDataUrl": "optional"
}
```

**Response (always a match):**
```json
{
  "spotId": "tasm2-red-steps",
  "filmTitle": "The Amazing Spider-Man 2",
  "year": 2014,
  "lat": 40.7580,
  "lng": -73.9855,
  "stillUrl": "/assets/spots/tasm2-red-steps/still.svg",
  "vantageUrl": "/assets/spots/tasm2-red-steps/vantage.svg",
  "mergeOk": true,
  "goNext": [
    { "spotId": "ghostbusters-firehouse", "label": "Ghostbusters — Tribeca", "lat": 40.7195, "lng": -74.0066 }
  ]
}
```

**Demo matcher rules:**
- Optional `movieQuery` keyword filter against spot `keywords` / title; if none match, fall back to all spots.
- Pick nearest spot by GPS among candidates.
- **Always** return a match (no empty / no-match product state).
- `mergeOk: true` if request GPS is within ~**150 m** of the chosen spot’s lat/lng; else `false` (UI shows vantage).

**Data assets (Person B in `packages/data/`):** Spot metadata in `data/spots.json`; still/vantage images in `assets/spots/<spotId>/`. Served by match server at `/assets/...`.

---

## Frontend (Person A — `:5173`)

- `VITE_API_URL` defaults to `http://localhost:3001`.
- Vite may proxy `/api` and `/assets` to the API.
- Call `postMatch` from `src/api/client.ts` using shared types.
- `mergeOk: true` → merge animation with `stillUrl`; `false` → vantage screen with `vantageUrl`, then retake.

---

## How Dominic glues

1. Freeze types in `packages/shared` + this CONTRACT.
2. Person A ships UI against the JSON shapes above (mock if needed).
3. Person B seeds spot data in `packages/data/`; Dominic implements matching + alignment logic in `packages/match/`.
4. Wire CORS / base URL once; unlock persistence may stay client-side for MVP.
