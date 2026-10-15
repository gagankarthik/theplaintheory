import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: true,
  // The dashboard modules this worker reuses (../../src/lib) are compiled into the bundle together
  // with their AWS SDK imports, so the image needs only puppeteer at runtime.
  noExternal: [/^@aws-sdk\//],
  external: ["puppeteer"],
  // ESM bundles still meet CommonJS dependencies that call require().
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  esbuildOptions(options) {
    options.alias = {
      "@": path.resolve(here, "../../src"),
      "server-only": path.resolve(here, "src/stubs/server-only.ts"),
    };
    // App modules live outside this package; resolve their dependencies from here as a fallback so
    // the build works without the dashboard's node_modules (Docker image).
    options.nodePaths = [path.resolve(here, "node_modules")];
  },
});
