import test from "node:test";
import assert from "node:assert/strict";
import { databaseErrorMessage } from "../src/databaseError";

test("Atlas authentication errors are actionable without leaking driver text", () => {
  const result = databaseErrorMessage({ code: 8000, message: "bad auth : authentication failed mongodb://user:secret@example.com" });
  assert.match(result, /Atlas authentication failed/);
  assert.ok(!result.includes("secret"));
  assert.ok(!result.includes("example.com"));
});

test("unknown errors never echo connection details", () => {
  for (const error of [null, undefined, "secret", { message: "mongodb://user:secret@example.com" }]) {
    assert.ok(!databaseErrorMessage(error).includes("secret"));
  }
  assert.match(databaseErrorMessage({ code: 13 }), /permission denied/);
  assert.match(databaseErrorMessage({ name: "MongoServerSelectionError" }), /Network Access/);
});
