import test from "node:test";
import assert from "node:assert/strict";

import { chunk } from "../src/chunk.js";

test("chunk groups items into evenly sized arrays", () => {
  assert.deepEqual(chunk([1, 2, 3, 4], 2), [
    [1, 2],
    [3, 4],
  ]);
});

test("chunk preserves the final partial chunk", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [
    [1, 2],
    [3, 4],
    [5],
  ]);
});
