import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run against the packages' sources, in a browser-like DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@theplaintheory/consent": fileURLToPath(new URL("./consent/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    // script tags are never fetched in tests; treat them as loaded (the fake SDK stands in)
    environmentOptions: { happyDOM: { settings: { disableJavaScriptFileLoading: true, handleDisabledFileLoadingAsSuccess: true } } },
    include: ["test/**/*.test.{ts,tsx}"],
  },
  // React's automatic JSX runtime (Vite 8 transforms with oxc). Angular is tested through its built package.
  oxc: { jsx: { runtime: "automatic" } },
});
