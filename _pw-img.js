const { spawn } = require('child_process');
const fs = require('fs');

// Use Playwright via npx
const script = `
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  const networkErrors = [];
  const imgRequests = [];
  const imgResponses = [];

  page.on('console', msg => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') {
      consoleLogs.push('[' + t + '] ' + msg.text());
    }
  });
  page.on('requestfailed', req => {
    networkErrors.push(req.url() + ' :: ' + req.failure()?.errorText);
  });
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('res.cloudinary.com') || url.match(/\\.(jpg|jpeg|png|webp|gif)/i)) {
      imgRequests.push(url);
      imgResponses.push(url + ' -> ' + resp.status());
    }
  });

  // Login
  await page.goto('http://localhost:3000/auth/sign-in', { waitUntil: 'networkidle' });
  console.log('URL after sign-in page load:', page.url());

  // Fill credentials - discover fields
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.fill('admin@drinksharbour.com');
  await passInput.fill('Admin@123!SecurePassword');

  // Click submit
  const submitBtn = page.locator('button[type="submit"]').first();
  await Promise.all([
    page.waitForURL(/\\/sub-products|\\/dashboard|\\//, { timeout: 30000 }).catch(() => {}),
    submitBtn.click(),
  ]);
  await page.waitForLoadState('networkidle');
  console.log('URL after login:', page.url());

  // Navigate to sub-products
  await page.goto('http://localhost:3000/sub-products', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Inspect images
  const imgs = await page.locator('img').all();
  console.log('\\\\n=== IMG elements on page: ' + imgs.length + ' ===');
  let brokenCount = 0;
  let placeholderCount = 0;
  let realImgCount = 0;
  for (let i = 0; i < Math.min(imgs.length, 20); i++) {
    const src = await imgs[i].getAttribute('src');
    const naturalW = await imgs[i].evaluate(el => el.naturalWidth).catch(() => -1);
    const visible = await imgs[i].isVisible().catch(() => false);
    if (naturalW === 0 || naturalW === -1) brokenCount++;
    else realImgCount++;
    console.log('img[' + i + '] visible=' + visible + ' naturalW=' + naturalW + ' src=' + (src || '').slice(0, 120));
  }

  // Check for SVG/package icons (placeholder)
  const svgCount = await page.locator('svg').count();
  console.log('\\\\nSVG elements (placeholders): ' + svgCount);

  // Check if BeverageIcon fallback is rendered (PiPackageBold / PiWineBold paths)
  const packageIcons = await page.locator('svg[class*="text-gray"], svg[class*="text-gray-300"], svg[class*="text-gray-400"]').count();
  console.log('Gray SVG icons (likely placeholders): ' + packageIcons);

  console.log('\\\\n=== Cloudinary/image network responses ===');
  imgResponses.slice(0, 10).forEach(r => console.log('  ' + r));

  console.log('\\\\n=== Network errors ===');
  networkErrors.slice(0, 10).forEach(e => console.log('  ' + e));

  console.log('\\\\n=== Console errors/warnings ===');
  consoleLogs.slice(0, 15).forEach(l => console.log('  ' + l));

  await page.screenshot({ path: '/tmp/sub-products.png', fullPage: false });
  console.log('\\\\nScreenshot saved: /tmp/sub-products.png');

  await browser.close();
})();
`;

fs.writeFileSync('/tmp/_pw-img.mjs', script);
const p = spawn('npx', ['playwright', 'test', '--config='], { cwd: '/Users/mac/Documents/drinksharbour', stdio: 'inherit' });
