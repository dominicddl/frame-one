#!/usr/bin/env bash
set -euo pipefail

MATCH_URL="${MATCH_URL:-http://localhost:3001}"

echo "=== FRAME ONE Match Proof Script ==="
echo "Testing match server at: $MATCH_URL"
echo ""

# Test 1: Health check
echo "1. GET /api/health"
HEALTH=$(curl -s "$MATCH_URL/api/health")
echo "$HEALTH" | jq .
SERVICE=$(echo "$HEALTH" | jq -r .service)
SPOTS=$(echo "$HEALTH" | jq -r .spots)
if [[ "$SERVICE" != "frame-one-match" ]]; then
  echo "❌ FAIL: Expected service 'frame-one-match', got '$SERVICE'"
  exit 1
fi
if [[ "$SPOTS" -lt 1 ]]; then
  echo "❌ FAIL: Expected spots >= 1, got $SPOTS"
  exit 1
fi
echo "✅ Health check passed: $SPOTS spots loaded"
echo ""

# Test 2: Spots catalog
echo "2. GET /api/spots"
CATALOG=$(curl -s "$MATCH_URL/api/spots")
CATALOG_COUNT=$(echo "$CATALOG" | jq '.spots | length')
echo "Retrieved $CATALOG_COUNT spots"
if [[ "$CATALOG_COUNT" -lt 1 ]]; then
  echo "❌ FAIL: Expected catalog spots >= 1, got $CATALOG_COUNT"
  exit 1
fi
echo "✅ Catalog endpoint passed"
echo ""

# Test 3: Match near tasm2 with Spider-Man query (should get mergeOk: true)
echo "3. POST /api/match near tasm2 (40.7580,-73.9855) with movieQuery 'Spider-Man'"
MATCH_NEAR=$(curl -s -X POST "$MATCH_URL/api/match" \
  -H "Content-Type: application/json" \
  -d '{"lat":40.7580,"lng":-73.9855,"movieQuery":"Spider-Man"}')
echo "$MATCH_NEAR" | jq .
SPOT_ID=$(echo "$MATCH_NEAR" | jq -r .spotId)
MERGE_OK=$(echo "$MATCH_NEAR" | jq -r .mergeOk)
if [[ "$SPOT_ID" != "tasm2-red-steps" ]]; then
  echo "❌ FAIL: Expected spotId 'tasm2-red-steps', got '$SPOT_ID'"
  exit 1
fi
if [[ "$MERGE_OK" != "true" ]]; then
  echo "❌ FAIL: Expected mergeOk true for close match, got $MERGE_OK"
  exit 1
fi
echo "✅ Near match passed: matched $SPOT_ID with mergeOk=true"
echo ""

# Test 4: Match far from all spots (should get mergeOk: false)
echo "4. POST /api/match far (40.0,-74.0) - should get mergeOk: false"
MATCH_FAR=$(curl -s -X POST "$MATCH_URL/api/match" \
  -H "Content-Type: application/json" \
  -d '{"lat":40.0,"lng":-74.0}')
echo "$MATCH_FAR" | jq .
SPOT_ID_FAR=$(echo "$MATCH_FAR" | jq -r .spotId)
MERGE_OK_FAR=$(echo "$MATCH_FAR" | jq -r .mergeOk)
if [[ -z "$SPOT_ID_FAR" ]] || [[ "$SPOT_ID_FAR" == "null" ]]; then
  echo "❌ FAIL: Expected a spot match, got none"
  exit 1
fi
if [[ "$MERGE_OK_FAR" != "false" ]]; then
  echo "❌ FAIL: Expected mergeOk false for far match, got $MERGE_OK_FAR"
  exit 1
fi
echo "✅ Far match passed: matched $SPOT_ID_FAR with mergeOk=false"
echo ""

# Test 5: goNext ranked by distance from matched spot
echo "5. POST /api/match near tasm2 - verify goNext is distance-sorted"
MATCH_GONEXT=$(curl -s -X POST "$MATCH_URL/api/match" \
  -H "Content-Type: application/json" \
  -d '{"lat":40.7580,"lng":-73.9855,"movieQuery":"Spider-Man"}')
echo "$MATCH_GONEXT" | jq .
MATCHED_ID=$(echo "$MATCH_GONEXT" | jq -r .spotId)
FIRST_NEXT=$(echo "$MATCH_GONEXT" | jq -r '.goNext[0].spotId')
SECOND_NEXT=$(echo "$MATCH_GONEXT" | jq -r '.goNext[1].spotId')
if [[ "$MATCHED_ID" != "tasm2-red-steps" ]]; then
  echo "❌ FAIL: Expected matched spotId 'tasm2-red-steps', got '$MATCHED_ID'"
  exit 1
fi
if [[ "$FIRST_NEXT" != "night-museum-steps" ]]; then
  echo "❌ FAIL: Expected first goNext 'night-museum-steps' (3036m), got '$FIRST_NEXT'"
  exit 1
fi
if [[ "$SECOND_NEXT" != "ghostbusters-firehouse" ]]; then
  echo "❌ FAIL: Expected second goNext 'ghostbusters-firehouse' (4635m), got '$SECOND_NEXT'"
  exit 1
fi
echo "✅ goNext ranking passed: ordered by distance from matched spot"
echo "   night-museum-steps (3036m) < ghostbusters-firehouse (4635m)"
echo ""

echo "================================================"
echo "✅ All match proof tests passed!"
echo "================================================"
