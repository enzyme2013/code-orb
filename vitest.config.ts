import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { defineConfig } from "vitest/config";

const ROOT = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@code-orb/core": resolve(ROOT, "packages/core/src/index.ts"),
      "@code-orb/schemas": resolve(ROOT, "packages/schemas/src/index.ts"),
      "@code-orb/shared": resolve(ROOT, "packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      enabled: false,
    },
  },
});
