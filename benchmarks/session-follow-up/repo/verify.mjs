import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("./README.md", import.meta.url), "utf8");

if (!readme.includes("Hello, Code Orb!")) {
  console.error("README.md was not updated.");
  process.exit(1);
}

console.log("verification passed");
