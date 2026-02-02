import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "lib/generated/**",
      "next-env.d.ts",
      "prisma/seed.js",
      "prisma/seed-rules.js",
    ],
  },
  // Project-wide rule tuning:
  // - We keep lint strict on correctness, but downgrade some legacy typing rules to WARN
  //   so the pipeline doesn't fail while we incrementally harden types.
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "warn",
    },
  },
];

export default config;
