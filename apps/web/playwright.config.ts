import { defineConfig, devices } from '@playwright/test';

// Hermetic OIDC discovery document served via a data: URL so the redirect-host test
// does not depend on a live Authentik. Its authorization_endpoint deliberately points
// at the INTERNAL host; OIDC_AUTHORIZATION_ENDPOINT below overrides it with a
// browser-reachable host, which is exactly the behavior under test.
const OIDC_DISCOVERY_DATA_URL = `data:application/json,${encodeURIComponent(
  JSON.stringify({
    authorization_endpoint: 'http://authentik-server:9000/application/o/authorize/',
    token_endpoint: 'http://authentik-server:9000/application/o/token/',
    userinfo_endpoint: 'http://authentik-server:9000/application/o/userinfo/',
  }),
)}`;

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
  webServer: [
    {
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
    {
      // Second server with OIDC discovery succeeding, used by the browser
      // redirect-host test (see oidc-redirect-host.spec.ts). Discovery resolves to an
      // internal authorization_endpoint; OIDC_AUTHORIZATION_ENDPOINT overrides it.
      command: 'pnpm run dev:e2e:oidc',
      env: {
        ...process.env,
        AUTH_PROVIDERS: 'local,oidc',
        OIDC_PROVIDER_NAME: 'Authentik',
        OIDC_ISSUER_URL: 'http://authentik-server:9000/application/o/sustainabuild/',
        OIDC_DISCOVERY_URL: OIDC_DISCOVERY_DATA_URL,
        OIDC_AUTHORIZATION_ENDPOINT: 'http://localhost:9000/application/o/authorize/',
        OIDC_CLIENT_ID: 'e2e-authentik-client',
        OIDC_CLIENT_SECRET: 'e2e-authentik-secret',
      },
      url: 'http://127.0.0.1:3102',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
