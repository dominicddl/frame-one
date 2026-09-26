import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import path from "node:path";

const envPath = path.resolve(__dirname, "../../..", ".env.local");
if (existsSync(envPath)) loadEnvFile(envPath);
