import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { CatalogSpot } from "./catalog";

export function buildMatchingCatalog(catalog: CatalogSpot[]) {
  const spots = catalog.filter((spot) => spot.active && spot.matchingAssets).map((spot) => {
    const assets = spot.matchingAssets!;
    for (const [role, url] of [["still", spot.stillUrl], ["vantage", spot.vantageUrl]] as const) {
      const metadata = assets[role];
      if (metadata.url !== url || !url.startsWith(`/assets/spots/${spot.spotId}/`) || url.includes("..")) {
        throw new Error(`Invalid or stale ${role} URL for ${spot.spotId}`);
      }
      const bytes = fs.readFileSync(path.resolve(__dirname, "..", url.slice(1)));
      if (createHash("sha256").update(bytes).digest("hex") !== metadata.sha256) {
        throw new Error(`Changed ${role} image for ${spot.spotId}: review and refresh asset metadata before exporting`);
      }
      if (metadata.width < 1 || metadata.height < 1 || !/^image\/(jpeg|png|webp)$/.test(metadata.mimeType)) {
        throw new Error(`Invalid ${role} dimensions or MIME type for ${spot.spotId}`);
      }
    }
    return { spotId: spot.spotId, filmTitle: spot.filmTitle, year: spot.year,
      sceneName: spot.sceneName, lat: spot.lat, lng: spot.lng, neighbourhood: spot.neighbourhood,
      stillUrl: spot.stillUrl, vantageUrl: spot.vantageUrl, keywords: spot.keywords,
      mergeRadiusM: spot.mergeRadiusM, matchingAssets: assets };
  });
  return { schemaVersion: 1, generatedAt: new Date().toISOString(),
    imageBaseUrl: "Resolve relative image URLs against your match server origin",
    alignmentValidation: "No pairs have been evaluated by a photo matching model; GPS radius is not image alignment.",
    candidateSpotIds: spots.filter((spot) => spot.matchingAssets.prototypeEligible &&
      spot.matchingAssets.vantage.viewpointQuality === "approximate").map((spot) => spot.spotId),
    excludedPlaceholderSpotIds: catalog.filter((spot) => !spot.matchingAssets).map((spot) => spot.spotId),
    spots };
}
