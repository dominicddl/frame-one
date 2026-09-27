import fs from "node:fs";
import path from "node:path";

export const imageRoot = path.resolve(__dirname, "../assets/spots");
export type ImageUrls = Partial<Record<"stillUrl" | "vantageUrl", string>>;

/** Discover supplied photos; existing SVG placeholders are deliberately ignored. */
export function findSpotImages(spotId: string, root = imageRoot): ImageUrls {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spotId)) throw new Error("Invalid spotId folder name");
  const folder = path.join(root, spotId);
  if (!fs.existsSync(folder)) return {};
  const files = fs.readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile());
  const urls: ImageUrls = {};
  for (const role of ["still", "vantage"] as const) {
    const matches = files.filter((entry) => new RegExp(`^${role}\\.(jpg|jpeg|png|webp)$`, "i").test(entry.name));
    if (matches.length > 1) throw new Error(`Keep only one ${role} photo in ${spotId}; multiple formats were found.`);
    if (matches.length === 1) {
      if (fs.statSync(path.join(folder, matches[0].name)).size === 0) throw new Error(`The ${role} photo in ${spotId} is empty.`);
      urls[`${role}Url`] = `/assets/spots/${spotId}/${matches[0].name}`;
    }
  }
  return urls;
}
