import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import type { Spot, MatchRequest, MatchResponse, GoNextItem } from "@frame-one/shared";

const PORT = Number(process.env.PORT) || 3001;
const MERGE_OK_METERS = 150;

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

const spotsPath = path.join(__dirname, "..", "data", "spots.json");
const spots: Spot[] = JSON.parse(fs.readFileSync(spotsPath, "utf-8"));

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

function pickSpot(req: MatchRequest): Spot {
  const query = (req.movieQuery || "").trim().toLowerCase();
  let candidates = spots;

  if (query) {
    const filtered = spots.filter((s) =>
      s.keywords.some((k) => k.includes(query) || query.includes(k)) ||
      s.filmTitle.toLowerCase().includes(query)
    );
    if (filtered.length > 0) candidates = filtered;
  }

  // Nearest by GPS among candidates
  let best = candidates[0];
  let bestDist = Infinity;
  for (const s of candidates) {
    const d = distanceMeters(req.lat, req.lng, s.lat, s.lng);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

function buildGoNext(matched: Spot): GoNextItem[] {
  return spots
    .filter((s) => s.spotId !== matched.spotId)
    .map((s) => ({
      spotId: s.spotId,
      label: `${s.filmTitle} — ${s.neighbourhood}`,
      lat: s.lat,
      lng: s.lng,
    }))
    .slice(0, 3);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "frame-one-api", spots: spots.length });
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

app.post("/api/match", (req, res) => {
  const body = req.body as MatchRequest;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat and lng are required numbers" });
    return;
  }

  const spot = pickSpot({
    lat,
    lng,
    movieQuery: body.movieQuery,
    photoDataUrl: body.photoDataUrl,
  });

  const dist = distanceMeters(lat, lng, spot.lat, spot.lng);
  const mergeOk = dist <= MERGE_OK_METERS;

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
  console.log(`[api] FRAME ONE listening on http://localhost:${PORT}`);
  console.log(`[api] ${spots.length} spots loaded; mergeOk within ${MERGE_OK_METERS}m`);
});
