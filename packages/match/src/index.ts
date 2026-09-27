import path from "path";
import dotenv from "dotenv";

const envPath = path.resolve(__dirname, "..", "..", "..", ".env.local");
dotenv.config({ path: envPath });
if (!process.env.OPENAI_API_KEY) {
  const fallbackEnv = path.resolve(__dirname, "..", "..", "..", ".env");
  dotenv.config({ path: fallbackEnv });
}

import express from "express";
import cors from "cors";
import fs from "fs";
import type { Spot, MatchRequest, MatchResponse, GoNextItem, SoftMissSuggestion, MatchConfidence } from "@frame-one/shared";
import { hasVisionApiKey, getVisionModelInfo } from "./vision-openai";
import { retrieveSpotByPhoto } from "./retrieve";

const PORT = Number(process.env.PORT) || 3001;
const MERGE_OK_METERS = 150;
const MERGE_OK_RETRIEVAL_SCORE = 60;
const LOW_CONFIDENCE_THRESHOLD = 50;
const NEARBY_SUGGESTION_RADIUS_M = 2000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Load spot data from @frame-one/data package
const dataPackageDir = path.join(__dirname, "..", "..", "data");
const spotsPath = path.join(dataPackageDir, "data", "spots.json");
const allSpots: (Spot & { active?: boolean })[] = JSON.parse(fs.readFileSync(spotsPath, "utf-8"));
// Filter out inactive spots (active: false) - they should never be matched
const spots: Spot[] = allSpots.filter((s) => s.active !== false);

// Load matching catalog (Person B's curated image assets)
const matchingCatalogPath = path.join(dataPackageDir, "assets", "spots", "matching-catalog.json");
let matchingCatalog: any = null;
let candidateSpotIds: string[] = [];
try {
  matchingCatalog = JSON.parse(fs.readFileSync(matchingCatalogPath, "utf-8"));
  candidateSpotIds = matchingCatalog.candidateSpotIds || [];
  console.log(`[match] Loaded matching catalog with ${candidateSpotIds.length} candidates`);
} catch (err) {
  console.log(`[match] No matching catalog found; using all spots for matching`);
}

// Serve data package assets
app.use("/assets/spots", express.static(path.join(dataPackageDir, "assets", "spots")));

// Serve test harness
app.use("/harness", express.static(path.join(__dirname, "..", "harness")));

// Serve web build (single-host mode: match server serves both API + web)
const webDistPath = path.join(__dirname, "..", "..", "web", "dist");
if (fs.existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/assets") || req.path.startsWith("/harness")) {
      return next();
    }
    res.sendFile(path.join(webDistPath, "index.html"));
  });
  console.log(`[match] Serving web from ${webDistPath}`);
}

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

interface QueryFilterResult {
  candidates: Spot[];
  queryMatched: boolean; // true if query matched keywords/film, false if fallback to all
}

function filterCandidatesByQuery(query?: string): QueryFilterResult {
  if (!query?.trim()) {
    return { candidates: spots, queryMatched: true }; // No query = all spots OK
  }

  const lowerQuery = query.trim().toLowerCase();
  const filtered = spots.filter((s) =>
    s.keywords.some((k) => k.includes(lowerQuery) || lowerQuery.includes(k)) ||
    s.filmTitle.toLowerCase().includes(lowerQuery)
  );

  if (filtered.length > 0) {
    return { candidates: filtered, queryMatched: true };
  }
  
  // Query provided but no matches — return all spots but flag as unmatched
  return { candidates: spots, queryMatched: false };
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

function buildSoftMissSuggestions(
  matched: Spot,
  userLat: number,
  userLng: number
): SoftMissSuggestion[] {
  const suggestions: SoftMissSuggestion[] = [];
  const seen = new Set<string>([matched.spotId]);

  const candidatesWithDist = spots
    .filter((s) => s.spotId !== matched.spotId)
    .map((s) => ({
      spot: s,
      distanceM: distanceMeters(userLat, userLng, s.lat, s.lng),
    }));

  const nearby = candidatesWithDist
    .filter((c) => c.distanceM <= NEARBY_SUGGESTION_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);

  for (const { spot, distanceM } of nearby.slice(0, 2)) {
    if (!seen.has(spot.spotId)) {
      seen.add(spot.spotId);
      suggestions.push({
        spotId: spot.spotId,
        filmTitle: spot.filmTitle,
        neighbourhood: spot.neighbourhood,
        distanceM: Math.round(distanceM),
        reason: "nearby",
      });
    }
  }

  const sameNeighbourhood = candidatesWithDist
    .filter((c) => c.spot.neighbourhood === matched.neighbourhood && !seen.has(c.spot.spotId))
    .sort((a, b) => a.distanceM - b.distanceM);

  for (const { spot, distanceM } of sameNeighbourhood.slice(0, 1)) {
    seen.add(spot.spotId);
    suggestions.push({
      spotId: spot.spotId,
      filmTitle: spot.filmTitle,
      neighbourhood: spot.neighbourhood,
      distanceM: Math.round(distanceM),
      reason: "same-neighbourhood",
    });
  }

  const sameFilm = candidatesWithDist
    .filter((c) => c.spot.filmTitle === matched.filmTitle && !seen.has(c.spot.spotId))
    .sort((a, b) => a.distanceM - b.distanceM);

  for (const { spot, distanceM } of sameFilm.slice(0, 1)) {
    seen.add(spot.spotId);
    suggestions.push({
      spotId: spot.spotId,
      filmTitle: spot.filmTitle,
      neighbourhood: spot.neighbourhood,
      distanceM: Math.round(distanceM),
      reason: "same-film",
    });
  }

  return suggestions.slice(0, 3);
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

  const { candidates, queryMatched } = filterCandidatesByQuery(body.movieQuery);
  
  const photoCandidates = candidateSpotIds.length > 0 && body.photoDataUrl
    ? candidates.filter(s => candidateSpotIds.includes(s.spotId))
    : candidates;
  
  let spot: Spot;
  let mergeOk = false;
  let retrievalScore: number | undefined;
  let matchConfidence: MatchConfidence = "low";
  let usedVision = false;
  
  // If query was provided but didn't match any keywords/films, force low confidence
  const forceQueryMissLow = body.movieQuery?.trim() && !queryMatched;

  if (body.photoDataUrl && hasVisionApiKey()) {
    usedVision = true;
    console.log(
      `[match] Photo provided with API key; using retrieval-first (${photoCandidates.length} photo candidates from ${candidates.length} total)`
    );

    const retrievalResult = await retrieveSpotByPhoto(
      body.photoDataUrl,
      photoCandidates.length > 0 ? photoCandidates : candidates,
      dataPackageDir
    );

    if (retrievalResult) {
      const matchedSpot = spots.find((s) => s.spotId === retrievalResult.spotId);
      if (matchedSpot) {
        spot = matchedSpot;
        retrievalScore = retrievalResult.score;
        matchConfidence = retrievalResult.confidence;
        
        mergeOk = retrievalResult.score >= MERGE_OK_RETRIEVAL_SCORE;
        
        const gpsDist = distanceMeters(lat, lng, spot.lat, spot.lng);
        if (!mergeOk && gpsDist <= MERGE_OK_METERS) {
          mergeOk = true;
        }

        console.log(
          `[match] Retrieval matched ${spot.spotId} (score: ${retrievalScore}, confidence: ${matchConfidence}, mergeOk: ${mergeOk})`
        );
      } else {
        console.log(
          `[match] Retrieval spotId ${retrievalResult.spotId} not found in catalog; falling back to GPS`
        );
        spot = pickSpotByGps(candidates, lat, lng);
        const dist = distanceMeters(lat, lng, spot.lat, spot.lng);
        mergeOk = dist <= MERGE_OK_METERS;
        // Query matched → medium; query missed → low (soft-miss)
        // mergeOk only affects overlay quality, not confidence
        matchConfidence = forceQueryMissLow ? "low" : "medium";
      }
    } else {
      console.log("[match] Retrieval returned no result; falling back to GPS");
      spot = pickSpotByGps(candidates, lat, lng);
      const dist = distanceMeters(lat, lng, spot.lat, spot.lng);
      mergeOk = dist <= MERGE_OK_METERS;
      // Query matched → medium; query missed → low (soft-miss)
      matchConfidence = forceQueryMissLow ? "low" : "medium";
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
    // Query matched → medium; query missed → low (soft-miss)
    // mergeOk only affects overlay quality, not match confidence
    matchConfidence = forceQueryMissLow ? "low" : "medium";
    
    if (forceQueryMissLow) {
      console.log(`[match] Query "${body.movieQuery}" didn't match any keywords; forcing low confidence`);
    }
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
    matchConfidence,
  };

  if (matchConfidence === "low" || (usedVision && retrievalScore !== undefined && retrievalScore < LOW_CONFIDENCE_THRESHOLD)) {
    response.suggestions = buildSoftMissSuggestions(spot, lat, lng);
    console.log(
      `[match] Low confidence match; providing ${response.suggestions.length} soft-miss suggestions`
    );
  }

  res.json(response);
});

// Simple in-memory cache for geocode results (TTL 5 minutes)
const geocodeCache = new Map<string, { results: GeocodeSuggestion[]; expires: number }>();
const GEOCODE_CACHE_TTL = 5 * 60 * 1000;

interface GeocodeSuggestion {
  name: string;
  lat: number;
  lng: number;
}

app.get("/api/geocode", async (req, res) => {
  const query = String(req.query.q || "").trim();
  if (!query || query.length < 2) {
    res.json({ results: [] });
    return;
  }

  const cacheKey = query.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    res.json({ results: cached.results });
    return;
  }

  try {
    // Nominatim with NYC bias (viewbox around Manhattan, bounded)
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "6",
      viewbox: "-74.05,40.9,-73.85,40.65",
      bounded: "1",
      countrycodes: "us",
    });

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?${params}`;
    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "FrameOne/1.0 (demo film location app)",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.log(`[geocode] Nominatim error: ${response.status}`);
      res.json({ results: [] });
      return;
    }

    const data = (await response.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
      address?: { road?: string; neighbourhood?: string; suburb?: string; city?: string };
    }>;

    const results: GeocodeSuggestion[] = data.map((item) => {
      const addr = item.address || {};
      const shortName =
        addr.road ||
        addr.neighbourhood ||
        addr.suburb ||
        item.display_name.split(",")[0];
      return {
        name: shortName,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });

    geocodeCache.set(cacheKey, { results, expires: Date.now() + GEOCODE_CACHE_TTL });
    res.json({ results });
  } catch (err) {
    console.log(`[geocode] Error: ${err}`);
    res.json({ results: [] });
  }
});

app.listen(PORT, () => {
  const visionStatus = hasVisionApiKey()
    ? `✓ OpenAI API key found (model: ${getVisionModelInfo()})`
    : "⚠ No OPENAI_API_KEY (GPS fallback only)";
  console.log(`[match] FRAME ONE listening on http://localhost:${PORT}`);
  console.log(`[match] ${spots.length} spots loaded; mergeOk within ${MERGE_OK_METERS}m or score >=${MERGE_OK_RETRIEVAL_SCORE}`);
  console.log(`[match] ${visionStatus}`);
});
