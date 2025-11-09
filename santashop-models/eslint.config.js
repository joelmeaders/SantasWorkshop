// @ts-check
const rootConfig = require("../eslint.config.js");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  ...rootConfig,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: [
          "santashop-models/tsconfig.lib.json",
          "santashop-models/tsconfig.spec.json",
        ],
      },
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "models",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "models",
          style: "kebab-case",
        },
      ],
    },
  }
);
