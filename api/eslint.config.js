import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

// API linting: strict, but avoids noisy stylistic rules.
export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Requirements
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Keep TypeScript strictness primarily enforced by `tsc`.
      "@typescript-eslint/no-explicit-any": "off",

      // Low-noise import hygiene
      "no-duplicate-imports": "error",
    },
  }
);
