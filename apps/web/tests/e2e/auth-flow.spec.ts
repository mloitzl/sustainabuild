import { expect, test } from '@playwright/test';
import { login, mockGraphQL, type MockViewer } from './helpers';

test('auth flow: signed out -> signed in -> signed out', async ({ page }) => {
  // The /api/graphql mock decides identity, so flip it in step with the real
  // login/logout requests (which still run, setting/clearing the session cookie).
  let viewer: MockViewer = null;
  await mockGraphQL(page, { getViewer: () => viewer });

  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { username?: string; password?: string } | null;
    if (route.request().method() === 'POST' && body?.username && body?.password) {
      viewer = { id: 'user-operator', username: 'operator', providerId: 'local' };
    }
    await route.continue();
  });
  await page.route('**/api/auth/logout', async (route) => {
    viewer = null;
    await route.continue();
  });

  await page.goto('/');
  const authBadge = page.locator('header span').first();
  await expect(authBadge).toContainText('Signed out');
  const flashAlert = page.locator('p[role="alert"]');

  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(flashAlert).toContainText('Missing credentials');

  await login(page, 'operator', 's3cret');
  await expect(authBadge).toContainText('Authenticated');
  await expect(flashAlert).toContainText('Signed in as operator');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(authBadge).toContainText('Signed out');
  await expect(flashAlert).toContainText('Signed out');
});
