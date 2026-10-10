const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const EMAIL = process.env.POS_EMAIL || 'heroogene@gmail.com';
const PASSWORD = process.env.POS_PASSWORD || 'TestPass123!';

const PAGES = [
  ['/point-of-sale', 'Dashboard'],
  ['/point-of-sale/sell', 'Sell'],
  ['/point-of-sale/orders', 'Orders'],
  ['/point-of-sale/sales-details', 'Sales Details'],
  ['/point-of-sale/history', 'History'],
  ['/point-of-sale/sessions', 'Sessions'],
  ['/point-of-sale/session-report', 'Session Report'],
  ['/point-of-sale/order-analysis', 'Order Analysis'],
];

const WIDTHS = [390, 768, 1024, 1440];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Log in once; the session cookie carries across widths.
  await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  // Click the credentials submit (there is also a hidden MFA form button), and
  // wait for the URL to leave /signin rather than a fixed sleep.
  const submit = page.locator('button[type="submit"]:has-text("Sign in")').last();
  await submit.click();
  try {
    await page.waitForURL((u) => !u.pathname.includes('/signin'), { timeout: 30000 });
  } catch (e) {
    console.log('!! login did not leave /signin, current url =', page.url());
  }
  await page.waitForTimeout(2500);
  console.log('after login ->', page.url());

  // Prove the session is real: a protected route must not bounce to /signin.
  await page.goto(`${BASE}/point-of-sale/orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  if (page.url().includes('/signin')) {
    console.log('!! NOT authenticated — measurements below would be the signin page. Aborting.');
    await browser.close();
    return;
  }
  console.log('auth ok ->', page.url());

  const results = [];
  for (const [route, name] of PAGES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2200);
        const m = await page.evaluate(() => {
          const d = document.documentElement;
          // Find the widest offender so the number is actionable, not just a count.
          let worst = null;
          for (const el of Array.from(document.querySelectorAll('body *'))) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > d.clientWidth + 2) {
              const over = r.right - d.clientWidth;
              if (!worst || over > worst.over) {
                worst = {
                  over: Math.round(over),
                  tag: el.tagName.toLowerCase(),
                  cls: (el.className || '').toString().slice(0, 90),
                };
              }
            }
          }
          return {
            scrollW: d.scrollWidth,
            clientW: d.clientWidth,
            hOverflow: d.scrollWidth > d.clientWidth + 2,
            worst,
          };
        });
        results.push({ route, name, width, ...m });
        const bad = m.hOverflow;
        console.log(
          `${bad ? 'OVERFLOW' : 'ok      '} ${route.padEnd(28)} ${String(width).padStart(4)}px ` +
          `scrollW=${m.scrollW} clientW=${m.clientW}` +
          (m.worst ? ` worst=${m.worst.tag}.${m.worst.cls} +${m.worst.over}px` : '')
        );
      } catch (e) {
        console.log(`ERROR     ${route} @${width}: ${e.message.split('\n')[0]}`);
      }
    }
  }

  await browser.close();
  const overflows = results.filter((r) => r.hOverflow);
  console.log(`\n=== ${overflows.length} overflowing of ${results.length} checks ===`);
})();
