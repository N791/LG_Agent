import { expect, test } from '@playwright/test';

test('keeps the admin console fail-closed during an API/Web registry mismatch', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'admin-token');
    localStorage.setItem(
      'user_info',
      JSON.stringify({
        id: 'user-a',
        username: 'admin',
        role: 'ADMIN',
        organizationId: 'organization-a',
      }),
    );
  });
  await page.route('**/api/v1/me/permissions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        data: {
          registryVersion: 999,
          organizationId: 'organization-a',
          roles: [],
          permissions: ['user:read'],
        },
      }),
    }),
  );

  await page.goto('/users', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Permission version mismatch')).toBeVisible();
  await expect(page.getByText('User Management')).toHaveCount(0);
});

test('distinguishes a permission service outage from an explicit route denial', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'admin-token');
    localStorage.setItem(
      'user_info',
      JSON.stringify({
        id: 'user-a',
        username: 'admin',
        role: 'ADMIN',
        organizationId: 'organization-a',
      }),
    );
  });
  await page.route('**/api/v1/me/permissions', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 503, errorCode: 'UPSTREAM_UNAVAILABLE' }),
    }),
  );

  await page.goto('/users', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Permission service unavailable')).toBeVisible();
  await expect(page.getByText('403')).toHaveCount(0);
});
