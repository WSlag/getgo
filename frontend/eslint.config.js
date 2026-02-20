import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/", "dev-dist/"] },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs["recommended-latest"],
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      "react-refresh": reactRefresh,
    },
    settings: {
      react: { version: "detect" },
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      "no-undef": "warn",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-useless-escape": "warn",
      "react/prop-types": "off",
      "react/jsx-no-duplicate-props": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/rules-of-hooks": "warn",
    },
  },
];
