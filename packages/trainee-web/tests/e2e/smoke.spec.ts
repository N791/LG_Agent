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

test.describe('Visual Regression Suite', () => {
  test('login page visual snapshot', async ({ page }) => {
    await page.goto('/login');
    // Wait for network idle to ensure everything is loaded
    await page.waitForLoadState('networkidle');
    
    // Take a full page screenshot and compare
    await expect(page).toHaveScreenshot('login-page.png', { fullPage: true });
  });
});
