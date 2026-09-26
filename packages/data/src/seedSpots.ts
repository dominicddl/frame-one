import { readSeedSpots, saveCatalogImageUrls, toDocument, type SpotDocument } from "./catalog";
import { closeDatabase, getDatabase } from "./mongodb";
import { databaseErrorMessage } from "./databaseError";
import { findSpotImages } from "./spotImages";

async function seed() {
  try {
    const db = await getDatabase();
    const spots = db.collection<SpotDocument>("spots");
    await spots.createIndex({ spotId: 1 }, { unique: true });
    await spots.createIndex({ location: "2dsphere" });
    const catalog = readSeedSpots().map((spot) => ({ ...spot, ...findSpotImages(spot.spotId) }));
    const result = await spots.bulkWrite(catalog.map((spot) => ({ updateOne: {
      filter: { spotId: spot.spotId }, update: { $set: toDocument(spot) }, upsert: true,
    } })));
    saveCatalogImageUrls(catalog.map(({ spotId, stillUrl, vantageUrl }) => ({ spotId, urls: { stillUrl, vantageUrl } })));
    console.log(`Seed complete: inserted=${result.upsertedCount}, updated=${result.modifiedCount}, unchanged=${result.matchedCount - result.modifiedCount}`);
  } finally {
    await closeDatabase();
  }
}

seed().catch((error: unknown) => {
  console.error(`Seed failed. ${databaseErrorMessage(error)}`);
  process.exitCode = 1;
});
