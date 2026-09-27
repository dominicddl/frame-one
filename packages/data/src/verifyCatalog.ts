import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readSeedSpots, toDocument, type SpotDocument } from "./catalog";
import { closeDatabase, getDatabase } from "./mongodb";
import { databaseErrorMessage } from "./databaseError";
import { buildMatchingCatalog } from "./matchingCatalog";

async function verify() {
  try {
    const catalog = readSeedSpots();
    const db = await getDatabase();
    const collection = db.collection<SpotDocument>("spots");
    const documents = await collection.find({}, { projection: { _id: 0 } }).toArray();
    const indexes = await collection.listIndexes().toArray();
    assert.ok(indexes.some((index) => index.key.location === "2dsphere"), "Missing location index");
    assert.ok(indexes.some((index) => index.key.spotId === 1 && index.unique), "Missing unique spotId index");
    assert.equal(new Set(catalog.map((spot) => spot.spotId)).size, catalog.length);
    for (const spot of catalog) {
      const actual = documents.find((document) => document.spotId === spot.spotId);
      assert.ok(actual, `Missing database record: ${spot.spotId}`);
      for (const [key, value] of Object.entries(toDocument(spot))) {
        assert.deepEqual(actual[key as keyof SpotDocument], value, `${spot.spotId}: ${key} differs in Atlas`);
      }
      assert.ok(Number.isFinite(spot.lat) && Math.abs(spot.lat) <= 90);
      assert.ok(Number.isFinite(spot.lng) && Math.abs(spot.lng) <= 180);
      for (const url of [spot.stillUrl, spot.vantageUrl]) {
        assert.ok(url.startsWith("/assets/spots/"));
        assert.ok(fs.statSync(path.resolve(__dirname, "..", url.slice(1))).size > 0, `Empty image: ${url}`);
      }
    }
    const audit = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../data/image-audit.json"), "utf8"));
    const matching = buildMatchingCatalog(catalog);
    for (const entry of audit.includedStills) {
      const spot = catalog.find((candidate) => candidate.spotId === entry.spotId);
      assert.ok(spot);
      const bytes = fs.readFileSync(path.resolve(__dirname, "..", spot.stillUrl.slice(1)));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, `Image changed: ${entry.spotId}`);
    }
    console.log(`Verified ${catalog.length} catalog records against Atlas, both indexes, all asset paths and ${audit.includedStills.length} supplied image hashes.`);
    console.log(`Pending: ${catalog.filter((spot) => spot.stillUrl.endsWith(".svg")).length} placeholder stills; ${catalog.filter((spot) => spot.vantageUrl.endsWith(".svg")).length} placeholder vantage references.`);
    console.log(`Matching handoff: ${matching.spots.length} real pairs; ${matching.candidateSpotIds.length} prototype candidates; alignment not model-validated.`);
  } finally {
    await closeDatabase();
  }
}

verify().catch((error: unknown) => {
  console.error(error instanceof assert.AssertionError ? `Catalog verification failed: ${error.message}` : `Catalog verification failed: ${databaseErrorMessage(error)}`);
  process.exitCode = 1;
});
