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

/** Soft-miss suggestion when match confidence is low */
export interface SoftMissSuggestion {
  spotId: string;
  filmTitle: string;
  neighbourhood: string;
  distanceM: number;
  reason: "nearby" | "same-neighbourhood" | "same-film";
}

/** Match confidence level for web to determine UI behavior */
export type MatchConfidence = "high" | "medium" | "low";

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
  /** Match confidence - web can show alternative suggestions when low */
  matchConfidence?: MatchConfidence;
  /** Curated alternatives when matchConfidence is low; prefer these over barren miss UI */
  suggestions?: SoftMissSuggestion[];
}
