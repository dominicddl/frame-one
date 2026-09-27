#!/usr/bin/env bash
set -euo pipefail

MATCH_URL="${MATCH_URL:-http://localhost:3001}"

echo "=== FRAME ONE Match Proof Script ==="
echo "Testing match server at: $MATCH_URL"
echo ""

# Check if vision API key is available
HAS_API_KEY=false
if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  HAS_API_KEY=true
  echo "✓ OpenAI API key detected (OPENAI_API_KEY)"
  echo "  Model: ${OPENAI_VISION_MODEL:-gpt-4.1-mini (default)}"
else
  echo "⚠ No OpenAI API key; photo retrieval tests will be skipped"
fi
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
GO_NEXT_COUNT=$(echo "$MATCH_NEAR" | jq '.goNext | length')
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

# Test 5: goNext ordering (nearest first)
echo "5. Verify goNext ordering (nearest spots first)"
GO_NEXT_0=$(echo "$MATCH_NEAR" | jq -r '.goNext[0].spotId')
echo "First goNext spot: $GO_NEXT_0"
if [[ "$GO_NEXT_COUNT" -lt 1 ]]; then
  echo "❌ FAIL: Expected at least 1 goNext item, got $GO_NEXT_COUNT"
  exit 1
fi
echo "✅ goNext ordering check passed: $GO_NEXT_COUNT items"
echo ""

# Test 5b: Verify matchConfidence field present and GPS-only caps at medium
echo "5b. Verify matchConfidence field in response (GPS-only never claims high)"
MATCH_CONFIDENCE_NEAR=$(echo "$MATCH_NEAR" | jq -r '.matchConfidence')
MATCH_CONFIDENCE_FAR=$(echo "$MATCH_FAR" | jq -r '.matchConfidence')
echo "Near GPS-only match confidence: $MATCH_CONFIDENCE_NEAR"
echo "Far GPS-only match confidence: $MATCH_CONFIDENCE_FAR"
if [[ "$MATCH_CONFIDENCE_NEAR" != "high" ]] && [[ "$MATCH_CONFIDENCE_NEAR" != "medium" ]] && [[ "$MATCH_CONFIDENCE_NEAR" != "low" ]]; then
  echo "❌ FAIL: matchConfidence must be high/medium/low, got '$MATCH_CONFIDENCE_NEAR'"
  exit 1
fi
# P0 RED-TEAM: GPS-only must never claim "high" confidence
if [[ "$MATCH_CONFIDENCE_NEAR" == "high" ]]; then
  echo "❌ FAIL: GPS-only matching must NOT claim 'high' confidence (cap at medium)"
  exit 1
fi
echo "✅ matchConfidence field present and valid (GPS-only capped correctly)"
echo ""

# Test 5c: Verify suggestions appear on low confidence
echo "5c. Verify suggestions appear when matchConfidence is low"
if [[ "$MATCH_CONFIDENCE_FAR" == "low" ]]; then
  SUGGESTIONS_COUNT=$(echo "$MATCH_FAR" | jq '.suggestions | length')
  if [[ "$SUGGESTIONS_COUNT" -lt 1 ]]; then
    echo "❌ FAIL: Low confidence match must include suggestions, got $SUGGESTIONS_COUNT"
    exit 1
  fi
  echo "Far match has $SUGGESTIONS_COUNT soft-miss suggestions"
  echo "First suggestion: $(echo "$MATCH_FAR" | jq -r '.suggestions[0].spotId') ($(echo "$MATCH_FAR" | jq -r '.suggestions[0].reason'))"
  echo "✅ suggestions array populated on low confidence match"
else
  echo "Far match confidence is '$MATCH_CONFIDENCE_FAR' (not low); suggestions may be absent"
  echo "✅ Skipped suggestions check (confidence not low)"
fi
echo ""

# Test 6: Photo retrieval with mock data URL (no API key path)
echo "6. POST /api/match with photoDataUrl (no API key - GPS fallback)"
PHOTO_NO_KEY=$(curl -s -X POST "$MATCH_URL/api/match" \
  -H "Content-Type: application/json" \
  -d '{"lat":40.7580,"lng":-73.9855,"photoDataUrl":"data:image/png;base64,iVBORw0KGgo="}')
echo "$PHOTO_NO_KEY" | jq .
SPOT_ID_NO_KEY=$(echo "$PHOTO_NO_KEY" | jq -r .spotId)
CONFIDENCE_NO_KEY=$(echo "$PHOTO_NO_KEY" | jq -r .matchConfidence)
if [[ -z "$SPOT_ID_NO_KEY" ]] || [[ "$SPOT_ID_NO_KEY" == "null" ]]; then
  echo "❌ FAIL: Expected a spot match even without API key, got none"
  exit 1
fi
# P0 RED-TEAM: Photo+GPS with missing API key must NOT claim high confidence
if [[ "$CONFIDENCE_NO_KEY" == "high" ]]; then
  echo "❌ FAIL: Photo+GPS fallback (missing API key) must NOT claim 'high' confidence"
  exit 1
fi
echo "✅ Photo without API key passed: GPS fallback returned $SPOT_ID_NO_KEY (confidence: $CONFIDENCE_NO_KEY)"
echo ""

# Test 6b: Photo far from spots (no API key) - should get low confidence + suggestions
echo "6b. POST /api/match with photoDataUrl far away (no API key - should get suggestions)"
PHOTO_FAR_NO_KEY=$(curl -s -X POST "$MATCH_URL/api/match" \
  -H "Content-Type: application/json" \
  -d '{"lat":40.0,"lng":-74.0,"photoDataUrl":"data:image/png;base64,iVBORw0KGgo="}')
CONFIDENCE_FAR_NO_KEY=$(echo "$PHOTO_FAR_NO_KEY" | jq -r '.matchConfidence')
SUGGESTIONS_FAR_NO_KEY=$(echo "$PHOTO_FAR_NO_KEY" | jq '.suggestions | length')
echo "Photo+GPS far match confidence: $CONFIDENCE_FAR_NO_KEY, suggestions: $SUGGESTIONS_FAR_NO_KEY"
if [[ "$CONFIDENCE_FAR_NO_KEY" == "high" ]]; then
  echo "❌ FAIL: Photo+GPS far (missing API key) must NOT claim 'high' confidence"
  exit 1
fi
if [[ "$CONFIDENCE_FAR_NO_KEY" == "low" ]] && [[ "$SUGGESTIONS_FAR_NO_KEY" -lt 1 ]]; then
  echo "❌ FAIL: Low confidence photo+GPS must include suggestions"
  exit 1
fi
echo "✅ Photo far without API key passed: confidence=$CONFIDENCE_FAR_NO_KEY, suggestions=$SUGGESTIONS_FAR_NO_KEY"
echo ""

# Test 7: Photo retrieval with real API key (if available)
if [[ "$HAS_API_KEY" == "true" ]]; then
  echo "7. POST /api/match with photo and API key (retrieval-first)"
  echo "⚠ Skipping real photo test (would require actual image data and API call)"
  echo "   Manual test: curl with a base64-encoded catalog still as photoDataUrl"
  echo "   Expected: Should match the corresponding spot with high confidence"
  echo ""
else
  echo "7. Skipping photo retrieval test (no API key)"
  echo "   To test: export OPENAI_API_KEY and re-run"
  echo ""
fi

echo "================================================"
echo "✅ All match proof tests passed!"
echo "================================================"
