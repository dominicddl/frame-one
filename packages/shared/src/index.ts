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
