module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist/", "dev-dist/", "node_modules/"],
  rules: {
    "no-undef": "warn",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-useless-escape": "warn",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "react/jsx-no-duplicate-props": "off",
    "react/no-unescaped-entities": "off",
    "react-hooks/rules-of-hooks": "warn",
  },
};
