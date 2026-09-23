export function proxyAction(path: string[]) {
  if (path.length !== 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path[0]) || path[0].length > 120)
    return null;
  if (!['session', 'scan', 'config'].includes(path[1])) return null;
  return { slug: path[0], action: path[1] };
}
export function sameOrigin(origin: string | null, url: string, host?: string | null) {
  try {
    const expected = new URL(url);
    if (host) expected.host = host;
    return !!origin && new URL(origin).origin === expected.origin;
  } catch {
    return false;
  }
}
