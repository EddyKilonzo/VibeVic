import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * Lint config for the Next app.
 *
 * Two deliberate departures from the Vite starter this replaced:
 *  - generated output is ignored. `.next/` contains machine-written route
 *    types full of `any` and `@ts-ignore`; linting them reports 80 problems
 *    nobody can fix and buries the ones in our own code.
 *  - the react-refresh plugin is gone. Its rules encode Vite's HMR contract
 *    ("a module must export only components"), which is not how the App Router
 *    works — a route file legitimately exports `metadata` and the component.
 */
export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "dist/**",
    "next-env.d.ts",
    "node_modules/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Underscore marks an argument that exists to satisfy a signature.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
