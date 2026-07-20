const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: true, 
    executablePath: 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-150.0.7871.24\\chrome-win64\\chrome.exe'
  });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type()}] ${msg.text()}`);
  });
  
  console.log('Navigating to login...');
  await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle0' });
  
  console.log('Typing credentials...');
  await page.type('input[placeholder="Username"]', 'trainee');
  await page.type('input[type="password"]', 'trainee123');
  
  console.log('Clicking login...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]')
  ]);

  console.log('Navigating to Mission Hub...');
  await page.goto('http://localhost:8081/mission-hub/00000000-0000-0000-0000-000000000001', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 2000));

  const errorText = await page.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? pre.textContent : 'No pre tag found.';
  });
  console.log('EXACT ERROR IN DOM:');
  console.log(errorText);
  
  console.log('Done.');
  await browser.close();
})();
