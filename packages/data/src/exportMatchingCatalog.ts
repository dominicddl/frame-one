import fs from "node:fs";
import path from "node:path";
import { readSeedSpots } from "./catalog";
import { buildMatchingCatalog } from "./matchingCatalog";

try {
  const manifest = buildMatchingCatalog(readSeedSpots());
  fs.writeFileSync(path.resolve(__dirname, "../assets/spots/matching-catalog.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Exported ${manifest.spots.length} real image pairs; ${manifest.candidateSpotIds.length} prototype candidates. Model accuracy and alignment remain unvalidated.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Matching catalog export failed");
  process.exitCode = 1;
}
