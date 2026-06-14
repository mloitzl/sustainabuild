import { expect, test } from '@playwright/test';
import { login, mockGraphQL, type MockViewer } from './helpers';

test('live updates ticket can be requested from authenticated UI', async ({ page }) => {
  // The ticket endpoint needs a real session, so perform a real login (which sets
  // the cookie) and flip the mocked viewer in step with it.
  let viewer: MockViewer = null;
  await mockGraphQL(page, { getViewer: () => viewer });
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { username?: string; password?: string } | null;
    if (route.request().method() === 'POST' && body?.username && body?.password) {
      viewer = { id: 'user-playwright', username: 'playwright', providerId: 'local' };
    }
    await route.continue();
  });

  await login(page);
  await expect(page.getByText('Authenticated')).toBeVisible();
  const flashAlert = page.locator('p[role="alert"]');

  await page.getByRole('button', { name: 'Connect live updates' }).click();

  await expect(flashAlert).toContainText('Live update ticket issued');
  await expect(page.getByText('Latest ticket')).toBeVisible();

  const tokenPreview = page.locator('div:has-text("Latest ticket") p.font-mono');
  await expect(tokenPreview).toContainText('…');
});
