import { headers } from 'next/headers';
import { isCrawlerUserAgent } from './crawler';

/**
 * Request-scoped crawler detection for Server Components.
 *
 * Reads the request `user-agent` header and reports whether the hit comes from
 * a known search/AI crawler. Use it to gate content that should reach crawlers
 * but stay off the page a human visitor sees.
 */
export async function isCrawlerRequest(): Promise<boolean> {
  const headersList = await headers();
  return isCrawlerUserAgent(headersList.get('user-agent'));
}