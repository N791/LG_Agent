import { Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/login');
  }

  async isLoginContainerVisible() {
    // Basic selector to verify the page loaded
    return await this.page.locator('form').isVisible();
  }
}
