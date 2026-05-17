// This page is intentionally unreachable in normal operation.
// The beforeFiles rewrite in next.config.mjs maps /point-of-sale/sell
// to /pos/sell which renders without the admin header/sidebar.
import { redirect } from 'next/navigation';
export default function POSSellFallback() {
  redirect('/pos/sell');
}
