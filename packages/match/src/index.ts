import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import type { Spot, MatchRequest, MatchResponse, GoNextItem } from "@frame-one/shared";
import { hasVisionApiKey } from "./vision-openai";
import { retrieveSpotByPhoto } from "./retrieve";

const PORT = Number(process.env.PORT) || 3001;
const MERGE_OK_METERS = 150;
const MERGE_OK_RETRIEVAL_SCORE = 60;

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Load spot data from @frame-one/data package
const dataPackageDir = path.join(__dirname, "..", "..", "data");
const spotsPath = path.join(dataPackageDir, "data", "spots.json");
const spots: Spot[] = JSON.parse(fs.readFileSync(spotsPath, "utf-8"));

// Serve data package assets
app.use("/assets/spots", express.static(path.join(dataPackageDir, "assets", "spots")));

/** Haversine distance in meters */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function pickSpotByGps(candidates: Spot[], lat: number, lng: number): Spot {
  let best = candidates[0];
  let bestDist = Infinity;
  for (const s of candidates) {
    const d = distanceMeters(lat, lng, s.lat, s.lng);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

function filterCandidatesByQuery(query?: string): Spot[] {
  if (!query?.trim()) {
    return spots;
  }

  const lowerQuery = query.trim().toLowerCase();
  const filtered = spots.filter((s) =>
    s.keywords.some((k) => k.includes(lowerQuery) || lowerQuery.includes(k)) ||
    s.filmTitle.toLowerCase().includes(lowerQuery)
  );

  return filtered.length > 0 ? filtered : spots;
}

function buildGoNext(matched: Spot): GoNextItem[] {
  return spots
    .filter((s) => s.spotId !== matched.spotId)
    .map((s) => ({
      spotId: s.spotId,
      label: `${s.filmTitle} — ${s.neighbourhood}`,
      lat: s.lat,
      lng: s.lng,
      distance: distanceMeters(matched.lat, matched.lng, s.lat, s.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map(({ distance, ...item }) => item);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "frame-one-match", spots: spots.length });
});

app.get("/api/spots", (_req, res) => {
  res.json({
    spots: spots.map((s) => ({
      spotId: s.spotId,
      filmTitle: s.filmTitle,
      year: s.year,
      lat: s.lat,
      lng: s.lng,
      neighbourhood: s.neighbourhood,
      stillUrl: s.stillUrl,
      vantageUrl: s.vantageUrl,
    })),
  });
});

app.post("/api/match", async (req, res) => {
  const body = req.body as MatchRequest;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat and lng are required numbers" });
    return;
  }

  const candidates = filterCandidatesByQuery(body.movieQuery);
  
  let spot: Spot;
  let mergeOk = false;
  let retrievalScore: number | undefined;

  if (body.photoDataUrl && hasVisionApiKey()) {
    console.log(
      `[match] Photo provided with API key; using retrieval-first (${candidates.length} candidates)`
    );

    const retrievalResult = await retrieveSpotByPhoto(
      body.photoDataUrl,
      candidates,
      dataPackageDir
    );

    if (retrievalResult) {
      const matchedSpot = spots.find((s) => s.spotId === retrievalResult.spotId);
      if (matchedSpot) {
        spot = matchedSpot;
        retrievalScore = retrievalResult.score;
        
        mergeOk = retrievalResult.score >= MERGE_OK_RETRIEVAL_SCORE;
        
        const gpsDist = distanceMeters(lat, lng, spot.lat, spot.lng);
        if (!mergeOk && gpsDist <= MERGE_OK_METERS) {
          mergeOk = true;
        }

        console.log(
          `[match] Retrieval matched ${spot.spotId} (score: ${retrievalScore}, confidence: ${retrievalResult.confidence}, mergeOk: ${mergeOk})`
        );
      } else {
        console.log(
          `[match] Retrieval spotId ${retrievalResult.spotId} not found in catalog; falling back to GPS`
        );
        spot = pickSpotByGps(candidates, lat, lng);
        const dist = distanceMeters(lat, lng, spot.lat, spot.lng);
        mergeOk = dist <= MERGE_OK_METERS;
      }
    } else {
      console.log("[match] Retrieval returned no result; falling back to GPS");
      spot = pickSpotByGps(candidates, lat, lng);
      const dist = distanceMeters(lat, lng, spot.lat, spot.lng);
      mergeOk = dist <= MERGE_OK_METERS;
    }
  } else {
    if (body.photoDataUrl) {
      console.log("[match] Photo provided but no API key; using GPS fallback");
    } else {
      console.log("[match] No photo provided; using GPS-based matching");
    }
    
    spot = pickSpotByGps(candidates, lat, lng);
    const dist = distanceMeters(lat, lng, spot.lat, spot.lng);
    mergeOk = dist <= MERGE_OK_METERS;
  }

  const response: MatchResponse = {
    spotId: spot.spotId,
    filmTitle: spot.filmTitle,
    year: spot.year,
    lat: spot.lat,
    lng: spot.lng,
    stillUrl: spot.stillUrl,
    vantageUrl: spot.vantageUrl,
    mergeOk,
    goNext: buildGoNext(spot),
  };

  res.json(response);
});

app.listen(PORT, () => {
  const visionStatus = hasVisionApiKey()
    ? "✓ OpenAI API key found"
    : "⚠ No OPENAI_API_KEY (GPS fallback only)";
  console.log(`[match] FRAME ONE listening on http://localhost:${PORT}`);
  console.log(`[match] ${spots.length} spots loaded; mergeOk within ${MERGE_OK_METERS}m or score >=${MERGE_OK_RETRIEVAL_SCORE}`);
  console.log(`[match] ${visionStatus}`);
});
