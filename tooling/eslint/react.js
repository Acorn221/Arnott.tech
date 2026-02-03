import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import-x";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", ".turbo", "e2e", "playwright.config.ts", "vitest.config.ts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "import-x": importPlugin,
      "simple-import-sort": simpleImportSort,
    },
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off", // Allow both type and interface (intersection types need type)
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "off",

      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",

      // Import rules - enforce named exports and sorting
      "import-x/no-default-export": "error",
      "import-x/first": "error",
      "import-x/newline-after-import": "error",
      "import-x/no-duplicates": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  // Override for files that legitimately need default exports
  {
    files: [
      "**/eslint.config.js",
      "**/vite.config.ts",
      "**/vitest.config.ts",
      "**/*.config.js",
      "**/*.config.ts",
      "**/store/slices/*.ts", // Redux slices use default export for reducer
      "**/*.d.ts", // Module declarations use default export syntax
    ],
    rules: {
      "import-x/no-default-export": "off",
    },
  },
  // Relaxed rules for test files
  {
    files: ["**/__tests__/**/*.ts", "**/__tests__/**/*.tsx", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-empty-function": "off", // Empty functions common in mocks
      "@typescript-eslint/no-unsafe-assignment": "off", // Tests often use any
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
