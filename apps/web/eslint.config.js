// @ts-check
const baseConfig = require('@sustainabuild/eslint-config');

module.exports = [
  ...baseConfig,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
];
