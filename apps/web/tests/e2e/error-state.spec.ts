import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('route error boundary appears on query failure and can retry', async ({ page }) => {
  let shouldFail = true;

  await page.route('**/api/graphql', async (route) => {
    if (shouldFail) {
      shouldFail = false;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ errors: [{ message: 'Simulated failure' }] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          health: { ok: true, version: 'retry-ok' },
          clusters: { edges: [] },
        },
      }),
    });
  });

  await login(page);

  await expect(page.getByText('Dashboard data failed to load')).toBeVisible();
  await page.getByRole('button', { name: 'Retry loading dashboard' }).click();
  await expect(page.getByText('Core API health: OK · version retry-ok')).toBeVisible();
});
