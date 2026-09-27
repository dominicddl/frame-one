import type { Spot } from "@frame-one/shared";
import fs from "node:fs";
import path from "node:path";
import type { ImageUrls } from "./spotImages";

export interface CatalogSpot extends Spot {
  sceneName: string;
  mergeRadiusM: number;
  active: boolean;
  matchingAssets?: {
    still: { url: string; width: number; height: number; mimeType: string; sha256: string; source: string; rightsStatus: string };
    vantage: {
      url: string; width: number; height: number; mimeType: string; sha256: string;
      title: string; sourcePage: string; originalUrl: string; downloadUrl: string;
      author: string; license: string; licenseUrl: string; capturedAt: string; retrievedAt: string; changes: string;
      viewpointQuality: "approximate" | "context-only";
      viewpointNotes: string;
    };
    prototypeEligible: boolean;
    alignmentValidated: boolean;
  };
}
export type SpotDocument = Omit<CatalogSpot, "lat" | "lng"> & {
  location: { type: "Point"; coordinates: [number, number] };
};

export function readSeedSpots(): CatalogSpot[] {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/spots.json"), "utf8"));
}

/** Keep the JSON catalog consumed by the match server in sync with Atlas URLs. */
export function saveCatalogImageUrls(updates: { spotId: string; urls: ImageUrls }[]) {
  const byId = new Map(updates.map(({ spotId, urls }) => [spotId, urls]));
  const spots = readSeedSpots().map((spot) => ({ ...spot, ...byId.get(spot.spotId) }));
  const target = path.resolve(__dirname, "../data/spots.json");
  fs.writeFileSync(target, JSON.stringify(spots, null, 2) + "\n");
}

export function toDocument({ lat, lng, ...spot }: CatalogSpot): SpotDocument {
  return { ...spot, location: { type: "Point", coordinates: [lng, lat] } };
}

export function fromDocument(document: SpotDocument): CatalogSpot {
  const { location, ...spot } = document;
  return { ...spot, lng: location.coordinates[0], lat: location.coordinates[1] };
}
