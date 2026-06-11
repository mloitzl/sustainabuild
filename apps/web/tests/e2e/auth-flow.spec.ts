import { expect, test } from '@playwright/test';
import { login, mockDashboardQuerySuccess } from './helpers';

test('auth flow: signed out -> signed in -> signed out', async ({ page }) => {
  await mockDashboardQuerySuccess(page);

  await page.goto('/');
  const authBadge = page.locator('header span').first();
  await expect(authBadge).toContainText('Signed out');
  const flashAlert = page.locator('p[role="alert"]');

  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(flashAlert).toContainText('Missing credentials');

  await login(page, 'operator', 's3cret');
  await expect(authBadge).toContainText('Authenticated');
  await expect(flashAlert).toContainText('Signed in as operator');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(authBadge).toContainText('Signed out');
  await expect(flashAlert).toContainText('Signed out');
});
