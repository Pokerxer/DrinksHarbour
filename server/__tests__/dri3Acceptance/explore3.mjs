'use strict';
// Exploration 3: select the catalog match, add a size variant, dump controls.
import { launch, teardown, loginAdmin, shot } from './browser.lib.mjs';

const ADMIN_URL = 'http://localhost:3000';

const run = async () => {
  const { browser, ctx } = await launch({ trace: false });
  const page = await ctx.newPage();

  await loginAdmin(page, 'owner@skyline-fashion.test');
  await page.goto(ADMIN_URL + '/sub-products/create', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // search for the unlisted fashion_dress product
  const generic = page.locator('input[placeholder*="Search by name" i]').first();
  await generic.fill('Summer Dress');
  await page.waitForTimeout(2000);
  // select closest match (keyboard: ↑↓ browse + Enter, per hint text)
  await generic.press('Enter');
  await page.waitForTimeout(2000);
  const afterSelect = await page.locator('main').innerText();
  console.log('AFTER SELECT  (first 800):', JSON.stringify(afterSelect.slice(0, 800)));
  await shot(page, 'create-fashion-selected');

  // Add size variant
  const addVariant = page.getByRole('button', { name: /Add Size Variant/i }).first();
  if (await addVariant.count()) {
    await addVariant.click({ timeout: 5000 }).catch(e => console.log('addVariant click fail', String(e).slice(0, 120)));
    await page.waitForTimeout(1500);
    const sizesText = await page.locator('#product-sizes').innerText().catch(() => 'no #product-sizes');
    console.log('SIZES SECTION:\n', sizesText.slice(0, 2200));
    await shot(page, 'create-fashion-variant-row');
  } else {
    console.log('Add Size Variant button NOT FOUND');
  }
  await teardown({ browser, ctx }, 'explore3');
};
run().catch(async e => { console.error('ERR', e); process.exitCode = 1; });
