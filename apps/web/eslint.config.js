// @ts-check
const baseConfig = require('@sustainabuild/eslint-config');

module.exports = [
  ...baseConfig,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/api/**'],
    rules: {
      // Baseline guardrail: UI data fetching should move to Relay hooks.
      // Kept as warning during migration; can be promoted to error once Relay rollout is complete.
      'no-restricted-globals': [
        'warn',
        {
          name: 'fetch',
          message:
            'Use Relay query/mutation/subscription hooks in UI components instead of direct fetch.',
        },
      ],
    },
  },
];
