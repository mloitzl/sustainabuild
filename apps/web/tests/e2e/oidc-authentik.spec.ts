import { expect, test } from '@playwright/test';
import { mockGraphQL } from './helpers';

test('authentik oidc discovery failures are surfaced as in-app alerts', async ({ page }) => {
  // Logged-out viewer so the signed-out card renders without a gateway round-trip.
  await mockGraphQL(page, { viewer: null });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SustainaBuild' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign in with Authentik' }).click();

  await expect(page).toHaveURL(/\/(\?.*)?$/);
  const flashAlert = page.locator('p[role="alert"]');
  await expect(flashAlert).toContainText('OIDC discovery failed');
  await expect(flashAlert).not.toContainText('<!DOCTYPE html>');
});

