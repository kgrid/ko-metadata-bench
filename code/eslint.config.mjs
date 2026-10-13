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
    // Generated editions, build output, and unpacked KO archives are not SWA source.
    "outputs/**",
    "public/**",
    "work/**",
    "dist/**",
    ".vinext/**",
    ".wrangler/**",
    ".playwright-browsers/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
