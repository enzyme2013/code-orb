import test from "node:test";
import assert from "node:assert/strict";

import { createSlug } from "../src/createSlug.js";

test("createSlug normalizes spacing and punctuation", () => {
  assert.equal(createSlug("Hello,   Code Orb!"), "hello-code-orb");
});

test("createSlug removes repeated hyphens", () => {
  assert.equal(createSlug("hello---world"), "hello-world");
});
