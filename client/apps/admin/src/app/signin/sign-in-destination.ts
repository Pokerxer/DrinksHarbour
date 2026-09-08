import { routes } from '@/config/routes';

/** Keep deep links through password and MFA sign-in without allowing external redirects. */
export function signInDestination(search: string, origin: string): string {
  const fallback = new URL(routes.dashboard, origin).href;
  const callback = new URLSearchParams(search).get('callbackUrl');
  if (!callback) return fallback;
  try {
    const url = new URL(callback, origin);
    if (
      url.origin !== origin || url.username || url.password ||
      url.pathname === '/signin' || url.pathname.startsWith('/signin/') ||
      url.pathname.startsWith('/api/auth/')
    ) return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}
