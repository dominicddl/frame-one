# Handoff — Dominic (AI Matching & Glue)

You own the **matching backend** (`packages/match/`), **AI alignment surfaces**, **shared type contract**, and **integration glue** for the webapp. You connect Person A's UI to Person B's data catalog.

## Product north star
Help people know NYC and answer: "I've seen this movie spot before?"  
**Always return a match** for the demo (curated spots). No "no match" product state. No "wrong spot walk 180m" product state.

## What you build

### 1. Match server (`packages/match/` — Express on :3001)

**Core endpoints:**
- `GET /api/health` — Service health + spot count
- `GET /api/spots` — Full catalog for map pins (no unlock state yet)
- `POST /api/match` — Core matching logic

**Match logic responsibilities:**
1. **Spot selection** — Pick best spot from Person B's catalog based on:
   - Optional `movieQuery` keyword filter (against spot `keywords` / title)
   - Nearest by GPS among candidates
   - Always return a match (demo-reliable)

2. **Alignment check** (`mergeOk` logic):**
   - Demo-simple: within X meters of spot GPS → `true`; else `false`
   - Later: optionally crude image similarity vs vantage reference
   - `mergeOk: true` → UI plays merge animation
   - `mergeOk: false` → UI shows vantage guide, then retake

3. **Go-next** — 1–3 nearby spot ids/labels/coords for map sheet after unlock

### 2. Data integration
- Load spot metadata from `packages/data/data/spots.json`
- Serve still/vantage assets from `packages/data/assets/spots/`
- Person B adds spots; you wire them into match logic

### 3. Shared type contract (`packages/shared/`)
Freeze these types + keep synced with `docs/CONTRACT.md`:
- `Spot` — catalog schema
- `MatchRequest` — lat/lng + optional movie query + photo
- `MatchResponse` — chosen spot + `mergeOk` + `goNext[]`
- `GoNextItem` — nearby spot for map sheet

### 4. Glue responsibilities
- CORS config between match server (:3001) and web (:5173)
- Coordinate API shape changes with Person A and Person B
- Wire unlock persistence (may stay client-side for MVP)
- Own conflict resolution when A or B need overlapping changes

## Example match response shape

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
    { "spotId": "nearby-1", "label": "Midtown peek", "lat": 40.76, "lng": -73.98 }
  ]
}
```

## AI surfaces (future)
When ready to enhance beyond demo matcher:
- Vision alignment check (compare user photo vs vantage reference)
- Smarter spot selection (beyond keyword + GPS)
- Scene recognition / general NYC film matching
- Quality scoring for overlay merge feasibility

Keep these surfaces separate from core demo logic. Demo must stay reliable.

## Explicitly out of scope for you
- Designing the screens / CSS / map fog visuals (Person A owns)
- Curating spot data / sourcing stills (Person B owns)
- Profile badges page (nice-to-have)

## Done when
Person A can call `/api/match` from the webapp and get stable match payloads for demo pins. Forcing `mergeOk: false` once is enough to test vantage screen. 3–5 spots loaded from Person B's catalog work end-to-end.

## Work with Person A and Person B
- **Person A** — Freeze API shapes before they build screens. Supply mock responses if B is late. Wire CORS / base URL.
- **Person B** — Load their spot data; don't ask them to change the match logic. Agree on schema before they seed many spots.
- **Both** — Coordinate via CONTRACT.md when shapes must change.
