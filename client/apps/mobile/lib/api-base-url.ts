/**
 * Where the backend actually is.
 *
 * `.env` cannot answer this on its own during development. It has to name a
 * host reachable *from the phone*, so `localhost` is wrong (on a device that is
 * the phone itself) and a hand-typed LAN IP is wrong the moment the Mac changes
 * network — which is exactly how `http://172.20.10.3:5001` came to point at
 * nothing while the backend sat healthy on another subnet.
 *
 * Expo already knows the address it is serving the bundle from, and that is by
 * construction the development machine. So a local address in `.env` is treated
 * as "the dev machine, on this port" and the host is re-derived at startup.
 *
 * A public host is never rewritten: doing so would aim a release build at
 * whatever laptop last ran Metro.
 */

/** localhost, loopback, and the three RFC-1918 ranges. */
const LOCAL_HOST =
  /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/i;

/** `hostUri` is `host:port`, sometimes with a path glued on. We want the host. */
function hostOf(hostUri: string): string | null {
  const host = hostUri.split('/')[0]?.split(':')[0];
  return host ? host : null;
}

export function resolveApiBaseUrl(
  configured: string | undefined | null,
  hostUri: string | undefined | null
): string {
  if (!configured) {
    throw new Error('EXPO_PUBLIC_API_URL is not set — copy .env.example to .env and set it');
  }

  const trimmed = configured.replace(/\/+$/, '');

  const parts = /^(https?:\/\/)([^/:]+)(:\d+)?(.*)$/i.exec(trimmed);
  if (!parts) return trimmed;

  const [, scheme, host, port = '', rest = ''] = parts;

  // A real hostname is already reachable from anywhere. Leave it be.
  if (!LOCAL_HOST.test(host)) return trimmed;

  // No dev server (a production build) — the configured value is all there is.
  if (!hostUri) return trimmed;

  const devHost = hostOf(hostUri);
  if (!devHost) return trimmed;

  return `${scheme}${devHost}${port}${rest}`;
}
