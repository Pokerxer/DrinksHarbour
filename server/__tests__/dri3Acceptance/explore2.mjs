'use strict';
// Exploration 2: select catalog product, inspect sizes/variant section.
import { launch, teardown, loginAdmin, shot } from './browser.lib.mjs';

const ADMIN_URL = 'http://localhost:3000';

const run = async () => {
  const { browser, ctx } = await launch({ trace: false });
  const page = await ctx.newPage();

  await loginAdmin(page, 'owner@skyline-fashion.test');

  await page.goto(ADMIN_URL + '/sub-products/create', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // search for the unlisted catalog product
  const search = page.locator('text=Search Product *');
  console.log('search-visible:', await search.count());
  const searchBox = page.locator('input[placeholder*="Search product" i], input[placeholder*="Search Product" i]').first();
  const cnt = await searchBox.count();
  console.log('searchbox count:', cnt);
  const generic = page.locator('input[placeholder*="Search by name" i]').first();
  await generic.fill('Summer Dress');
  await page.waitForTimeout(2500);
  await shot(page, 'create-fashion-search');
  const main = await page.locator('main').innerText();
  console.log('AFTER SEARCH:', JSON.stringify(main.slice(0, 2500)));
  await teardown({ browser, ctx }, 'explore2');
};
run().catch(async e => { console.error('ERR', e); process.exitCode = 1; });
