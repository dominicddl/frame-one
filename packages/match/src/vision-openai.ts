/**
 * OpenAI Vision API client for photo similarity scoring
 * Uses gpt-4o model via https://api.openai.com/v1/chat/completions
 */

export interface VisionScoreResult {
  score: number;
  reasoning?: string;
}

const OPENAI_API_BASE = "https://api.openai.com/v1";
const OPENAI_MODEL = "gpt-4o";

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

export function hasVisionApiKey(): boolean {
  return !!getApiKey();
}

function parseJsonResponse(content: string): { score: number; reasoning?: string } {
  let cleaned = content.trim();
  
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  
  try {
    const parsed = JSON.parse(cleaned);
    return {
      score: Number(parsed.score) || 0,
      reasoning: parsed.reasoning,
    };
  } catch (err) {
    console.error("[vision-openai] JSON parse failed:", err, "Content:", content);
    return { score: 0, reasoning: "Parse error" };
  }
}

export async function scorePhotoSimilarity(
  userPhotoDataUrl: string,
  referencePhotoDataUrl: string,
  spotContext: string
): Promise<VisionScoreResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable not set");
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
    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
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
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    return parseJsonResponse(content);
  } catch (err) {
    console.error("[vision-openai] Error scoring similarity:", err);
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

export async function forcedChoiceFallback(
  userPhotoDataUrl: string,
  candidateSpots: Array<{
    spotId: string;
    filmTitle: string;
    referenceDataUrl: string;
  }>
): Promise<{ spotId: string; reasoning?: string } | null> {
  const apiKey = getApiKey();
  if (!apiKey || candidateSpots.length === 0) {
    return null;
  }

  const spotsList = candidateSpots
    .map((s, i) => `${i + 1}. ${s.spotId}: ${s.filmTitle}`)
    .join("\n");

  const prompt = `You are helping match a user's photo to one of these ${candidateSpots.length} NYC film locations:

${spotsList}

The user photo is shown. You MUST pick the single best matching location from the list above.

Respond ONLY with JSON: {"spotId": "exact-spotId-from-list", "reasoning": "brief explanation"}`;

  try {
    const allImages = [
      { type: "image_url" as const, image_url: { url: userPhotoDataUrl } },
      ...candidateSpots.map((spot) => ({
        type: "image_url" as const,
        image_url: { url: spot.referenceDataUrl },
      })),
    ];

    const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, ...allImages],
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = parseJsonResponse(content);
    const chosenSpotId = (parsed as any).spotId;
    
    if (!chosenSpotId || !candidateSpots.find((s) => s.spotId === chosenSpotId)) {
      console.error("[vision-openai] Forced choice returned invalid spotId:", chosenSpotId);
      return null;
    }

    return {
      spotId: chosenSpotId,
      reasoning: parsed.reasoning || (parsed as any).reasoning,
    };
  } catch (err) {
    console.error("[vision-openai] Forced choice fallback error:", err);
    return null;
  }
}
