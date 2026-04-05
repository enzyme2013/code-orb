import { readFile } from "node:fs/promises";

const content = await readFile(new URL("./README.md", import.meta.url), "utf8");

if (!content.includes("Hello, Code Orb!")) {
  console.error("Expected README.md to include the replacement text.");
  process.exit(1);
}

console.error("Verification still fails after the edit.");
process.exit(1);
