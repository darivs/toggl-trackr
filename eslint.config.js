// ESLint flat config for ESLint v9
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";

const paddingRules = [
  "error",
  { blankLine: "always", prev: "block", next: "*" },
  { blankLine: "always", prev: "*", next: "return" },
  { blankLine: "always", prev: "multiline-expression", next: "*" },
];

export default tseslint.config(
  {
    name: "ignores",
    ignores: [
      "eslint.config.js",
      "node_modules/**",
      "dist/**",
      "build/**",
      ".pnpm-store/**",
      ".vite/**",
      "coverage/**",
      "postcss.config.cjs",
      "tailwind.config.ts",
      "vite.config.ts",
    ],
  },
  js.configs.recommended,
  {
    name: "globals",
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
  },
  {
    name: "typescript",
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.server.json"],
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...tseslint.configs.recommendedTypeChecked[0].rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "padding-line-between-statements": paddingRules,
      "react/jsx-newline": ["error", { prevent: false }],
    },
  },
  {
    name: "javascript",
    files: ["**/*.js", "**/*.jsx", "**/*.cjs", "**/*.mjs"],
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "padding-line-between-statements": paddingRules,
    },
  },
  prettier
);
