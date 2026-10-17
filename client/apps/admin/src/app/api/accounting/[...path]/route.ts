// Same-origin Accounting transport. Authorization remains enforced by the backend.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ path: string[] }> };
const forwardedHeaders = [
  'authorization',
  'content-type',
  'x-tenant-slug',
  'x-mfa-token',
  'x-csrf-token',
];
const unavailable = (method: string) =>
  Response.json(
    {
      success: false,
      message: ['GET', 'HEAD'].includes(method)
        ? 'Accounting server could not be reached. Wait a moment, then retry.'
        : 'Accounting action could not be confirmed. Refresh records before trying again.',
    },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } }
  );
async function forward(request: Request, context: Context) {
  const { path } = await context.params;
  if (!path.length || path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)))
    return Response.json(
      { success: false, message: 'Invalid Accounting path' },
      { status: 400 }
    );
  try {
    const base = new URL(
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'
    );
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password
    )
      return unavailable(request.method);
    const url = `${base.toString().replace(/\/$/, '')}/api/accounting/${path.join('/')}${new URL(request.url).search}`;
    const headers = new Headers();
    for (const name of forwardedHeaders) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      cache: 'no-store',
      redirect: 'manual',
      ...(!['GET', 'HEAD'].includes(request.method)
        ? { body: await request.arrayBuffer() }
        : {}),
    });
    if (upstream.status >= 300 && upstream.status < 400)
      return unavailable(request.method);
    const responseHeaders = new Headers({
      'Cache-Control': 'private, no-store',
    });
    for (const name of ['content-type', 'content-disposition']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return unavailable(request.method);
  }
}
export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
