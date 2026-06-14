import { expect, Page } from '@playwright/test';

export type MockViewer = {
  id: string;
  username: string;
  providerId?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
} | null;

type DashboardOptions = {
  clusterName?: string;
  /** Override the full dashboard `data` payload (e.g. empty clusters). */
  data?: unknown;
};

function viewerPayload(viewer: MockViewer) {
  return {
    data: {
      viewer: viewer
        ? {
            id: viewer.id,
            username: viewer.username,
            providerId: viewer.providerId ?? 'local',
            avatarUrl: viewer.avatarUrl ?? null,
            email: viewer.email ?? null,
          }
        : null,
    },
  };
}

function dashboardPayload({ clusterName = 'pw-demo-cluster', data }: DashboardOptions = {}) {
  if (data !== undefined) {
    return { data };
  }
  return {
    data: {
      health: { ok: true, version: 'test' },
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
}

function isViewerQuery(query: string): boolean {
  // The viewer operation selects the top-level `viewer` field; the dashboard
  // operation does not. Branch on the operation rather than returning one canned
  // response, since page load now fires ViewerQuery before the dashboard query.
  return /\bviewer\b/.test(query) && !/\bclusters\b/.test(query);
}

/**
 * Routes `/api/graphql`, answering the viewer identity query and the dashboard
 * query independently. `getViewer` is read per request so callers can flip
 * identity across a login/logout transition within one test.
 */
export async function mockGraphQL(
  page: Page,
  opts: { getViewer?: () => MockViewer; viewer?: MockViewer; dashboard?: DashboardOptions } = {},
) {
  const resolveViewer = opts.getViewer ?? (() => opts.viewer ?? null);

  await page.route('**/api/graphql', async (route) => {
    const body = route.request().postDataJSON() as { query?: string } | null;
    const query = body?.query ?? '';

    const payload = isViewerQuery(query) ? viewerPayload(resolveViewer()) : dashboardPayload(opts.dashboard);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
  });
}

/**
 * Convenience for the common "already authenticated, dashboard renders" case:
 * viewer resolves to a fixed operator and the dashboard query returns one
 * cluster named `clusterName`.
 */
export async function mockDashboardQuerySuccess(page: Page, clusterName = 'pw-demo-cluster') {
  await mockGraphQL(page, {
    viewer: { id: 'viewer-playwright', username: 'playwright', providerId: 'local' },
    dashboard: { clusterName },
  });
}

export async function login(page: Page, username = 'playwright', password = 'secret') {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SustainaBuild' })).toBeVisible();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
