import type { MatchRequest, MatchResponse } from "@frame-one/shared";

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

export async function getHealth(): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error(`health failed (${res.status})`);
  return res.json();
}
