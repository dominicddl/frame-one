import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findSpotImages } from "../src/spotImages";

test("photo discovery preserves missing roles and rejects ambiguous or empty files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "frame-one-images-"));
  const folder = path.join(root, "demo-spot");
  try {
    assert.deepEqual(findSpotImages("demo-spot", root), {});
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, "still.svg"), "placeholder");
    assert.deepEqual(findSpotImages("demo-spot", root), {});
    fs.writeFileSync(path.join(folder, "still.JPG"), "test fixture");
    assert.deepEqual(findSpotImages("demo-spot", root), { stillUrl: "/assets/spots/demo-spot/still.JPG" });
    fs.writeFileSync(path.join(folder, "vantage.webp"), "test fixture");
    assert.equal(findSpotImages("demo-spot", root).vantageUrl, "/assets/spots/demo-spot/vantage.webp");
    fs.writeFileSync(path.join(folder, "still.png"), "test fixture");
    assert.throws(() => findSpotImages("demo-spot", root), /Keep only one still/);
    fs.unlinkSync(path.join(folder, "still.png"));
    fs.writeFileSync(path.join(folder, "still.JPG"), "");
    assert.throws(() => findSpotImages("demo-spot", root), /empty/);
    assert.throws(() => findSpotImages("../escape", root), /Invalid spotId/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
