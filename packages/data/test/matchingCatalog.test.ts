import test from "node:test";
import assert from "node:assert/strict";
import { readSeedSpots } from "../src/catalog";
import { buildMatchingCatalog } from "../src/matchingCatalog";

test("matching handoff excludes placeholders and context-only photos from candidates", () => {
  const manifest = buildMatchingCatalog(readSeedSpots());
  assert.equal(manifest.spots.length, 7);
  assert.equal(manifest.candidateSpotIds.length, 5);
  assert.ok(!manifest.candidateSpotIds.includes("home-alone-battery-park"));
  assert.ok(!manifest.candidateSpotIds.includes("devil-wears-prada-fifth-avenue"));
  assert.ok(!manifest.spots.some((spot) => spot.spotId === "ghostbusters-firehouse"));
  assert.ok(manifest.spots.every((spot) => !spot.matchingAssets.alignmentValidated));
});

test("stale asset metadata cannot be silently exported", () => {
  const catalog = readSeedSpots();
  catalog[0].matchingAssets!.vantage.sha256 = "stale";
  assert.throws(() => buildMatchingCatalog(catalog), /Changed vantage image/);
});
