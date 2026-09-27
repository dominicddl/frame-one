import { closeDatabase, getDatabase } from "./mongodb";
import { saveCatalogImageUrls, type SpotDocument } from "./catalog";
import { findSpotImages } from "./spotImages";
import { databaseErrorMessage } from "./databaseError";

async function sync() {
  try {
    const db = await getDatabase();
    const collection = db.collection<SpotDocument>("spots");
    const spots = await collection.find({}, { projection: { spotId: 1 } }).toArray();
    if (!spots.length) throw new Error("No active spots");
    // Check every folder before writing, so ambiguous filenames cannot cause a partial sync.
    const updates = spots.map((spot) => ({ spotId: spot.spotId, urls: findSpotImages(spot.spotId) }))
      .filter(({ urls }) => Object.keys(urls).length > 0);
    if (!updates.length) {
      console.log("No photos found. Add still.jpg and/or vantage.jpg to packages/data/assets/spots/<spotId>/ (JPEG, PNG and WebP also supported).");
      return;
    }
    const result = await collection.bulkWrite(updates.map(({ spotId, urls }) => ({ updateOne: {
      filter: { spotId }, update: { $set: urls },
    } })));
    saveCatalogImageUrls(updates);
    for (const { spotId, urls } of updates) console.log(`${spotId}: ${Object.values(urls).join(", ")}`);
    console.log(`Images synced: updated=${result.modifiedCount}, unchanged=${result.matchedCount - result.modifiedCount}. Restart the API to reload URLs.`);
  } finally {
    await closeDatabase();
  }
}

sync().catch((error: unknown) => {
  // Only local validation errors may be printed verbatim; never raw driver errors.
  const message = error instanceof Error && /^(Keep only one |The (still|vantage) photo |Invalid spotId folder name)/.test(error.message)
    ? error.message : databaseErrorMessage(error);
  console.error(`Image sync failed. ${message}`);
  process.exitCode = 1;
});
