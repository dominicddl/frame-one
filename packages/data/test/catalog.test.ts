import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readSeedSpots, fromDocument, toDocument } from "../src/catalog";

test("migrated catalog retains GeoJSON coordinates and resolves every image", () => {
  const spots = readSeedSpots();
  assert.ok(spots.length >= 3);
  assert.equal(new Set(spots.map((spot) => spot.spotId)).size, spots.length);
  for (const spot of spots) {
    assert.deepEqual(toDocument(spot).location.coordinates, [spot.lng, spot.lat]);
    assert.deepEqual(fromDocument(toDocument(spot)), spot);
    for (const url of [spot.stillUrl, spot.vantageUrl]) {
      assert.ok(url.startsWith("/assets/spots/"));
      assert.ok(fs.existsSync(path.resolve(__dirname, "..", url.slice(1))));
    }
  }
});
