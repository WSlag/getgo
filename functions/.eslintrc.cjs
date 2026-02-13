module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script",
  },
  extends: ["eslint:recommended"],
  ignorePatterns: ["node_modules/", "lib/", "coverage/"],
  rules: {
    "no-console": "off",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-useless-escape": "off",
  },
};
