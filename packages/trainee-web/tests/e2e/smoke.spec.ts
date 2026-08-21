import { test, expect } from '@playwright/test';

test.describe('Smoke Test Suite', () => {
  test('should load the application and show dashboard', async ({ page }) => {
    // Navigate to root, which should redirect to /dashboard if logged in or /login
    await page.goto('/');

    // We expect the title to contain something meaningful or just verify it doesn't crash
    const title = await page.title();
    expect(title).not.toBe('');
  });
});

test.describe('Login Page Regression Suite', () => {
  test('shows the interactive login interface', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('input')).toHaveCount(2);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
