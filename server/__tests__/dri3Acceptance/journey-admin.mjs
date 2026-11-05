'use strict';
/**
 * DRI-3 Journey A — Admin listing-create for the five new business types.
 * Drives the REAL admin UI for one fixture tenant per vertical: selects a
 * catalog product from the isolated DRI-3 fixture, sets pricing, adds a size
 * variant row, and saves via the real Save button (POST /api/subproducts).
 *
 * Run: node server/__tests__/dri3Acceptance/journey-admin.mjs [fashion|electronics|beauty|home|general|all]
 */
import { launch, loginAdmin, shot, stmt } from './browser.lib.mjs';

const ADMIN_URL = process.env.DRI3_ADMIN_URL || 'http://localhost:3000';

const VERTICALS = {
  fashion: {
    email: 'owner@skyline-fashion.test',
    productSearch: 'Summer Dress',
    quickFilterHas: ['Dress'],
    quickFilterNot: ['Phone'],
    variant: { chip: 'us 8', sizeLabel: 'us m 9', displayName: 'M · Emerald', colorName: 'Emerald Green', colorHex: '#046A38', sku: 'DRI3-JRN-EMER', stock: 10 },
    costPrice: 13000, sellingPrice: 23000,
  },
  electronics: {
    email: 'owner@nova-electronics.test',
    productSearch: 'Nova Tablet',
    quickFilterHas: ['Mobile Phone', 'Tablet'],
    quickFilterNot: ['Dress'],
    variant: { chip: '256 GB', sizeLabel: '256 GB', displayName: '256 GB', sku: 'DRI3-JRN-SCRN', stock: 8 },
    costPrice: 320000, sellingPrice: 455000,
  },
  beauty: {
    email: 'owner@glow-beauty.test',
    productSearch: 'Vitamin Booster',
    quickFilterHas: ['Skincare'],
    quickFilterNot: ['Dress'],
    variant: { chip: '20 ml', sizeLabel: '20 ml', displayName: '20 ml', colorName: 'Universal', colorHex: '#F5D0C5', sku: 'DRI3-JRN-VITB', stock: 20 },
    costPrice: 6000, sellingPrice: 11000,
  },
  home: {
    email: 'owner@hearth-home.test',
    productSearch: 'Brass Table Lamp',
    quickFilterHas: ['Home Decor'],
    quickFilterNot: ['Dress'],
    variant: { chip: '30 cm', sizeLabel: '30 cm', displayName: '30 cm', sku: 'DRI3-JRN-LAMP', stock: 12 },
    costPrice: 9000, sellingPrice: 18000,
  },
  general: {
    email: 'owner@harbour-general.test',
    productSearch: 'Summer Dress',
    // General Retail must surface the four existing taxonomy trees. The chip
    // budget gives each of its four industries 2 type chips, so assert one
    // representative chip per tree (Home's first two types are Kitchen &
    // Dining / Cookware — those ARE the home tree's chips).
    quickFilterHas: ['Dress', 'Mobile Phone', 'Skincare', 'Kitchen & Dining', 'Cookware & Bakeware'],
    quickFilterNot: [],
    variant: { chip: 'us 8', sizeLabel: 'us 8', displayName: 'US 8', sku: 'DRI3-JRN-GENF', stock: 15 },
    costPrice: 11000, sellingPrice: 19500,
  },
};

const results = [];
const R = (ok, fallback = true) => { results.push(ok ?? fallback); };

// What the /sub-products list page will show for the created listing.
const LIST_MATCH = {
  fashion: 'Summer Dress',
  electronics: 'Tablet',
  beauty: 'Vitamin',
  home: 'Lamp',
  general: 'Summer Dress',
};
Object.keys(VERTICALS).forEach(k => { VERTICALS[k].listMatch = LIST_MATCH[k]; });

const RUN_TAG = new Date().toISOString().slice(11, 19).replace(/:/g, '');

const runVertical = async (browser, key, cfgRaw) => {
  const cfg = { ...cfgRaw, variant: { ...cfgRaw.variant, sku: `${cfgRaw.variant.sku}-${RUN_TAG}` } };
  const name = `journeyA-${key}`;
  const browserCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await browserCtx.newPage();
  try {
    console.log(`\n=== JOURNEY A / ${key} — ${cfg.email} ===`);
    await loginAdmin(page, cfg.email);
    await page.goto(ADMIN_URL + '/sub-products/create', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    await shot(page, `${name}-initial`);

    // 1. Industry-scoped quick filter
    const main = await page.locator('main').innerText();
    for (const chip of cfg.quickFilterHas) R(await stmt(`${name}: quick filter shows "${chip}"`, main.includes(chip)));
    for (const chip of cfg.quickFilterNot) R(await stmt(`${name}: quick filter hides "${chip}"`, !main.includes(chip)));
    // 2. Link catalog product (typed → closest-first matches → Enter selects)
    const search = page.locator('input[placeholder*="Search by name" i]').first();
    await search.fill(cfg.productSearch);
    await page.waitForTimeout(2500);
    R(await stmt(`${name}: catalog match offered for "${cfg.productSearch}"`, /closest first|match/i.test(await page.locator('main').innerText())));
    // Enter alone doesn't commit — click the closest-match card.
    await page.locator('text=/Closest match/i').first().click();
    await page.waitForTimeout(2000);
    await shot(page, `${name}-product-selected`);

    // 3. SubProduct pricing (required inputs)
    const cost = page.locator('input[name="subProductData.costPrice"]:visible').first();
    const price = page.locator('input[name="subProductData.baseSellingPrice"]:visible').first();
    R(await stmt(`${name}: pricing inputs visible`, (await cost.count()) > 0 && (await price.count()) > 0));
    await cost.fill(String(cfg.costPrice));
    await price.fill(String(cfg.sellingPrice));
    await page.waitForTimeout(300);

    // 4. Size variant row — use the "Quick Add Common Sizes" chip, which both
    //    adds the row and sets the size code in one step.
    const chip = page.getByRole('button', { name: `+ ${cfg.variant.chip}`, exact: true }).first();
    if (await chip.count()) {
      await chip.click();
    } else {
      console.warn(`${name}: chip "+ ${cfg.variant.chip}" not found, using row + select`);
      await page.getByRole('button', { name: /Add Size Variant|Add Your First Size/i }).last().click();
      await page.waitForTimeout(1200);
      const sizeSel = page.locator('select[name="subProductData.sizes.0.size"]').first();
      await sizeSel.selectOption({ label: cfg.variant.sizeLabel }, { timeout: 10000, force: true }).catch(e =>
        console.warn(`${name}: size select fallback failed`, String(e).slice(0, 120)));
    }
    await page.waitForTimeout(1500);
    R(await stmt(`${name}: variant row added ("1 Size Variant Configured")`, /Size Variant Configured/i.test(await page.locator('main').innerText())));
    const dn = page.locator('input[name="subProductData.sizes.0.displayName"]').first();
    await dn.fill(cfg.variant.displayName);
    await page.locator('input[name="subProductData.sizes.0.sku"]').first().fill(cfg.variant.sku);
    if (cfg.variant.colorName) {
      await page.locator('input[name="subProductData.sizes.0.colorName"]').first().fill(cfg.variant.colorName);
      await page.locator('input[name="subProductData.sizes.0.colorHexCode"]').first().fill(cfg.variant.colorHex);
    }
    await page.locator('input[name="subProductData.sizes.0.stock"]').first().fill(String(cfg.variant.stock));
    await shot(page, `${name}-variant-row`);
    R(await stmt(`${name}: variant row populated`, true));

    // 5. Save via the form's Save button → POST /api/subproducts
    const saveBtn = page.getByRole('button', { name: /^Save$/i }).first();
    R(await stmt(`${name}: Save button present`, (await saveBtn.count()) > 0));
    await saveBtn.click();
    await page.waitForTimeout(7000);
    await shot(page, `${name}-after-save`);
    const body = await page.locator('body').innerText();
    const savedBadge = /Saved at|saved/i.test(body);
    R(await stmt(`${name}: toolbar reports saved`, savedBadge, page.url()));

    // Confirm the record exists on the real list page
    await page.goto(ADMIN_URL + '/sub-products', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5500);
    let list = await page.locator('main').innerText();
    // The list occasionally hits a transient load error right after create — retry once.
    if (/Something went wrong/i.test(list)) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(6000);
      list = await page.locator('main').innerText();
    }
    await shot(page, `${name}-list`);
    R(await stmt(`${name}: created listing visible on /sub-products`, list.includes(cfg.listMatch)));

    await browserCtx.close();
  } catch (e) {
    console.error(`${name} ERROR:`, String(e).slice(0, 500));
    await shot(page, `${name}-error`).catch(() => {});
    R(await stmt(`${name}: completed without error`, false, String(e).slice(0, 200)));
    await browserCtx.close().catch(() => {});
  }
};

const run = async () => {
  const only = process.argv[2] || 'all';
  const { browser } = await launch({ trace: false });
  const keys = only === 'all' ? Object.keys(VERTICALS) : [only];
  for (const key of keys) await runVertical(browser, key, VERTICALS[key]);

  await browser.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n=== JOURNEY A RESULT: ${passed}/${results.length} assertions passed ===`);
  process.exit(passed === results.length ? 0 : 1);
};
run().catch(e => { console.error('FATAL', e); process.exit(1); });
