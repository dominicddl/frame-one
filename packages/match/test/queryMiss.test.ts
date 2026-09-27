/**
 * Test: garbage/wrong movieQuery at Cap America GPS should return low confidence + suggestions
 * 
 * Bug: Wrong/garbage movieQuery while GPS is at Cap America Times Square coords
 * was returning Cap with confidence "medium", skipping soft-miss.
 * 
 * Expected: If query doesn't match any keywords/films, confidence must be "low"
 * and soft-miss suggestions must be returned.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";

const MATCH_URL = process.env.MATCH_URL || "http://localhost:3001";
const CAP_AMERICA_COORDS = { lat: 40.7590, lng: -73.9845 };

async function postMatch(body: { lat: number; lng: number; movieQuery?: string }) {
  const res = await fetch(`${MATCH_URL}/api/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Match failed: ${res.status}`);
  return res.json();
}

describe("Query miss behavior", () => {
  it("garbage movieQuery at Cap America GPS returns low confidence + suggestions", async () => {
    const result = await postMatch({
      ...CAP_AMERICA_COORDS,
      movieQuery: "asdfghjkl_garbage_12345",
    });

    console.log("Result:", JSON.stringify(result, null, 2));

    // Must be low confidence (not medium) when query doesn't match
    assert.strictEqual(
      result.matchConfidence,
      "low",
      `Expected low confidence for garbage query, got: ${result.matchConfidence}`
    );

    // Must have suggestions for soft-miss UI
    assert.ok(
      Array.isArray(result.suggestions) && result.suggestions.length > 0,
      `Expected suggestions array with items, got: ${JSON.stringify(result.suggestions)}`
    );
  });

  it("wrong film movieQuery at Cap America GPS returns low confidence + suggestions", async () => {
    const result = await postMatch({
      ...CAP_AMERICA_COORDS,
      movieQuery: "Harry Potter", // Real film but not in catalog
    });

    console.log("Result:", JSON.stringify(result, null, 2));

    assert.strictEqual(
      result.matchConfidence,
      "low",
      `Expected low confidence for wrong film query, got: ${result.matchConfidence}`
    );

    assert.ok(
      Array.isArray(result.suggestions) && result.suggestions.length > 0,
      `Expected suggestions for wrong film, got: ${JSON.stringify(result.suggestions)}`
    );
  });

  it("correct movieQuery at Cap America GPS returns medium confidence", async () => {
    const result = await postMatch({
      ...CAP_AMERICA_COORDS,
      movieQuery: "captain america",
    });

    console.log("Result:", JSON.stringify(result, null, 2));

    // Correct query should get medium (GPS close) not low
    assert.strictEqual(
      result.matchConfidence,
      "medium",
      `Expected medium confidence for correct query, got: ${result.matchConfidence}`
    );

    // Should match Cap America
    assert.strictEqual(
      result.spotId,
      "cap-america-times-square",
      `Expected cap-america-times-square, got: ${result.spotId}`
    );
  });

  it("no movieQuery at Cap America GPS returns medium confidence (GPS match)", async () => {
    const result = await postMatch({
      ...CAP_AMERICA_COORDS,
      // No movieQuery - pure GPS match
    });

    console.log("Result:", JSON.stringify(result, null, 2));

    // No query = GPS-only match, should be medium if close
    assert.strictEqual(
      result.matchConfidence,
      "medium",
      `Expected medium confidence for no query (GPS match), got: ${result.matchConfidence}`
    );
  });
});
