import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Resolve the packages from source in this repo, so the example runs without publishing them.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@plaintheory/react": fileURLToPath(new URL("../../packages/react/src/index.tsx", import.meta.url)),
      "@plaintheory/consent": fileURLToPath(new URL("../../packages/consent/src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5173 },
});
