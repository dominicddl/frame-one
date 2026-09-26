/**
 * xAI Grok Vision API client for photo similarity scoring
 * Uses grok-vision-beta model via https://api.x.ai/v1/chat/completions
 */

export interface VisionScoreResult {
  score: number;
  reasoning?: string;
}

const XAI_API_BASE = "https://api.x.ai/v1";
const XAI_MODEL = "grok-vision-beta";

function getApiKey(): string | undefined {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY;
}

export function hasVisionApiKey(): boolean {
  return !!getApiKey();
}

export async function scorePhotoSimilarity(
  userPhotoDataUrl: string,
  referencePhotoDataUrl: string,
  spotContext: string
): Promise<VisionScoreResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("XAI_API_KEY or GROK_API_KEY environment variable not set");
  }

  const prompt = `You are a precise visual similarity scorer for film location matching.

Compare these two photos:
1. USER PHOTO: A photo the user just took at a location
2. REFERENCE: The official film still/vantage for: ${spotContext}

Rate the similarity from 0-100:
- 80-100: Clearly the same location, matching architectural features
- 60-79: Likely the same location, recognizable elements
- 40-59: Similar style/area but uncertain match
- 20-39: Different location or very poor match
- 0-19: Completely different

Respond ONLY with JSON: {"score": number, "reasoning": "brief explanation"}`;

  try {
    const response = await fetch(`${XAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: userPhotoDataUrl } },
              { type: "image_url", image_url: { url: referencePhotoDataUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`xAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in xAI response");
    }

    const parsed = JSON.parse(content.trim());
    return {
      score: Number(parsed.score) || 0,
      reasoning: parsed.reasoning,
    };
  } catch (err) {
    console.error("[vision-xai] Error scoring similarity:", err);
    return { score: 0, reasoning: `Error: ${err}` };
  }
}

export async function rankSpotsByPhotoSimilarity(
  userPhotoDataUrl: string,
  candidateSpots: Array<{
    spotId: string;
    filmTitle: string;
    referenceDataUrl: string;
  }>
): Promise<Array<{ spotId: string; score: number; reasoning?: string }>> {
  const results = await Promise.all(
    candidateSpots.map(async (spot) => {
      const result = await scorePhotoSimilarity(
        userPhotoDataUrl,
        spot.referenceDataUrl,
        `${spot.filmTitle} (${spot.spotId})`
      );
      return {
        spotId: spot.spotId,
        score: result.score,
        reasoning: result.reasoning,
      };
    })
  );

  return results.sort((a, b) => b.score - a.score);
}
