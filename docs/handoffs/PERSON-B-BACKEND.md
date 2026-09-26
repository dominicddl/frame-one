# Handoff — Person B (Backend / Matching)

You own the **matching backend** for the webapp: pick the scene, say whether the overlay can land, and return go-next. Dominic overviews and connects you to Person A’s UI. Keep it demo-reliable; full ML is optional.

## Product north star
Help people know NYC and answer: “I’ve seen this movie spot before?”  
**Always return a match** for the demo (curated spots). No “no match” product state. No “wrong spot walk 180m” product state.

## What you build
1. **Spot catalog** (3–5 NYC spots to start), each with:
   - `spotId`, `filmTitle`, `year`, `lat`, `lng`, `neighbourhood`
   - **Hero still** URL (film frame for overlay) — 1 required
   - **Vantage reference** URL (correct real-world camera view) — 1 required
   - Optional keyword list for movie query matching
2. **`POST /api/match`** (or same logic in-process if monorepo):
   - Input: `lat`, `lng`, `movieQuery`, optional photo
   - Output: always a chosen spot + still + vantage + `mergeOk` + `goNext[]`
3. **`mergeOk` logic**
   - Demo-simple is fine: e.g. within X meters of spot GPS → `true`; else `false` (UI shows vantage guide).
   - Optional later: crude image similarity vs vantage reference.
4. **`goNext`** — 1–3 nearby spot ids/labels/coords for the map sheet after unlock.
5. Optional: `GET /api/spots` for map pins + which are unlocked (or let Dominic/A keep unlock client-side and only use you for match).

## Example response shape (freeze with Dominic — don’t change casually)
```json
{
  "spotId": "tasm2-red-steps",
  "filmTitle": "The Amazing Spider-Man 2",
  "year": 2014,
  "lat": 40.7580,
  "lng": -73.9855,
  "stillUrl": "/assets/spots/tasm2/still.jpg",
  "vantageUrl": "/assets/spots/tasm2/vantage.jpg",
  "mergeOk": true,
  "goNext": [
    { "spotId": "nearby-1", "label": "Midtown peek", "lat": 40.76, "lng": -73.98 }
  ]
}
```

## Explicitly out of scope for you
- Designing the screens / CSS / map fog visuals (Person A + Dominic)
- Profile badges page
- Scraping X / general-purpose vision across the whole internet
- Guaranteeing production rights on stills (placeholders OK for demo)

## Done when
Person A can call your API from the webapp and get a stable match payload for a demo pin (e.g. Times Square). Forcing `mergeOk: false` once is enough to test the vantage screen. 3–5 seeded spots with still + vantage paths exist.

## Work with Dominic
- He supplies or places the image files; you expose URLs/paths.
- Agree CORS / base URL / one shared repo folder for `/assets/spots/...`.
- He wires unlock persistence if you don’t.
