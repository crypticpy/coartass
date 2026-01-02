import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Stricter rules for production code handling sensitive audio/transcript data
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "react/no-unescaped-entities": "off",
      "prefer-const": "error",
      // Relax React Compiler rules (new in Next.js 16)
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "OLD_Sites/**",
    ".git-original-*/**",
    "next-env.d.ts",
    "public/ffmpeg-core/**", // Vendor library - don't lint
    "public/workers/**", // Generated/vendor workers (e.g. PDF.js) - don't lint
  ]),
]);

export default eslintConfig;
