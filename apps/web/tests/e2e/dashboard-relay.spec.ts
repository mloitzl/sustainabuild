import { expect, test } from '@playwright/test';
import { mockDashboardQuerySuccess } from './helpers';

test('dashboard route query renders relay-backed cluster data', async ({ page }) => {
  // The viewer mock authenticates, so the dashboard renders without a login step.
  await mockDashboardQuerySuccess(page, 'cluster-from-relay');
  await page.goto('/');

  await expect(page.getByText('Authenticated')).toBeVisible();
  await expect(page.getByText('Core API health: OK')).toBeVisible();
  await expect(page.getByText('cluster-from-relay')).toBeVisible();
  await expect(page.getByText('Leases: 1')).toBeVisible();
  await expect(page.getByText('Power: 42 W', { exact: true })).toBeVisible();

  // Overview summary header aggregates the connection.
  await expect(page.getByText('Total: 1')).toBeVisible();
  await expect(page.getByText('Online: 1')).toBeVisible();
  await expect(page.getByText('Total power: 42 W')).toBeVisible();
});
