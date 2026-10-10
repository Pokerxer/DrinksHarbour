// Isolated accounting view audit. Uses real report/KPI components and sample amounts.
const path = require('path');
const root = path.resolve(__dirname, '..');
const admin = path.join(root, 'client/apps/admin');
const req = require('module').createRequire(path.join(admin, 'package.json'));
const vite = require('module').createRequire(req.resolve('vitest/package.json'));
const esbuild = require('module').createRequire(vite.resolve('vite'))('esbuild');
const { chromium } = require('playwright');
(async () => {
  const pl = { revenueTotal: 802, sales: { gross: 1000, reversals: 200, net: 800, documentCount: 1 }, otherIncome: 2,
    cogs: { total: 320, source: 'journal' }, expenseTotal: 50, grossProfit: 480, netProfit: 432,
    tax: { collected: 60, paid: 0, ledgerCollected: 0, ledgerPaid: 0, reconciled: false, source: 'journal' } };
  const kpis = { revenueMtd: 802, salesMtd: 800, salesReversalsMtd: 200, postedSalesCount: 1,
    expensesMtd: 370, grossProfitMtd: 480, netProfitMtd: 432, taxCollectedMtd: 60, taxPaidMtd: 0, unpostedDraftCount: 0 };
  const bundle = await esbuild.build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
    import Report from './src/app/shared/accounting/pl-table';
    import Kpis from './src/app/shared/accounting/accounting-dashboard-kpis';
    import TaxCard from './src/app/shared/accounting/accounting-dashboard-tax-card';
    createRoot(document.getElementById('root')).render(<main style={{padding:12}}><Kpis data={${JSON.stringify(kpis)}}/><Report data={${JSON.stringify(pl)}}/><TaxCard profitLoss={${JSON.stringify(pl)}}/></main>);`, resolveDir: admin, loader: 'tsx' },
    bundle: true, write: false, jsx: 'automatic', alias: { '@': path.join(admin, 'src') }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'links', setup(build) {
      build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default function Link(props){return <a {...props}/>}', loader: 'tsx', resolveDir: admin }));
    } }],
  });
  const css = await req('postcss')([req('tailwindcss')({ content: [admin + '/src/app/shared/accounting/*.tsx'] })]).process('@tailwind base; @tailwind utilities;', { from: undefined });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>${css.css}</style><div id="root"></div>`);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.getByText('Net sales (excl. VAT)', { exact: true }).waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw new Error(`Accounting layout overflows at ${width}`);
      const cells = await page.locator('tbody tr').evaluateAll(rows => rows.map(row => row.cells.length));
      if (cells.some(count => count !== 3)) throw new Error('Report column alignment failed');
      const warnings = await page.getByRole('alert').count();
      if (warnings !== 2) throw new Error('Missing VAT reconciliation disclosure');
      console.log(JSON.stringify({ width, overflow, reportRows: cells.length, warnings, passed: true }));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
