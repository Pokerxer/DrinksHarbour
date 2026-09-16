// Run with:  node --experimental-strip-types --test src/lib/crawler.test.mjs
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { isCrawlerUserAgent } from './crawler.ts';

test('recognises search-engine crawlers', () => {
  for (const ua of [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (compatible; DuckDuckBot-Https/1.1; https://duckduckgo.com/duckduckbot)',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  ]) {
    assert.equal(isCrawlerUserAgent(ua), true, `expected crawler: ${ua}`);
  }
});

test('recognises social preview and AI crawlers', () => {
  for (const ua of [
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/[1.0]',
    'LinkedInBot/1.0',
    'WhatsApp/2.23.20.0',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0',
    'Mozilla/5.0 (compatible; PerplexityBot/1.0; https://perplexity.ai)',
    'ccbot/2.0 (+https://commoncrawl.org/faq/)',
    'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
  ]) {
    assert.equal(isCrawlerUserAgent(ua), true, `expected crawler: ${ua}`);
  }
});

test('treated a regular browser User-Agent as a visitor', () => {
  for (const ua of [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 HeadlessChrome/128.0.0.0', // ordinary browser verdicts, not bot-named
  ]) {
    assert.equal(isCrawlerUserAgent(ua), false, `expected visitor: ${ua}`);
  }
});

test('returns false for empty or missing User-Agent', () => {
  assert.equal(isCrawlerUserAgent(null), false);
  assert.equal(isCrawlerUserAgent(undefined), false);
  assert.equal(isCrawlerUserAgent(''), false);
});

test('a truncated "bot" never matches on its own', () => {
  // A bare "bot" substring (robot, cubot, etc.) must not flag a real visitor.
  assert.equal(isCrawlerUserAgent('Cubot smartphone PrestaShop module'), false);
});