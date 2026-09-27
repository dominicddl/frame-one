# Photo matching data handoff

## Readiness

Ready to connect to a prototype matcher; **matching accuracy and image alignment
are not validated**. Eight supplied movie stills now have real-world references.
Six are approximate viewpoint candidates; two are context-only. Two original
demo records have SVG placeholders and are excluded from the manifest.

The additional John Wick: Chapter 2 still is stored and seeded at
`john-wick-bethesda-terrace`. It has no modern reference and is excluded from
the paired-image manifest. The full database has eleven records and nine
uploaded movie stills. The matching server remains unchanged and reads JSON.

| Spot | Reference year | Assessment |
| --- | --- | --- |
| Times Square red steps | 2009 | Correct steps, side angle/daylight differ; old reference |
| Brooklyn Bridge / Enchanted | 2024 | Correct tower/walkway, framing differs |
| Grand Central | 2019 | Elevated concourse and clock; similar architectural content |
| Radio City | 2024 | Correct corner, signs and marquee |
| The Battery | 2010 | Context only: harbor view, no binoculars/railing |
| Joker stairs | 2019 | Correct stairs, tourists and different framing |
| Brooklyn Bridge Park / Past Lives | 2026 | Bridge/carousel/skyline, wider panorama |
| Fifth Avenue / Prada | 2020 | Context only: nearby St Regis view, different corner angle |

These are real-world photos with capture dates, not a guarantee of current
conditions. The Battery and Prada need better viewpoints. No pair has
`alignmentValidated: true`. Candidate selection is human screening, not a model
benchmark. Uploaded stills retain video borders, watermarks and controls; mask
these during model preprocessing rather than treating them as scene features.

## Connect

Start `npm run dev:match`, then fetch:

```text
GET http://localhost:3001/assets/spots/matching-catalog.json
GET http://localhost:3001/assets/spots/ATTRIBUTION.md
```

The manifest contains `schemaVersion`, `candidateSpotIds` and `spots`. Each spot
has stable spotId, scene metadata, coordinates, keywords, stillUrl, vantageUrl,
and `matchingAssets`. Asset metadata includes dimensions, MIME type, SHA-256,
author/source/license/capture date, viewpoint notes and eligibility. Use
`candidateSpotIds` for the initial visual reference index. Context-only pairs
remain available for review, but are excluded from that list.

Resolve paths with `new URL(spot.vantageUrl, matchServerOrigin)`. A remote model
cannot fetch your localhost; either send image bytes through your backend or
deploy the assets to an accessible origin. MongoDB stores paths and metadata,
not image bytes. Deploy `packages/data/assets/` with the match server.

Alternatively, query MongoDB server-side:

```js
const candidates = await db.collection("spots").find({
  active: true,
  "matchingAssets.prototypeEligible": true,
  "matchingAssets.vantage.viewpointQuality": "approximate"
}, { projection: { _id: 0 } }).toArray();
```

Database: `movie_spots`; collection: `spots`. GeoJSON coordinates are
`[longitude, latitude]`; the manifest uses lat/lng. The partner's server still
reads JSON. Its algorithm and existing API response shapes are unchanged.
GET /api/spots remains the map API; use the manifest or MongoDB for asset metadata.

## Update and verify

```sh
npm run seed:spots
npm run export:matching
npm run verify:data
npm run test:data
```

Export checks image hashes to prevent replaced images retaining stale provenance.
When replacing a photo, review and refresh its `matchingAssets` metadata, seed,
export, and restart the server. Image-only sync does not refresh attribution or
review judgments. The manifest must be regenerated after catalog changes.

Credits: [ATTRIBUTION.md](assets/spots/ATTRIBUTION.md) and
[vantage-sources.json](data/vantage-sources.json). Preserve attribution when
displaying images and follow linked licenses. Uploaded still rights remain
not independently verified; no production clearance is implied.

The matching owner still needs to implement feature extraction/embeddings,
preprocessing, similarity thresholds, held-out evaluation and alignment checks.
`mergeRadiusM` is a GPS check, not visual proof.
