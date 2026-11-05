'use strict';
// Exploration pass: real login + dump of sub-product create form structure.
import { launch, teardown, loginAdmin, shot } from './browser.lib.mjs';

const run = async () => {
  const { browser, ctx } = await launch({ trace: false });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['error'].includes(m.type())) console.log('CONSOLE-ERR:', m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 300)));
  const failures = [];

  await loginAdmin(page, 'owner@skyline-fashion.test');
  await page.waitForTimeout(2000);
  await shot(page, 'signin-after-fashion');
  console.log('URL after login:', page.url());
  const bodyText = await page.locator('body').innerText().then(t => t.slice(0, 400));
  console.log('PAGE TEXT:', JSON.stringify(bodyText));

  // straight to create form
  await page.goto('http://localhost:3000/sub-products/create', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await shot(page, 'create-fashion-initial');
  const headingText = await page.locator('main').innerText().catch(() => 'NO MAIN');
  console.log('CREATE FORM TEXT (first 1500 chars):');
  console.log(JSON.stringify(headingText.slice(0, 1500)));

  await teardown({ browser, ctx }, 'explore');
};
run().catch(async e => { console.error(e); process.exitCode = 1; });
