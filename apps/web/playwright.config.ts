import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3101',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm run dev:e2e',
    env: {
      ...process.env,
      AUTH_PROVIDERS: process.env.E2E_AUTH_PROVIDERS ?? 'local,oidc',
      OIDC_PROVIDER_NAME: process.env.E2E_OIDC_PROVIDER_NAME ?? 'Authentik',
      OIDC_ISSUER_URL:
        process.env.E2E_OIDC_ISSUER_URL ?? 'http://127.0.0.1:3101/application/o/sustainabuild/',
      OIDC_CLIENT_ID: process.env.E2E_OIDC_CLIENT_ID ?? 'e2e-authentik-client',
      OIDC_CLIENT_SECRET: process.env.E2E_OIDC_CLIENT_SECRET ?? 'e2e-authentik-secret',
    },
    url: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3101',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
