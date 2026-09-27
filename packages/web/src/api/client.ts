import type { MatchRequest, MatchResponse, Spot } from "@frame-one/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export async function postMatch(body: MatchRequest): Promise<MatchResponse> {
  const res = await fetch(`${API_URL}/api/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`match failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<MatchResponse>;
}

export type SpotSummary = Pick<Spot, "spotId" | "neighbourhood" | "lat" | "lng">;

export async function getSpots(): Promise<SpotSummary[]> {
  const res = await fetch(`${API_URL}/api/spots`);
  if (!res.ok) throw new Error(`spots failed (${res.status})`);
  const body = (await res.json()) as { spots: SpotSummary[] };
  return body.spots;
}

export async function getHealth(): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error(`health failed (${res.status})`);
  return res.json();
}

export interface GeocodeSuggestion {
  name: string;
  lat: number;
  lng: number;
}

export async function geocodePlace(query: string): Promise<GeocodeSuggestion[]> {
  if (!query || query.length < 2) return [];
  const res = await fetch(`${API_URL}/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const body = (await res.json()) as { results: GeocodeSuggestion[] };
  return body.results;
}
