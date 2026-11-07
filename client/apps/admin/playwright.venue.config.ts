import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'venue-checkout.spec.ts', fullyParallel: false,
  reporter: 'list', outputDir: '/private/tmp/drinksharbour-venue-browser-results',
  use: { baseURL: 'http://127.0.0.1:5197', channel: 'chrome', headless: true },
  webServer: { command: './node_modules/.bin/vite --config vite.venue.config.ts --host 127.0.0.1 --port 5197 --strictPort', url: 'http://127.0.0.1:5197/e2e/venue-fixture.html', reuseExistingServer: false },
});
