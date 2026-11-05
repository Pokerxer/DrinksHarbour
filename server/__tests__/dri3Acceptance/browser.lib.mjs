'use strict';
/**
 * DRI-3 browser acceptance driver (authenticated, real UI).
 * Run from client/apps/admin so @playwright/test resolves:
 *   node __tests__/dri3Acceptance/browser.journey.mjs <step> [...]
 * Test-only credentials from the dri3 fixture. No live data.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const ADMIN_APP_DIR = '/Users/mac/Documents/drinksharbour/client/apps/admin';
const require = createRequire(ADMIN_APP_DIR + '/package.json');
const { chromium } = require('@playwright/test');

const API_URL = process.env.DRI3_API_URL || 'http://127.0.0.1:5301';
const ADMIN_URL = process.env.DRI3_ADMIN_URL || 'http://localhost:3000';
const STORE_URL = process.env.DRI3_STORE_URL || 'http://localhost:3002';
const PASSWORD = 'Dri3-Fixture-Pass!2026';
const SHOT_DIR = process.env.DRI3_EVIDENCE_DIR || '/private/var/folders/6r/48j62g153yngdnhfnh9jzz940000gn/T/opencode/dri3/evidence';

fs.mkdirSync(SHOT_DIR, { recursive: true });

export function shot(page, name) {
  return page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true }).then(() => console.log(`📸 ${name}`));
}
export async function stmt(name, cond, detail = '') {
  const ok = cond === true;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  return ok;
}
export async function loginAdmin(page, email, { tries = 2 } = {}) {
  console.log('→ goto /signin');
  await page.goto(ADMIN_URL + '/signin', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1500);

  for (let attempt = 1; attempt <= tries; attempt++) {
    console.log('→ filling form for', email, `(attempt ${attempt})`);
    const emailInput = page.locator('input[name="email"], input#email, input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    const passInput = page.locator('input[name="password"], input[type="password"]').first();
    await emailInput.fill(email);
    await passInput.fill(PASSWORD);
    // Flaky re-mount can clear controlled inputs between fill and submit — verify.
    if ((await emailInput.inputValue()) !== email || (await passInput.inputValue()) !== PASSWORD) {
      await emailInput.fill(email);
      await passInput.fill(PASSWORD);
    }
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 45000 }).catch(() => {}),
      page.locator('button:has-text("Sign in")').first().click(),
    ]);
    await page.waitForTimeout(3500);
    if (!page.url().includes('/signin')) {
      console.log('→ login ok, now at', page.url());
      return page;
    }
  }
  throw new Error(`login failed after ${tries} attempts (still on ${page.url()})`);
}
export async function launch({ trace = true } = {}) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (trace) await ctx.tracing.start({ screenshots: true, snapshots: true });
  return { browser, ctx };
}
export async function teardown({ browser, ctx }, name = 'dri3') {
  if (ctx) await ctx.tracing?.stop({ path: `${SHOT_DIR}/${name}-trace.zip` }).catch(() => {});
  await browser.close();
}
