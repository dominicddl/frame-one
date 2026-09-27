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

/**
 * Soft-miss suggestion when match confidence is low.
 * 
 * WEB INTEGRATION: When `matchConfidence` is "low", the API provides curated
 * alternatives in `suggestions`. Show these to the user instead of a barren
 * "no match" screen. Example UI: "Did you mean...?" or "Nearby film locations:"
 */
export interface SoftMissSuggestion {
  spotId: string;
  filmTitle: string;
  neighbourhood: string;
  /** Distance from user's GPS position in meters */
  distanceM: number;
  /** Why this spot is suggested: nearby, same area, or same film */
  reason: "nearby" | "same-neighbourhood" | "same-film";
}

/**
 * Match confidence level for web to determine UI behavior.
 * 
 * - "high": Vision matched with strong score (≥80). Safe to show merge UI.
 * - "medium": Vision matched with moderate score, or GPS-only close match.
 *             Consider showing "Confirm this location?" prompt.
 * - "low": Weak or GPS-only distant match. MUST check `suggestions` array
 *          and show alternatives to avoid barren miss UX.
 * 
 * NOTE: GPS-only matching (no photo or missing OPENAI_API_KEY) caps at "medium".
 * Only vision-verified matches can claim "high" confidence.
 */
export type MatchConfidence = "high" | "medium" | "low";

/**
 * POST /api/match response — always returns a match (never empty).
 * 
 * WEB INTEGRATION GUIDE:
 * ──────────────────────
 * 1. Always check `matchConfidence` to determine UI flow:
 *    - "high" → proceed with merge/unlock
 *    - "medium" → show confirmation prompt
 *    - "low" → show `suggestions` as alternatives (REQUIRED)
 * 
 * 2. `suggestions` vs `goNext`:
 *    - `goNext`: Always present. Nearest spots for "where to go next" after unlock.
 *    - `suggestions`: Only present when confidence is low. Curated alternatives
 *      (nearby, same-neighbourhood, same-film) for soft-miss recovery UI.
 * 
 * 3. Soft-miss UI must read BOTH `suggestions` AND `matchConfidence`.
 *    Do NOT rely solely on `goNext` for error recovery — it serves a different purpose.
 */
export interface MatchResponse {
  spotId: string;
  filmTitle: string;
  year: number;
  lat: number;
  lng: number;
  stillUrl: string;
  vantageUrl: string;
  /** True if photo can be merged (close GPS or high vision score) */
  mergeOk: boolean;
  /** Nearest spots for "where to go next" UI after unlock */
  goNext: GoNextItem[];
  /**
   * Match confidence level. Web MUST handle all three values:
   * - "high": safe to merge
   * - "medium": confirm with user
   * - "low": show `suggestions` as alternatives
   */
  matchConfidence?: MatchConfidence;
  /**
   * Curated alternatives when `matchConfidence` is "low".
   * Web MUST display these for soft-miss recovery — do not show barren miss UI.
   * Includes nearby spots, same-neighbourhood spots, and same-film spots.
   */
  suggestions?: SoftMissSuggestion[];
}
