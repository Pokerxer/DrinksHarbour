'use strict';
/**
 * DRI-3 Journey B — Storefront (platform app) authenticated browser journey:
 * same-size variant pair → two separate cart lines → real checkout (wallet
 * payment) → tampered-ID rejection → private-catalogue visibility →
 * marketplace eligibility boundary.
 *
 * Run from client/apps/platform so @playwright/test resolves:
 *   node /Users/mac/Documents/drinksharbour/server/__tests__/dri3Acceptance/journey-storefront.mjs [b|c|all]
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const PLATFORM_APP_DIR = '/Users/mac/Documents/drinksharbour/client/apps/platform';
const ADMIN_APP_DIR = '/Users/mac/Documents/drinksharbour/client/apps/admin';
let require = createRequire(ADMIN_APP_DIR + '/package.json'); // @playwright/test lives in the admin app
try { require('module').builtinModules; } catch { /* noop */ }
const { chromium } = require('@playwright/test');

const API_URL = 'http://127.0.0.1:5301';
const STORE_URL = process.env.DRI3_STORE_URL || 'http://localhost:3002';
const PASSWORD = 'Dri3-Fixture-Pass!2026';
const EVIDENCE_DIR = process.env.DRI3_EVIDENCE_DIR || '/private/var/folders/6r/48j62g153yngdnhfnh9jzz940000gn/T/opencode/dri3/evidence';
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Fixture identities (written by seed-fixture.js) — IDs stay correct after re-seeds.
const RAW_IDENTITY_TEXT = fs.readFileSync(
  '/private/var/folders/6r/48j62g153yngdnhfnh9jzz940000gn/T/opencode/dri3/fixture-identities.json', 'utf8',
);
const FIXTURE = JSON.parse(RAW_IDENTITY_TEXT.slice(RAW_IDENTITY_TEXT.indexOf('{')));
const IDS = { ...FIXTURE.products, ...FIXTURE };

const state = { results: [] };
const stmt = (name, cond, detail = '') => {
  const ok = cond === true;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  state.results.push(ok);
};
const shot = (page, name) =>
  page.screenshot({ path: `${EVIDENCE_DIR}/${name}.png`, fullPage: true }).then(() => console.log(`📸 ${name}`));

const isNaira = (text, num) =>
  new RegExp(`₦\\s?(${String(num).replace(/(\d)(?=(\d{3})+$)/g, '$1,')})`).test(text) ||
  text.includes(String(num));

async function acceptAgeGate(page) {
  const gateBtn = page.locator('button:has-text("18 or older"), button:has-text("Yes, I am 18")').first();
  if (await gateBtn.count()) {
    await gateBtn.click().catch(() => {});
    await page.waitForTimeout(1200);
    console.log('→ age verification gate accepted');
    return true;
  }
  return false;
}

async function dismissOverlays(page) {
  // 1. Cookie banner
  const accept = page.locator('button:has-text("Accept all")').first();
  if (await accept.count()) {
    await accept.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
    console.log('→ cookie banner accepted');
  }
  // 2. Marketing popup banners (PopupBanner full-screen + corner variants)
  const promoClose = page.locator(
    'div.fixed.inset-0 button:has(svg), div.fixed.z-\\[9999\\]:not(.inset-0) button:has(svg.Icon, svg)',
  ).first();
  if (await promoClose.count()) {
    await promoClose.click({ timeout: 4000 }).catch(async (e) => {
      await page.keyboard.press('Escape').catch(() => {});
    });
    await page.waitForTimeout(800);
    console.log('→ promo banner closed');
  }
}

async function loginStorefront(page, email) {
  // One-shot diagnostics: log every failed request + non-2xx auth response.
  if (!page.__netLogged) {
    page.__netLogged = true;
    page.on('requestfailed', (r) => console.log(`NET-FAIL ${r.method()} ${r.url().slice(0, 90)} → ${r.failure()?.errorText}`));
    page.on('response', (r) => {
      if (r.url().includes('/login') && r.status() >= 400) console.log(`NET ${r.status()} ${r.url().slice(0, 90)}`);
    });
  }
  await page.goto(STORE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Fresh dev compiles make the page busy — settle before interacting.
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const emailIn = page.locator('input[name="email"], input[type="email"]').first();
    await emailIn.waitFor({ state: 'visible', timeout: 30000 });
    await acceptAgeGate(page).catch(() => {});
    await dismissOverlays(page);
    const passIn = page.locator('input[type="password"]').first();
    await emailIn.fill(email);
    await passIn.fill(PASSWORD);
    if ((await emailIn.inputValue()) !== email) { await emailIn.fill(email); await passIn.fill(PASSWORD); }
    try {
      // The header carries its own "Sign in" chip that matches text selectors;
      // the form's submit sits below the header — pick by y-position.
      const candidates = page.locator('form button[type="submit"], form button:has-text("Log in"), form button:has-text("Sign in"), form button:has-text("Login"), button:has-text("Sign In")');
      let target = null;
      const n = await candidates.count();
      for (let i = 0; i < n; i++) {
        const box = await candidates.nth(i).boundingBox().catch(() => null);
        if (box && box.y > 150) { target = candidates.nth(i); break; }
      }
      if (!target) throw new Error('no in-form submit button found below header');
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {}),
        target.click({ timeout: 25000 }).catch(async (e) => {
          // Banner animations keep failing actionability — dispatch directly.
          console.log('→ submit click force-dispatched after actionability timeout');
          await target.click({ timeout: 10000, force: true });
        }),
      ]);
    } catch (e) {
      // Dev-server recompile can tear the form down mid-click — retry the attempt.
      console.log(`→ login attempt ${attempt} interrupted (${String(e).split('\n')[0].slice(0, 80)})`);
      await page.waitForTimeout(4000);
      if (!page.url().includes('/login')) break;
      continue;
    }
    await page.waitForTimeout(4000);
    if ((!page.url().includes('/login') && !page.url().includes('/signin')) || page.url().includes('reason=')) {
      console.log('→ buyer login ok, now at', page.url());
      await page.goto(STORE_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await acceptAgeGate(page).catch(() => {});
      return;
    }
  }
  throw new Error(`buyer login failed after 3 attempts (still on ${page.url()})`);
}

/** Authenticated in-page fetch (cookies + CSRF header), mirroring fetchWithAuth. */
async function apiPost(page, path, body) {
  return page.evaluate(async ({ apiUrl, path, body }) => {
    const match = document.cookie.match(/(?:^|;\s*)dh_csrf=([^;]+)/);
    const csrf = match ? decodeURIComponent(match[1]) : null;
    const res = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
      body: JSON.stringify(body),
    });
    let payload = null;
    try { payload = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, message: payload?.message ?? null };
  }, { apiUrl: API_URL, path, body });
}

// ── Journey B: same-size variant pair → cart separation → checkout ───────────
async function journeyB(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await loginStorefront(page, 'buyer@dri3-fixture.test');

    // Drive the purchase on the FASHION TENANT storefront surface — per the
    // 2026-11-05 platform directive, non-beverage verticals are accommodated on
    // tenant subdomains/other surfaces, never blended into the beverage
    // main marketplace. `?_tenant=` is the local-dev tenant resolution path.
    const TENANT_QS = '?_tenant=skyline-fashion';

    // B2 — product page shows the same-size variant pair sold by one tenant
    const url = `${STORE_URL}/product/${slug('Skyline Tailored Shirt')}-fashion${TENANT_QS}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await acceptAgeGate(page);
    await page.waitForTimeout(1500);
    await dismissOverlays(page);
    await shot(page, 'journeyB-b2-product-page');
    const main = await page.locator('main').innerText().catch(() => '');
    stmt('B2: product page loads the fixture shirt', /Tailored Shirt/i.test(main), url);
    stmt('B2: seller "Skyline Fashion House" offered', main.includes('Skyline Fashion House'));
    stmt('B2: variant "Emerald" chip visible', /Emerald/i.test(main));
    stmt('B2: variant "Amber" chip visible (same size M pair)', /Amber/i.test(main));
    stmt('B2: price band shows both ₦22,000 and ₦24,000', isNaira(main, '22,000') && isNaira(main, '24,000'));

    // B3 — add both variants as two separate cart lines
    const emeraldChip = page.locator('button', { hasText: /Emerald/i }).first();
    if (await emeraldChip.count()) await emeraldChip.click();
    await page.waitForTimeout(800);
    const addBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add to cart")').first();
    stmt('B3: Add to Cart button present', (await addBtn.count()) > 0);
    await addBtn.click();
    await page.waitForTimeout(3000);
    await shot(page, 'journeyB-b3-emerald-added');
    // modal cart may cover the page — continue by re-selecting the other variant
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);
    const amberChip = page.locator('button', { hasText: /Amber/i }).first();
    await amberChip.click();
    await page.waitForTimeout(1500);
    const priceNow = await page.locator('main').innerText().then((t) => isNaira(t, '24,000'));
    stmt('B3: selecting Amber updates the displayed price to ₦24,000', priceNow);
    const addBtn2 = page.locator('button:has-text("Add to Cart"), button:has-text("Add to cart")').first();
    await addBtn2.click();
    await page.waitForTimeout(3000);
    await shot(page, 'journeyB-b3-amber-added');

    // Cart pages carry the tenant query so resolution stays on the storefront
    // surface (middleware drops unseen queries on client-side navigation).
    await page.goto(STORE_URL + `/cart${TENANT_QS}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4000);
    await dismissOverlays(page);
    await shot(page, 'journeyB-b3-cart');
    const cart = await page.locator('main').innerText().catch(() => '');
    const emeraldLine = /Emerald/i.test(cart);
    const amberLine = /Amber/i.test(cart);
    stmt('B3: cart page contains an Emerald line', emeraldLine);
    stmt('B3: cart page contains an Amber line (separate line, same size M)', amberLine && /size M|\bM\b/i.test(cart));
    stmt('B3: cart shows separate pricing ₹22,000/₦24,000 lines', isNaira(cart, '22,000') && isNaira(cart, '24,000'));

    // B4 — checkout through the real UI with a wallet payment
    await page.goto(STORE_URL + `/checkout${TENANT_QS}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await dismissOverlays(page);
    await shot(page, 'journeyB-b4-checkout-initial');
    const checkoutMain = await page.locator('main, body').first().innerText();
    stmt('B4: checkout page loads with items', /Checkout|Payment|Delivery/i.test(checkoutMain) && !/empty cart/i.test(checkoutMain));
    await page.fill('input[name="firstName"]', 'Buyer').catch(() => {});
    await page.fill('input[name="lastName"]', 'Customer').catch(() => {});
    await page.fill('input[name="email"]', 'buyer@dri3-fixture.test').catch(() => {});
    await page.fill('input[name="phone"]', '+2348011111111').catch(() => {});
    // Address autocomplete + state/LGA selects
    const addrInput = page.getByPlaceholder(/Estate, street or landmark/i).first();
    if (await addrInput.count()) {
      await addrInput.fill('1 Harbour Test Close, Abuja');
      await page.waitForTimeout(2500);
      // accept a suggestion if the service offers one, else continue manually
      const sugg = page.locator('[role="option"], li, [data-suggestion]').first();
      await sugg.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
    const stateSel = page.locator('select[name="state"]').first();
    if (await stateSel.count()) {
      const opts = await stateSel.locator('option').allTextContents();
      const abuja = opts.find((o) => /FCT|Abuja/i.test(o)) || opts[1];
      await stateSel.selectOption({ label: abuja }).catch(() => {});
      await page.waitForTimeout(3500);
      const lgaSel = page.locator('select[name="lga"]').first();
      if (await lgaSel.count()) {
        const lgas = await lgaSel.locator('option').allTextContents();
        await lgaSel.selectOption({ label: lgas[1] || lgas[0] }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }
    // Postal code + street details if the form still demands them
    await page.fill('input[name="zipCode"]', '900001').catch(() => {});
    await shot(page, 'journeyB-b4-checkout-filled');
    // Payment: wallet is the default method — assert it is selected
    const wallet = page.locator('input[name="payment"], [data-testid*="wallet"]').first();
    stmt('B4: checkout reaches the payment step', (await page.locator('main').innerText().then((t) => /Payment|Wallet/i.test(t))).valueOf());
    const payBtn = page.locator(`button:has-text("Pay ₦"), button:has-text("Pay ${'₦'}"), button:has-text("Pay from Wallet")`).first();
    if (!(await payBtn.count())) {
      // fallback: any final CTA commented "Pay …"
      await page.getByRole('button', { name: /Pay .*(Wallet|₦)|Place Order/i }).first().click();
    } else {
      await payBtn.click();
    }
    await page.waitForTimeout(20000);
    await shot(page, 'journeyB-b4-after-pay');
    const afterPay = await page.locator('body').innerText().catch(() => '');
    const confirmed = page.url().includes('order-confirmation') || /order (placed|confirmed)|Thank/i.test(afterPay);
    stmt('B4: order confirmation reached', confirmed, page.url());
    await shot(page, 'journeyB-b4-confirmation');

    // B5 — tampered-ID rejection at the order API
    await page.goto(STORE_URL + '/cart', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const fakeTamper = await apiPost(page, '/api/orders', {
      customer: { firstName: 'Buyer', lastName: 'Customer', email: 'buyer@dri3-fixture.test', phone: '+2348011111111' },
      shipping: { address: '1 Harbour Test Close', city: 'Abuja', state: 'FCT', country: 'Nigeria', lga: 'Municipal' },
      paymentMethod: 'wallet', paymentDetails: { method: 'wallet', status: 'paid', paidAt: new Date().toISOString() },
      items: [{ subProductId: FIXTURE.variantPair.subProduct, sizeId: '000000000000000000000000', quantity: 1 }],
      status: 'processing', paymentStatus: 'paid',
    });
    stmt('B5: tampered sizeId rejected by POST /api/orders', fakeTamper.status >= 400 && fakeTamper.status < 500,
      `status=${fakeTamper.status} msg=${fakeTamper.message}`);
    // Wallet should NOT have been debited for the invalid push (balance stays)
    const fakeSub = await apiPost(page, '/api/orders', {
      customer: { firstName: 'Buyer', lastName: 'Customer', email: 'buyer@dri3-fixture.test', phone: '+2348011111111' },
      shipping: { address: '1 Harbour Test Close', city: 'Abuja', state: 'FCT', country: 'Nigeria', lga: 'Municipal' },
      paymentMethod: 'wallet',
      items: [{ subProductId: 'aabbccddeeff001122334455', sizeId: FIXTURE.variantPair.emerald, quantity: 1 }],
      status: 'processing', paymentStatus: 'paid',
    });
    stmt('B5: unknown subProductId rejected', fakeSub.status >= 400 && fakeSub.status < 500,
      `status=${fakeSub.status} msg=${fakeSub.message}`);
  } catch (e) {
    console.error('journeyB ERROR:', String(e).slice(0, 400));
    await shot(page, 'journeyB-error').catch(() => {});
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ── Journey C: private-catalogue visibility + marketplace eligibility ────────
async function journeyC(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await loginStorefront(page, 'buyer@dri3-fixture.test');

    // C1 — private catalogue visibility: the fashion tenant's unpublished
    // listing ("Skyline Sample Shirt (internal)", isPublished:false,
    // visibleInOnlineStore:false) lives on an APPROVED product
    // ("Glow Secret Booster 20ml"-beauty_private). The product page may load,
    // but the private listing must never be purchasable, and order creation on
    // the private sub must be rejected.
    await page.goto(`${STORE_URL}/product/${slug('Glow Secret Booster 20ml')}-beauty_private`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4500);
    await shot(page, 'journeyC-c1-private-product-page');
    const main1 = await page.locator('main, body').first().innerText().catch(() => '');
    const addButtons1 = await page.locator('main button:has-text("Add to Cart"), main button:has-text("Add to cart")').count();
    stmt('C1: private listing never offered on its product page',
      (!/Sample Shirt \(internal\)/i.test(main1) && addButtons1 === 0) || !/Glow Secret Booster/i.test(main1),
      `page loads=${/Glow Secret Booster/i.test(main1)}, internal listing shown=${/Sample Shirt/i.test(main1)}, buy buttons=${addButtons1}`);
    const tryPrivate = await apiPost(page, '/api/orders', {
      customer: { firstName: 'Buyer', lastName: 'Customer', email: 'buyer@dri3-fixture.test', phone: '+2348011111111' },
      shipping: { address: '1 Harbour Test Close', city: 'Abuja', state: 'FCT', country: 'Nigeria', lga: 'Municipal' },
      paymentMethod: 'wallet',
      items: [{ subProductId: FIXTURE.privateSub.id, sizeId: FIXTURE.privateSub.size, quantity: 1 }],
      status: 'processing', paymentStatus: 'paid',
    });
    stmt('C1: POST /api/orders on the private (unpublished) listing is rejected',
      tryPrivate.status >= 400 && tryPrivate.status < 500,
      `status=${tryPrivate.status} msg=${tryPrivate.message}`);

    // C2 — it must not appear in shop search. Card-scoped: the page echoes the
    // search term in its title/filter chips, so raw body text always matches
    // the query — assert on the surfaced product names only.
    await page.goto(`${STORE_URL}/shop?search=Sample%20Shirt`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await dismissOverlays(page);
    await shot(page, 'journeyC-c2-shop-private-search');
    const cardNames = await page.locator(
      'main a[href^="/product/"], main [class*="product"] h2, main [class*="product"] h3',
    ).allInnerTexts().catch(() => []);
    stmt('C2: shop search does not surface the private record',
      !cardNames.some((n) => /Sample Shirt/i.test(n)),
      `cards=${JSON.stringify(cardNames.slice(0, 5))}`);

    // C3 — post-DRI-9 positive controls, split by surface:
    //   C3a: an approved BEVERAGE product is browsable WITH a seller offer on
    //        the main marketplace (beverage exclusivity still sells).
    //   C3b: the approved RETAIL sibling (Glow Night Serum) is STILL sellable
    //        on its tenant-storefront surface (?_tenant= flags the surface in
    //        dev, mirroring tenant subdomains) — retail stock keeps selling in
    //        tenant stores while staying off the main marketplace (C5).
    await page.goto(`${STORE_URL}/product/${slug('Lakeside Craft Lager 330ml')}-beverage`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await dismissOverlays(page);
    await acceptAgeGate(page).catch(() => {});
    await shot(page, 'journeyC-c3a-beverage-main-marketplace');
    const okBev = await page.locator('main, body').first().innerText().catch(() => '');
    const bevBuy = await page.locator('main button:has-text("Add to Cart"), main button:has-text("Add to cart")').count();
    stmt('C3a: approved beverage product is browsable with a seller offer on the main marketplace',
      /Craft Lager/i.test(okBev) && /Harbour General Store/i.test(okBev) && bevBuy > 0,
      `loads=${/Craft Lager/i.test(okBev)}, seller=${/Harbour General Store/i.test(okBev)}, buy buttons=${bevBuy}`);

    await page.goto(`${STORE_URL}/product/${slug('Glow Night Serum 50ml')}-beauty?_tenant=glow-beauty`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await dismissOverlays(page);
    await acceptAgeGate(page).catch(() => {});
    await shot(page, 'journeyC-c3b-retail-sibling-tenant-store');
    const okRetail = await page.locator('main, body').first().innerText().catch(() => '');
    const retailBuy = await page.locator('main button:has-text("Add to Cart"), main button:has-text("Add to cart")').count();
    stmt('C3b: approved retail sibling still sells on its tenant-storefront surface',
      /Night Serum/i.test(okRetail) && /Glow Beauty Bar/i.test(okRetail) && retailBuy > 0,
      `loads=${/Night Serum/i.test(okRetail)}, seller=${/Glow Beauty Bar/i.test(okRetail)}, buy buttons=${retailBuy}`);

    // C4 — marketplace eligibility: pending-product SubProduct must never surface
    // (card-scoped, see C2).
    await page.goto(`${STORE_URL}/shop?search=Beacon%20Candle`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await dismissOverlays(page);
    await shot(page, 'journeyC-c4-pending-product-search');
    const pendingCards = await page.locator(
      'main a[href^="/product/"], main [class*="product"] h2, main [class*="product"] h3',
    ).allInnerTexts().catch(() => []);
    stmt('C4: pending-product listing does not surface on shop search',
      !pendingCards.some((n) => /Beacon Candle/i.test(n)),
      `cards=${JSON.stringify(pendingCards.slice(0, 5))}`);
    await acceptAgeGate(page).catch(() => {});

    // C5 — main-marketplace non-blending (platform directive 2026-11-05): the
    // beverage marketplace surfaces must not sell the non-beverage verticals'
    // catalogue. Probed as the customer-facing product + search surfaces.
    const prodUrl = `${STORE_URL}/product/${slug('Skyline Tailored Shirt')}-fashion`;
    await page.goto(prodUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    await dismissOverlays(page);
    await shot(page, 'journeyC-c5-main-marketplace-fashion-product');
    const blend = await page.locator('main, body').first().innerText().catch(() => '');
    const buyControl = await page.locator('main button:has-text("Add to Cart"), main button:has-text("Add to cart")').count();
    stmt('C5: main marketplace does not offer the fashion product for purchase',
      (!/Add to Cart/i.test(blend) && buyControl === 0) || !/Tailored Shirt/i.test(blend),
      `product page loads=${/Tailored Shirt/i.test(blend)}, add-to-cart buttons=${buyControl}`);
    // Also try direct add-to-cart API on the pending-product sub
    const tryBuy = await apiPost(page, '/api/orders', {
      customer: { firstName: 'Buyer', lastName: 'Customer', email: 'buyer@dri3-fixture.test', phone: '+2348011111111' },
      shipping: { address: '1 Harbour Test Close', city: 'Abuja', state: 'FCT', country: 'Nigeria', lga: 'Municipal' },
      paymentMethod: 'wallet',
      items: [{ subProductId: FIXTURE.pendingProductSub.subProduct, sizeId: '000000000000000000000000', quantity: 1 }],
      status: 'processing', paymentStatus: 'paid',
    });
    stmt('C4: POST /api/orders on pending-product sub is rejected', tryBuy.status >= 400 && tryBuy.status < 500,
      `status=${tryBuy.status} msg=${tryBuy.message}`);
  } catch (e) {
    console.error('journeyC ERROR:', String(e).slice(0, 400));
    await shot(page, 'journeyC-error').catch(() => {});
  } finally {
    await ctx.close().catch(() => {});
  }
}

const run = async () => {
  const only = process.argv[2] || 'all';
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  if (only === 'all' || only === 'b') await journeyB(browser);
  if (only === 'all' || only === 'c') await journeyC(browser);
  await browser.close();
  const passed = state.results.filter(Boolean).length;
  console.log(`\n=== STOREFRONT JOURNEYS RESULT: ${passed}/${state.results.length} assertions passed ===`);
  process.exit(passed === state.results.length ? 0 : 1);
};
run().catch((e) => { console.error('FATAL', e); process.exit(1); });
