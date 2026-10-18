import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Built SDK bundle and the separately-managed CDK app
    "public/sdk/**",
    "infra/**",
    // Separately-managed crawler service (own package.json) and static test fixtures
    "services/**",
    "examples/**",
    // Framework packages: their own workspace, toolchain and build output (packages/package.json)
    "packages/**",
  ]),
]);

export default eslintConfig;
