import { expect, test } from '@playwright/test';

test('keeps the trainee app fail-closed during an API/Web registry mismatch', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const payload = btoa(
      JSON.stringify({
        sub: 'user-a',
        username: 'trainee',
        role: 'TRAINEE',
        organizationId: 'organization-a',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }),
    );
    localStorage.setItem('token', `header.${payload}.signature`);
    localStorage.setItem('refreshToken', 'refresh-token');
    localStorage.setItem('tokenExpiresAt', String(Date.now() + 3_600_000));
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'user-a',
        email: 'trainee@example.test',
        name: 'Trainee',
        role: 'TRAINEE',
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
          permissions: ['profile:read'],
        },
      }),
    }),
  );

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Update required')).toBeVisible();
  await expect(page.getByText('Profile Settings')).toHaveCount(0);
});

test('refreshes permissions under the new token identity after a 401', async ({ page }) => {
  const oldToken = jwt('organization-a', 3_600);
  const newToken = jwt('organization-a', 7_200);
  await page.addInitScript(
    ({ accessToken }) => {
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', 'refresh-old');
      localStorage.setItem('tokenExpiresAt', String(Date.now() + 3_600_000));
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-a',
          email: 'trainee@example.test',
          name: 'Trainee',
          role: 'TRAINEE',
          organizationId: 'organization-a',
        }),
      );
    },
    { accessToken: oldToken },
  );
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 200,
        data: { access_token: newToken, refresh_token: 'refresh-new' },
      }),
    }),
  );
  await page.route('**/api/v1/me/permissions', (route) => {
    const refreshed = route.request().headers()['authorization'] === `Bearer ${newToken}`;
    return route.fulfill({
      status: refreshed ? 200 : 401,
      contentType: 'application/json',
      body: JSON.stringify(
        refreshed
          ? {
              code: 200,
              data: {
                registryVersion: 1,
                organizationId: 'organization-a',
                roles: [],
                permissions: ['profile:read'],
              },
            }
          : { code: 401, message: 'expired' },
      ),
    });
  });
  await page.route('**/api/v1/notifications**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, data: [] }),
    }),
  );

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('个人设置').first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBe(newToken);
});

function jwt(organizationId: string, expiresInSeconds: number): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-a',
      username: 'trainee',
      role: 'TRAINEE',
      organizationId,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString('base64url');
  return `header.${payload}.signature`;
}
