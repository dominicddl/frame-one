/** Spot in the curated NYC catalog */
export interface Spot {
  spotId: string;
  filmTitle: string;
  year: number;
  lat: number;
  lng: number;
  neighbourhood: string;
  stillUrl: string;
  vantageUrl: string;
  keywords: string[];
}

/** POST /api/match body */
export interface MatchRequest {
  lat: number;
  lng: number;
  movieQuery?: string;
  photoDataUrl?: string;
}

/** One suggested next destination after unlock */
export interface GoNextItem {
  spotId: string;
  label: string;
  lat: number;
  lng: number;
}

/** POST /api/match response — always a match */
export interface MatchResponse {
  spotId: string;
  filmTitle: string;
  year: number;
  lat: number;
  lng: number;
  stillUrl: string;
  vantageUrl: string;
  mergeOk: boolean;
  goNext: GoNextItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Unlock helpers — localStorage-backed array of spotId strings.
// Designed for easy Mongo swap later (just replace read/write implementation).
// ─────────────────────────────────────────────────────────────────────────────

const UNLOCKS_KEY = "frame_one_unlocks";

/** Demo spotIds for ?demo=1 judging mode */
export const DEMO_UNLOCKS: readonly string[] = [
  "tasm2-red-steps",
  "joker-bronx-stairs",
] as const;

/** Read all unlocked spotIds from localStorage */
export function getUnlocks(): string[] {
  try {
    const raw = localStorage.getItem(UNLOCKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

/** Add a spotId to unlocks (idempotent — won't duplicate) */
export function addUnlock(spotId: string): void {
  const current = getUnlocks();
  if (current.includes(spotId)) return;
  try {
    localStorage.setItem(UNLOCKS_KEY, JSON.stringify([...current, spotId]));
  } catch {
    // localStorage quota or disabled — silently ignore
  }
}

/** Seed demo unlocks (for ?demo=1). Merges without duplicates. */
export function seedDemoUnlocks(): void {
  const current = getUnlocks();
  const merged = [...new Set([...current, ...DEMO_UNLOCKS])];
  try {
    localStorage.setItem(UNLOCKS_KEY, JSON.stringify(merged));
  } catch {
    // silently ignore
  }
}

/** Check if a spotId is unlocked */
export function isUnlocked(spotId: string): boolean {
  return getUnlocks().includes(spotId);
}

/** Clear all unlocks (for testing/reset) */
export function clearUnlocks(): void {
  try {
    localStorage.removeItem(UNLOCKS_KEY);
  } catch {
    // silently ignore
  }
}
