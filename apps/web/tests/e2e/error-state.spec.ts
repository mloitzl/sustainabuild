import { expect, test } from '@playwright/test';

test('route error boundary appears on query failure and can retry', async ({ page }) => {
  let shouldFail = true;

  await page.route('**/api/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query?: string } | null;
    const query = body?.query ?? '';

    // The viewer identity query must always succeed (authenticated) so the
    // dashboard mounts; only the dashboard query fails once, then recovers.
    if (/\bviewer\b/.test(query) && !/\bclusters\b/.test(query)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { viewer: { id: 'viewer-pw', username: 'playwright', providerId: 'local', avatarUrl: null, email: null } },
        }),
      });
      return;
    }

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

  // The viewer query is mocked authenticated, so the dashboard mounts on load.
  await page.goto('/');

  await expect(page.getByText('Dashboard data failed to load')).toBeVisible();
  await page.getByRole('button', { name: 'Retry loading dashboard' }).click();
  await expect(page.getByText('Core API health: OK · version retry-ok')).toBeVisible();
});
