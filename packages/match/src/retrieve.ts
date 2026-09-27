/**
 * Photo retrieval logic for matching user photos to catalog spots
 */

import fs from "fs";
import path from "path";
import type { Spot } from "@frame-one/shared";
import {
  hasVisionApiKey,
  rankSpotsByPhotoSimilarity,
  forcedChoiceFallback,
} from "./vision-openai";

const RETRIEVAL_CONFIDENCE_THRESHOLD = 60;

export interface RetrievalResult {
  spotId: string;
  score: number;
  confidence: "high" | "medium" | "low";
  usedFallback: boolean;
  reasoning?: string;
}

function resolveStillPath(stillUrl: string, dataPackageDir: string): string {
  const cleanPath = stillUrl.replace(/^\//, "");
  
  const absolutePath = path.join(dataPackageDir, cleanPath);
  
  if (fs.existsSync(absolutePath)) {
    return absolutePath;
  }
  
  const legacyPath = path.join(dataPackageDir, "assets", "spots", path.dirname(cleanPath), "still.svg");
  if (fs.existsSync(legacyPath)) {
    return legacyPath;
  }
  
  return absolutePath;
}

function loadImageAsDataUrl(assetPath: string): string {
  try {
    if (!fs.existsSync(assetPath)) {
      console.error(`[retrieve] File not found: ${assetPath}`);
      return "";
    }

    const buffer = fs.readFileSync(assetPath);
    const ext = path.extname(assetPath).toLowerCase();
    
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };

    const mime = mimeMap[ext] || "image/png";
    const base64 = buffer.toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.error(`[retrieve] Failed to load image ${assetPath}:`, err);
    return "";
  }
}

export async function retrieveSpotByPhoto(
  userPhotoDataUrl: string,
  candidates: Spot[],
  dataPackageDir: string
): Promise<RetrievalResult | null> {
  if (!hasVisionApiKey()) {
    console.log("[retrieve] No vision API key; skipping photo retrieval");
    return null;
  }

  if (!userPhotoDataUrl || candidates.length === 0) {
    return null;
  }

  const candidatesWithImages = candidates
    .map((spot) => {
      const stillPath = resolveStillPath(spot.stillUrl, dataPackageDir);
      const stillDataUrl = loadImageAsDataUrl(stillPath);
      
      if (!stillDataUrl) {
        return null;
      }

      return {
        spotId: spot.spotId,
        filmTitle: spot.filmTitle,
        referenceDataUrl: stillDataUrl,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  if (candidatesWithImages.length === 0) {
    console.log("[retrieve] No valid reference images found");
    return null;
  }

  console.log(
    `[retrieve] Scoring user photo against ${candidatesWithImages.length} catalog stills...`
  );

  const ranked = await rankSpotsByPhotoSimilarity(
    userPhotoDataUrl,
    candidatesWithImages
  );

  if (ranked.length === 0) {
    return null;
  }

  const topMatch = ranked[0];
  const topScore = topMatch.score;

  let confidence: "high" | "medium" | "low" = "low";
  if (topScore >= 80) {
    confidence = "high";
  } else if (topScore >= 60) {
    confidence = "medium";
  }

  if (topScore < RETRIEVAL_CONFIDENCE_THRESHOLD) {
    console.log(
      `[retrieve] Top score ${topScore} below threshold ${RETRIEVAL_CONFIDENCE_THRESHOLD}, attempting forced-choice fallback...`
    );
    
    const fallbackResult = await forcedChoiceFallback(
      userPhotoDataUrl,
      candidatesWithImages
    );

    if (fallbackResult) {
      console.log(
        `[retrieve] Forced-choice fallback selected ${fallbackResult.spotId}`
      );
      return {
        spotId: fallbackResult.spotId,
        score: 50,
        confidence: "medium",
        usedFallback: true,
        reasoning: fallbackResult.reasoning,
      };
    }
  }

  return {
    spotId: topMatch.spotId,
    score: topScore,
    confidence,
    usedFallback: false,
    reasoning: topMatch.reasoning,
  };
}
