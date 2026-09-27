import "./config";
import { MongoClient } from "mongodb";
import { fromDocument, type SpotDocument } from "./catalog";

const cache = globalThis as typeof globalThis & {
  movieSpotsClient?: MongoClient;
  movieSpotsConnection?: Promise<MongoClient>;
};

export async function getDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes("<db_password>")) {
    throw new Error("Set MONGODB_URI in the root .env.local before starting or seeding the API.");
  }
  cache.movieSpotsClient ??= new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  cache.movieSpotsConnection ??= cache.movieSpotsClient.connect().catch((error) => {
    cache.movieSpotsConnection = undefined;
    throw error;
  });
  const client = await cache.movieSpotsConnection;
  return client.db(process.env.MONGODB_DB || "movie_spots");
}

export async function loadActiveSpots() {
  const db = await getDatabase();
  const documents = await db.collection<SpotDocument>("spots")
    .find({ active: true }, { projection: { _id: 0 } }).toArray();
  if (!documents.length) throw new Error("No active spots. Run npm run seed:spots before starting the API.");
  return documents.map(fromDocument);
}

export async function closeDatabase() {
  await cache.movieSpotsClient?.close();
  cache.movieSpotsClient = undefined;
  cache.movieSpotsConnection = undefined;
}
