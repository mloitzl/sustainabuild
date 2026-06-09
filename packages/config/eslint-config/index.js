// @ts-check
const tseslint = require('typescript-eslint');
const eslintConfigPrettier = require('eslint-config-prettier');

/** @type {import("typescript-eslint").Config} */
const config = tseslint.config(...tseslint.configs.recommended, eslintConfigPrettier, {
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
  },
});

module.exports = config;
