#!/usr/bin/env bash
# FRAME ONE match service proof script
# Runs end-to-end curl tests against POST /api/match and verifies responses

set -e

API_URL="${API_URL:-http://localhost:3001}"
FAILED=0

echo "=== FRAME ONE Match Service Proof ==="
echo "API: $API_URL"
echo ""

# Test 1: Health check
echo "→ GET /api/health"
HEALTH=$(curl -sf "$API_URL/api/health")
SPOT_COUNT=$(echo "$HEALTH" | jq -r '.spots')
if [[ "$SPOT_COUNT" -ge 1 ]]; then
  echo "✓ Health OK, spots: $SPOT_COUNT"
else
  echo "✗ Health check failed"
  FAILED=1
fi
echo ""

# Test 2: Spots catalog
echo "→ GET /api/spots"
SPOTS=$(curl -sf "$API_URL/api/spots")
CATALOG_COUNT=$(echo "$SPOTS" | jq '.spots | length')
if [[ "$CATALOG_COUNT" -ge 1 ]]; then
  echo "✓ Spots catalog returned $CATALOG_COUNT spots"
else
  echo "✗ Spots catalog failed"
  FAILED=1
fi
echo ""

# Test 3: Match near known spot (mergeOk true)
echo "→ POST /api/match (near tasm2-red-steps with Spider-Man query)"
MATCH_NEAR=$(curl -sf -X POST "$API_URL/api/match" \
  -H "Content-Type: application/json" \
  -d '{"lat": 40.7580, "lng": -73.9855, "movieQuery": "Spider-Man"}')
SPOT_ID=$(echo "$MATCH_NEAR" | jq -r '.spotId')
MERGE_OK=$(echo "$MATCH_NEAR" | jq -r '.mergeOk')
if [[ "$SPOT_ID" == "tasm2-red-steps" ]] && [[ "$MERGE_OK" == "true" ]]; then
  echo "✓ Matched $SPOT_ID, mergeOk: $MERGE_OK"
else
  echo "✗ Expected tasm2-red-steps with mergeOk true, got $SPOT_ID / $MERGE_OK"
  FAILED=1
fi
echo ""

# Test 4: Match far from all spots (mergeOk false)
echo "→ POST /api/match (far from all spots)"
MATCH_FAR=$(curl -sf -X POST "$API_URL/api/match" \
  -H "Content-Type: application/json" \
  -d '{"lat": 40.0, "lng": -74.0}')
FAR_SPOT=$(echo "$MATCH_FAR" | jq -r '.spotId')
FAR_MERGE=$(echo "$MATCH_FAR" | jq -r '.mergeOk')
GO_NEXT_COUNT=$(echo "$MATCH_FAR" | jq '.goNext | length')
if [[ -n "$FAR_SPOT" ]] && [[ "$FAR_MERGE" == "false" ]] && [[ "$GO_NEXT_COUNT" -ge 1 ]]; then
  echo "✓ Matched $FAR_SPOT, mergeOk: $FAR_MERGE, goNext: $GO_NEXT_COUNT"
else
  echo "✗ Expected a match with mergeOk false, got $FAR_SPOT / $FAR_MERGE"
  FAILED=1
fi
echo ""

if [[ $FAILED -eq 0 ]]; then
  echo "=== All proofs passed ✓ ==="
  exit 0
else
  echo "=== Some proofs failed ✗ ==="
  exit 1
fi
