# @frame-one/data — Movie Spot Data & Assets

**Owner: Person B** — Database, seed data, and movie still assets.

Photo matching: [integration handoff and readiness](PHOTO-MATCHING-HANDOFF.md).
Run `npm run export:matching` to publish the reviewed image manifest and
`npm run verify:data` to compare the catalog with Atlas and check asset hashes.

This package contains all the **curated NYC movie spots** for the FRAME ONE map: spot metadata, hero stills, and vantage reference images.

---

## What's here

Database tools now live in `src/` in this package. From the repository root:

```sh
npm run seed:spots   # Upsert catalog into Atlas and create indexes
npm run sync:images  # Update image URLs after adding photos
npm run test:data
```

Both commands read `MONGODB_URI` and `MONGODB_DB` (default `movie_spots`) from
the root `.env.local`. This file stays gitignored. Node 22.10+ is required.
MongoDB stores GeoJSON coordinates in `[longitude, latitude]` order.

Put photos in `packages/data/assets/spots/<spotId>/`, named `still.jpg` and
`vantage.jpg` (JPEG, PNG and WebP also accepted). See
[photo instructions](assets/spots/README.md). Both commands update image URLs
in Atlas and the JSON catalog so Dominic's existing JSON-loading match server
can use the photos. Restart `npm run dev:match` after syncing.

Matching stays in `packages/match/`, owned by Dominic. It currently reads the
JSON catalog, not Atlas. `src/mongodb.ts` provides `loadActiveSpots()` for future
Atlas integration without changing the matching algorithm.

Local database metadata adds `sceneName`, `mergeRadiusM`, and `active`; the
shared frontend contract is unchanged. Seeding updates all catalog fields;
image sync updates only image URLs and retains missing image roles.

```
packages/data/
  data/
    spots.json          # Spot metadata (GPS, title, year, keywords, URLs)
  assets/
    spots/
      <spotId>/
        still.svg       # Hero film still (for overlay merge)
        vantage.svg     # Reference vantage (correct camera angle guide)
```

---

## How to add a spot

1. **Pick a scene** — Choose an iconic NYC film location (building steps, street corner, storefront, etc.).

2. **Create a folder** in `assets/spots/<spotId>/` (use kebab-case: `tasm2-red-steps`, `ghostbusters-firehouse`).

3. **Add 2 required images:**
   - `still.svg` (or `.jpg`/`.png`) — The film frame for overlay merge. Should match the vantage perspective.
   - `vantage.svg` (or `.jpg`/`.png`) — Reference photo showing where/how to stand and aim the camera.

4. **Add metadata** to `data/spots.json`:

```json
{
  "spotId": "your-spot-id",
  "filmTitle": "The Amazing Spider-Man 2",
  "year": 2014,
  "lat": 40.7580,
  "lng": -73.9855,
  "neighbourhood": "Times Square",
  "stillUrl": "/assets/spots/your-spot-id/still.svg",
  "vantageUrl": "/assets/spots/your-spot-id/vantage.svg",
  "keywords": ["spider-man", "spiderman", "times square", "red steps"]
}
```

5. **Test** — Restart the dev server (`npm run dev`), visit the webapp, and try matching near your new spot's GPS coordinates.

---

## Field reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `spotId` | string | ✅ | Unique kebab-case identifier |
| `filmTitle` | string | ✅ | Full movie title |
| `year` | number | ✅ | Release year |
| `lat` | number | ✅ | GPS latitude (decimal degrees) |
| `lng` | number | ✅ | GPS longitude (decimal degrees) |
| `neighbourhood` | string | ✅ | NYC neighbourhood or landmark name |
| `stillUrl` | string | ✅ | Path to hero still: `/assets/spots/<spotId>/still.ext` |
| `vantageUrl` | string | ✅ | Path to vantage reference: `/assets/spots/<spotId>/vantage.ext` |
| `keywords` | string[] | ✅ | Search keywords (lowercase, include variations) |

---

## Notes for Person B

- **Dominic owns matching logic** (distance, alignment, go-next). You own the data shape and seed catalog.
- **Person A owns UI**. You provide stable data; they render it.
- Keep `spots.json` valid JSON (trailing commas will break the build).
- Image formats: SVG is fine for placeholders; `.jpg`/`.png` are fine for real stills.
- GPS coords: Use Google Maps or similar to find precise lat/lng for the real-world location.
- Keywords: Include variations users might type (`"spider-man"`, `"spiderman"`, `"amazing spider-man"`, `"tasm"`).

---

## Questions?

Ask Dominic if you need to change the spot schema or coordinate with the match package.
