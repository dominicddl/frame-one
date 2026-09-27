# Handoff — Person A (Frontend / Webapp UI)

You own the **webapp UI**: every screen the user sees and taps. Dominic overviews and connects your work to Person B’s backend. Build against the shared contract below; do not invent your own spot list or matcher.

## Product north star
Help people know NYC and answer: “I’ve seen this movie spot before?”

## Locked user flow (build these screens in order)
1. **Capture** — Take photo (getUserMedia) or upload an image.
2. **Context** — Confirm location (GPS or editable pin) + what movie/vibe they have in mind (free text / keywords). User supplies the movie; **do not** auto-guess the title in the UI.
3. **Matching screen** — Show **their photo** being matched with the **film scene** (side-by-side).
4. **Merge transition** — Animate the film still **overlaying onto their photo**. That overlay *is* recreate. No cut-outs, no step-in, no separate “recreate mode.”
5. **If backend says misaligned** — Screen with **reference vantage** (“stand here / shoot from this angle”) + retake, then back to merge when OK.
6. **Map unlock** — After success: shadowed icon → **colourful stamp/sticker**; clear a bit of fog around it; nearby peeks optional.
7. **Tap unlocked icon** — Sheet/modal: show the **merged photo** (theirs + overlay) + **where to go next** (from backend `goNext`).

## Explicitly out of scope for you
- Matching algorithm / ML
- Profile / badge collection page (later nice-to-have)
- Wrong-spot “walk 180m” flow, no-match dead ends
- Native iOS — this is a **webapp**

## What you call (Dominic's match server)
`POST /api/match` (or equivalent) with something like:
```json
{
  "lat": 40.7580,
  "lng": -73.9855,
  "movieQuery": "Spider-Man",
  "photoDataUrl": "optional; or upload separately"
}
```
Expect something like:
```json
{
  "spotId": "tasm2-red-steps",
  "filmTitle": "The Amazing Spider-Man 2",
  "year": 2014,
  "stillUrl": "/assets/spots/tasm2/still.jpg",
  "vantageUrl": "/assets/spots/tasm2/vantage.jpg",
  "mergeOk": true,
  "goNext": [{ "spotId": "...", "label": "...", "lat": 0, "lng": 0 }]
}
```
- `mergeOk: true` → play merge animation with `stillUrl` on their photo.
- `mergeOk: false` → show vantage screen using `vantageUrl`, then retake / re-call match.

Also use whatever Dominic provides for map seed (spot positions, fog/stamp state). Prefer reading unlock state from a small `GET /api/spots` or local state Dominic defines.

## Done when
A stranger can: capture → context → see match → see merge (or vantage → retake → merge) → stamp colours on map → tap stamp → see merge + go next. Wired to real backend responses, not only hardcoded fake UI (unless Dominic is late — then mock the JSON shape above).

## Work with Dominic
- Ask him for asset URLs and the frozen JSON schema.
- Ship mobile-web layout (~390px wide is fine).
- Ping him when match→map handoff needs glue.
