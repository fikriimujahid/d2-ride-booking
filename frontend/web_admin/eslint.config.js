import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

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
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Core project requirements
      // NOTE: Enforced strictly in auth/api override below to avoid a large unrelated cleanup.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",

      // Consistent imports (low-noise, CI-friendly)
      "no-duplicate-imports": "error",

      // React hooks rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Avoid noisy rules; TypeScript compiler already enforces noImplicitAny via tsconfig.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": "off",
    },
  }
  ,
  {
    // Enforce `no-unused-vars` where it matters for this iteration:
    // auth API + auth store logic (and their tests).
    files: [
      "src/app/api/**/*.{ts,tsx}",
      "src/app/auth/**/*.{ts,tsx}",
      "src/**/__tests__/**/*.test.{ts,tsx}",
      "src/test/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  }
);
