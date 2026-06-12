import { expect, Page } from '@playwright/test';

export async function mockDashboardQuerySuccess(page: Page, clusterName = 'pw-demo-cluster') {
  await page.route('**/api/graphql', async (route) => {
    const responsePayload = {
      data: {
        health: {
          ok: true,
          version: 'test',
        },
        clusters: {
          edges: [
            {
              node: {
                id: 'cluster-playwright',
                name: clusterName,
                status: 'ONLINE',
                activeLeaseCount: 1,
                currentPowerW: 42,
              },
            },
          ],
        },
      },
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responsePayload),
    });
  });
}

export async function login(page: Page, username = 'playwright', password = 'secret') {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SustainaBuild' })).toBeVisible();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
