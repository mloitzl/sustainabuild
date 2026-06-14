import { expect, test } from '@playwright/test';

// Runs against the second web server (port 3102) where OIDC discovery succeeds but
// resolves to an INTERNAL authorization_endpoint (authentik-server:9000). The
// OIDC_AUTHORIZATION_ENDPOINT override must win, so the browser is redirected to a
// host it can actually reach (localhost:9000). This guards the split-endpoint fix:
// server-side discovery/token/userinfo use internal DNS, browser redirect does not.
test.use({ baseURL: 'http://127.0.0.1:3102' });

test('oidc authorization redirect targets the browser-reachable host, not internal DNS', async ({
  page,
}) => {
  // The /api/auth/login route returns the authorization URL as a redirect Location
  // header. Capturing that header is the exact authorizationUrl built by beginLogin,
  // with none of the cross-origin asset noise that following the redirect would add.
  let authorizeUrl: string | undefined;
  page.on('response', (response) => {
    if (authorizeUrl) return;
    if (!response.url().includes('/api/auth/login')) return;
    if (response.status() < 300 || response.status() >= 400) return;
    const location = response.headers()['location'];
    if (location && location.includes('/application/o/authorize/')) {
      authorizeUrl = location;
    }
  });

  // Abort the follow-up navigation to the (non-existent) authorize host so the test
  // does not hang trying to load it.
  await page.route('**://localhost:9000/**', (route) => route.abort());
  // Fail loudly if the browser is ever sent to the internal-only discovery host.
  let internalReached = false;
  await page.route('**://authentik-server:9000/**', (route) => {
    internalReached = true;
    return route.abort();
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in with Authentik' }).click();

  await expect.poll(() => authorizeUrl).toBeDefined();

  const url = new URL(authorizeUrl!);
  expect(url.host).toBe('localhost:9000');
  expect(url.hostname).not.toBe('authentik-server');
  expect(internalReached).toBe(false);
  expect(url.pathname).toBe('/application/o/authorize/');
  // PKCE/state params from beginLogin should ride along on the override host.
  expect(url.searchParams.get('client_id')).toBe('e2e-authentik-client');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('state')).toBeTruthy();
});
