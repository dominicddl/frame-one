# Photo Retrieval Proof & Enablement Guide

## Quick Summary

✅ **No-key GPS fallback**: PROVEN (all tests passing on VM)  
⚠️ **Vision retrieval**: READY (requires `XAI_API_KEY` on Dominic's Grok Bot box)

---

## Architecture

### When Photo + API Key Present
1. Filter candidates by optional `movieQuery`
2. **Vision scoring**: Load catalog stills → xAI Grok API → rank by similarity (0-100)
3. **AI fallback**: If top score < 60, retry with stronger prompt
4. Return best match with `mergeOk` based on score (≥60) OR GPS (≤150m)

### When No Photo OR No API Key
1. Filter candidates by optional `movieQuery`
2. **GPS matching**: Pick nearest spot by haversine distance
3. Return match with `mergeOk` based on GPS distance (≤150m)

---

## Proof: No-Key GPS Fallback (VM)

### Environment
```bash
$ echo $XAI_API_KEY
# (empty - no key on VM)

$ npm run build
# ✅ All packages compile

$ npm run dev:match
# [match] FRAME ONE listening on http://localhost:3001
# [match] 3 spots loaded; mergeOk within 150m or score >=60
# [match] ⚠ No XAI_API_KEY/GROK_API_KEY (GPS fallback only)
```

### Test 1: GPS Near Match
```bash
curl -X POST http://localhost:3001/api/match \
  -H "Content-Type: application/json" \
  -d '{"lat":40.7580,"lng":-73.9855,"movieQuery":"Spider-Man"}'
```

**Result**: ✅ Matched `tasm2-red-steps` with `mergeOk: true`

### Test 2: GPS Far Match
```bash
curl -X POST http://localhost:3001/api/match \
  -H "Content-Type: application/json" \
  -d '{"lat":40.0,"lng":-74.0}'
```

**Result**: ✅ Matched `ghostbusters-firehouse` with `mergeOk: false`

### Test 3: Photo Without Key (GPS Fallback)
```bash
curl -X POST http://localhost:3001/api/match \
  -H "Content-Type: application/json" \
  -d '{"lat":40.7580,"lng":-73.9855,"photoDataUrl":"data:image/png;base64,iVBORw0KGgo="}'
```

**Result**: ✅ Gracefully fell back to GPS, matched `tasm2-red-steps`

**Server log**: `[match] Photo provided but no API key; using GPS fallback`

---

## Enablement: Vision Retrieval (Grok Bot Box)

### Prerequisites
1. Dominic has set `XAI_API_KEY` on Grok Bot box (confirmed)
2. xAI account with access to `grok-vision-beta` model
3. API endpoint: `https://api.x.ai/v1/chat/completions`

### Local Testing Setup

```bash
# Export your xAI API key (either name works)
export XAI_API_KEY="xai-your-key-here"
# OR
export GROK_API_KEY="xai-your-key-here"

# Start server
cd /workspace
npm run dev:match

# Server should now log:
# [match] FRAME ONE listening on http://localhost:3001
# [match] 3 spots loaded; mergeOk within 150m or score >=60
# [match] ✓ Vision API key found
```

### Test With Real Photo

#### Option 1: Convert catalog still to test

```bash
# Convert a catalog still to base64 for testing
PHOTO_BASE64=$(base64 -w 0 packages/data/assets/spots/tasm2-red-steps/still.svg)
PHOTO_URL="data:image/svg+xml;base64,$PHOTO_BASE64"

# Test retrieval (should match tasm2-red-steps with high confidence)
curl -X POST http://localhost:3001/api/match \
  -H "Content-Type: application/json" \
  -d "{\"lat\":40.7580,\"lng\":-73.9855,\"photoDataUrl\":\"$PHOTO_URL\"}"
```

**Expected**:
- Matched spot: `tasm2-red-steps`
- Score: 80-100 (high confidence)
- `mergeOk: true`
- Server log: `[match] Retrieval matched tasm2-red-steps (score: XX, confidence: high, mergeOk: true)`

#### Option 2: Real JPEG photo

```bash
# With a real photo from user's phone
PHOTO_BASE64=$(base64 -w 0 /path/to/times-square-photo.jpg)
PHOTO_URL="data:image/jpeg;base64,$PHOTO_BASE64"

curl -X POST http://localhost:3001/api/match \
  -H "Content-Type: application/json" \
  -d "{\"lat\":40.7580,\"lng\":-73.9855,\"photoDataUrl\":\"$PHOTO_URL\"}"
```

### Expected Behavior With API Key

| Scenario | Retrieval Score | GPS Distance | mergeOk | Reasoning |
|----------|----------------|--------------|---------|-----------|
| Perfect match photo | 80-100 | Any | ✅ true | High confidence retrieval |
| Good match photo | 60-79 | Any | ✅ true | Medium confidence retrieval |
| Uncertain photo | 40-59 | ≤150m | ✅ true | Low retrieval + GPS signal |
| Uncertain photo | 40-59 | >150m | ❌ false | Low retrieval + far GPS |
| Wrong location photo | 0-39 | Any | Uses GPS fallback | Retrieval failed, GPS decides |

### AI Fallback Behavior

When top retrieval score < 60:
1. Server logs: `[retrieve] Top score XX below threshold 60, attempting AI fallback...`
2. Re-run vision scoring with same catalog (second-pass)
3. If fallback score ≥ 50, use fallback result
4. Server logs: `[retrieve] AI fallback improved score to XX`

---

## API Integration

### Vision API Request Format

```typescript
POST https://api.x.ai/v1/chat/completions
Authorization: Bearer $XAI_API_KEY
Content-Type: application/json

{
  "model": "grok-vision-beta",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Rate similarity 0-100..." },
        { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } },
        { "type": "image_url", "image_url": { "url": "data:image/svg+xml;base64,..." } }
      ]
    }
  ],
  "temperature": 0.1,
  "max_tokens": 200
}
```

### Response Format

```json
{
  "choices": [
    {
      "message": {
        "content": "{\"score\": 85, \"reasoning\": \"Clear architectural match\"}"
      }
    }
  ]
}
```

---

## Troubleshooting

### "No content in xAI response"
- Check API key is valid
- Verify `grok-vision-beta` model access
- Check xAI API status

### "xAI API error (401)"
- API key missing or invalid
- Server will fall back to GPS (graceful degradation)

### "xAI API error (429)"
- Rate limit exceeded
- Server will return score: 0 and fall back to GPS

### Vision scoring returns low scores
- Catalog stills may be SVG placeholders (not real photos)
- Replace with actual film stills for better matching
- Tune thresholds based on production data

---

## Files Modified

- `packages/match/src/vision-xai.ts` — xAI Grok API client
- `packages/match/src/retrieve.ts` — Retrieval orchestration
- `packages/match/src/index.ts` — Match endpoint integration
- `packages/match/proof-match.sh` — Extended test suite

## No Breaking Changes

✅ GPS fallback fully preserved  
✅ Existing API shape unchanged  
✅ No edits to `packages/web/` or `packages/data/`  
✅ `packages/shared/` types unchanged  
✅ Demo stays reliable without API key

---

## Next Steps

1. ✅ Deploy to environment with `XAI_API_KEY`
2. 🔄 Test with real user photos vs catalog stills
3. 🔄 Replace SVG placeholders with actual film stills in `packages/data/`
4. 🔄 Tune confidence thresholds based on production data
5. 🔄 Optional: Add vantage scoring (in addition to stills)
6. 🔄 Optional: Add debug fields to response (score, confidence, reasoning)
