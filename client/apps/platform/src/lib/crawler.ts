/**
 * Crawler detection for product pages.
 *
 * Product pages render some content — buying guides, cross-link collections —
 * exclusively for search-engine and AI crawlers, keeping the surface a human
 * visitor actually sees focused on the purchase flow. This module holds the
 * pure User-Agent check (unit-testable without Next.js); the request-scoped
 * async helper lives in crawlerRequest.ts.
 */

// Major search engines, social/link previews, and AI summarisers. Kept to a
// small, deliberate list rather than a blanket "bot" match so ordinary browser
// requests (which can carry plugin suffixes like "HeadlessChrome") are never
// mistaken for crawlers.
const CRAWLER_PATTERNS = [
  'googlebot',
  'bingbot',
  'duckduckbot',
  'baiduspider',
  'yandex',
  'slurp', // Yahoo
  'sogou',
  'exabot',
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  'pinterest',
  'whatsapp',
  'telegrambot',
  'discordbot',
  'slackbot',
  'skypeuripreview',
  'vkShare',
  'applebot',
  'ia_archiver',
  'archive.org_bot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'petalbot',
  'bytespider', // ByteDance / TikTok crawler
  'gptbot',
  'perplexitybot',
  'claudebot',
  'anthropic-ai',
  'ccbot',
  'imagesiftbot',
  'chatgpt',
  'google-inspectiontool',
];

/** Pure check — returns true when the User-Agent belongs to a known crawler. */
export function isCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some((pattern) => ua.includes(pattern.toLowerCase()));
}