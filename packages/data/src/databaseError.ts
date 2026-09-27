/** Return only fixed diagnostic text: driver messages can contain credentials. */
export function databaseErrorMessage(error: unknown): string {
  const value = error as { name?: string; code?: number | string; message?: string } | null;
  const message = typeof value?.message === "string" ? value.message : "";
  if (value?.code === 18 || /authentication|bad auth/i.test(message)) {
    return "Atlas authentication failed. Check the DATABASE user's username/password (not your Atlas login), URL-encode special characters in the password, and check authSource in MONGODB_URI.";
  }
  if (/Set MONGODB_URI/.test(message)) return "Set a real MONGODB_URI in the repository root .env.local.";
  if (value?.name === "MongoParseError" || value?.name === "MongoInvalidArgumentError") {
    return "Invalid MongoDB connection configuration. Check the URI format and URL-encoding of credentials.";
  }
  if (value?.code === 13) return "Database permission denied. Grant the database user readWrite access to MONGODB_DB.";
  if (value?.code === 11000) return "Duplicate spotId values prevent creating the unique index. Check existing spots.";
  if (value?.code === 85 || value?.code === 86) return "An existing index conflicts with the requested seed index. Check the spots collection indexes.";
  if (/querySrv|ENOTFOUND|ECONNREFUSED/.test(message)) return "MongoDB DNS/network lookup failed. Check the Atlas hostname and network connection.";
  if (value?.name === "MongoServerSelectionError") return "Cannot reach MongoDB. Check Atlas Network Access for this machine's IP, cluster availability, and firewall/TLS settings.";
  if (/No active spots/.test(message)) return "No active spots found. Run npm run seed:spots before starting the API.";
  return "Database operation failed. Check Atlas connectivity, database permissions, and the seed catalog. Connection details are withheld.";
}
