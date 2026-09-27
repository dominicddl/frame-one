# Handoff — Person B (Database & Movie Stills)

You own the **spot data catalog** and **still/vantage image assets** for the webapp: every NYC movie location, film frame, and reference photo. Dominic overviews, owns matching logic, and connects your data to Person A's UI.

## Product north star
Help people know NYC and answer: "I've seen this movie spot before?"

## What you build

### 1. Spot catalog (in `packages/data/`)
Curate 3–5 NYC movie spots to start (expand later). Each spot requires:

**Required metadata** (in `data/spots.json`):
- `spotId` — unique kebab-case identifier (e.g. `tasm2-red-steps`)
- `filmTitle` — full movie title
- `year` — release year
- `lat`, `lng` — precise GPS coordinates (decimal degrees)
- `neighbourhood` — NYC area/landmark name
- `stillUrl` — path to hero still: `/assets/spots/<spotId>/still.svg`
- `vantageUrl` — path to vantage reference: `/assets/spots/<spotId>/vantage.svg`
- `keywords` — search terms array (lowercase, include variations)

**Required assets** (in `assets/spots/<spotId>/`):
- **Hero still** — Film frame for overlay merge (1 required per spot)
- **Vantage reference** — Real-world photo showing where/how to stand and aim camera (1 required per spot)

### 2. How to add a spot

1. Create folder: `packages/data/assets/spots/<spotId>/`
2. Add `still.svg` (or `.jpg`/`.png`) and `vantage.svg`
3. Add metadata entry to `packages/data/data/spots.json`
4. Test by restarting dev server and matching near your spot's GPS

See `packages/data/README.md` for detailed field reference and examples.

## Example spot entry

```json
{
  "spotId": "tasm2-red-steps",
  "filmTitle": "The Amazing Spider-Man 2",
  "year": 2014,
  "lat": 40.7580,
  "lng": -73.9855,
  "neighbourhood": "Times Square",
  "stillUrl": "/assets/spots/tasm2-red-steps/still.svg",
  "vantageUrl": "/assets/spots/tasm2-red-steps/vantage.svg",
  "keywords": ["spider-man", "spiderman", "amazing spider-man", "tasm", "red steps", "times square"]
}
```

## Explicitly out of scope for you
- Matching algorithm / ML (Dominic owns)
- Designing the screens / CSS / map fog visuals (Person A + Dominic)
- Deciding `mergeOk` alignment logic (Dominic owns)
- Profile badges page
- Scraping X / general-purpose vision
- Production rights clearance (placeholders OK for demo)

## What Dominic calls
Dominic's match server loads your data from `packages/data/` and serves it at `/api/spots` and `/api/match`. You provide stable data; he wires the matching logic and alignment checks.

## Done when
3–5 seeded spots exist with valid metadata + 2 images each (hero still + vantage). Person A and Dominic can use your data to test the full flow: capture → context → match → merge (or vantage → retake) → map unlock.

## Work with Dominic
- He owns the match package and loads your data.
- Ask him before changing the spot schema (fields in `spots.json`).
- GPS coords matter — use Google Maps or similar to get precise lat/lng.
- Keywords help movie query matching — include common variations users might type.
