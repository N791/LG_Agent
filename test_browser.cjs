const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:8081/login');
  await page.fill('#login_username', 'trainee');
  await page.fill('#login_password', '123456');

  await page.click('button[type="submit"]');

  // Wait for dashboard to load completely (URL changes to /dashboard)
  await page.waitForURL('**/dashboard');

  await page.waitForTimeout(1000);

  // Click on the course
  await page.click('text=Node.js Backend Security');

  // Wait for mission hub to load
  await page.waitForTimeout(2000);

  // Extract error
  const html = await page.content();
  const errorText = await page.evaluate(() => window['__LAST_ERROR']);
  console.log('HTML contains Oops:', html.includes('Oops, something went wrong!'));
  console.log('ERROR IS:', errorText);

  await browser.close();
})();
