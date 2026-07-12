import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Smoke Tests', () => {
  test('should load the login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // Smoke check: the login container should be visible
    const isVisible = await loginPage.isLoginContainerVisible();
    expect(isVisible).toBeTruthy();
  });
});
