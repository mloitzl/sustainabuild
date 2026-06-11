import { expect, test } from '@playwright/test';
import { login, mockDashboardQuerySuccess } from './helpers';

test('live updates ticket can be requested from authenticated UI', async ({ page }) => {
  await mockDashboardQuerySuccess(page);
  await login(page);
  const flashAlert = page.locator('p[role="alert"]');

  await page.getByRole('button', { name: 'Connect live updates' }).click();

  await expect(flashAlert).toContainText('Live update ticket issued');
  await expect(page.getByText('Latest ticket')).toBeVisible();

  const tokenPreview = page.locator('div:has-text("Latest ticket") p.font-mono');
  await expect(tokenPreview).toContainText('…');
});
