import { NextRequest, NextResponse } from 'next/server';
import { proxyAction, sameOrigin } from '../../../../components/price-checker/proxy-policy';
export const dynamic = 'force-dynamic';
const API = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5001'
).replace(/\/$/, '');
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function handle(req: NextRequest, params: Promise<{ path: string[] }>) {
  const operation = proxyAction((await params).path);
  if (!operation) return response({ success: false }, 404);
  const { slug, action } = operation;
  if ((action === 'config') !== (req.method === 'GET')) return response({ success: false }, 405);
  if (
    req.method === 'POST' &&
    !sameOrigin(req.headers.get('origin'), req.url, req.headers.get('host'))
  )
    return response({ success: false }, 403);
  const cookie = `dh_price_checker_${slug}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (action !== 'session') {
    const token = req.cookies.get(cookie)?.value;
    if (!token) return response({ success: false }, 401);
    headers['X-Price-Checker-Session'] = token;
  }
  try {
    let body: string | undefined;
    if (action === 'session') body = JSON.stringify({ slug });
    else if (action === 'scan') {
      const raw = await req.text();
      if (raw.length > 2048) return response({ success: false }, 413);
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return response({ success: false }, 400);
      body = JSON.stringify(parsed);
    }
    const upstream = await fetch(`${API}/api/price-checker/${action}`, {
      method: req.method,
      headers,
      ...(body ? { body } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok)
      return response(
        { success: false },
        [400, 401, 403, 404, 409, 429].includes(upstream.status) ? upstream.status : 503
      );
    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return response({ success: false }, 503);
    const data = 'data' in payload ? payload.data : undefined;
    const result = response({ success: true, data });
    if (action === 'session') {
      if (!('token' in payload) || typeof payload.token !== 'string')
        return response({ success: false }, 503);
      result.cookies.set(cookie, payload.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600,
        path: `/api/price-checker/${slug}`,
      });
    }
    return result;
  } catch (error) {
    return response({ success: false }, error instanceof SyntaxError ? 400 : 503);
  }
}
export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(req, context.params);
}
export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handle(req, context.params);
}
