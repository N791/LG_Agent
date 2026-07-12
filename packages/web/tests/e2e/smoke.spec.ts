import { test, expect } from '@playwright/test';

test.describe('App Smoke Test', () => {
  test('should load the homepage and render the root element', async ({ page }) => {
    await page.goto('/');

    // 验证页面不为空白
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // 根据实际情况可以添加更具体的断言，如标题验证等
    await expect(page).toHaveTitle(/Vite \+ React|LG Agent/i);
  });
});
