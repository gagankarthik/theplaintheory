import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(here, "../../src"),
      "server-only": path.resolve(here, "src/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 90_000,
    // The end-to-end scan launches Chromium; keep files sequential to avoid CPU starvation on CI.
    fileParallelism: false,
  },
});
