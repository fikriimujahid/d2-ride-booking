import { NextResponse } from 'next/server';
import {
  applyAuthCookies,
  applyClearAuthCookies,
  backendDriverRefresh,
  getAuthApiBaseUrlForProxy,
  readAccessTokenCookie,
  readRefreshTokenCookie,
} from '@/lib/auth/server';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function filterRequestHeaders(headers: Headers) {
  const next = new Headers();
  headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    if (key.toLowerCase() === 'host') return;
    // We always set auth server-side.
    if (key.toLowerCase() === 'authorization') return;
    next.set(key, value);
  });
  return next;
}

async function proxyOnce(req: Request, backendUrl: string, accessToken: string | null) {
  const headers = filterRequestHeaders(req.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  // Read body only for methods that can have one.
  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  return fetch(backendUrl, {
    method,
    headers,
    body,
    // never forward browser credentials to backend; cookies are handled in this app
    redirect: 'manual',
  });
}

async function handleProxy(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;

  // Don’t let clients call backend auth endpoints directly through the proxy.
  if (path[0] === 'driver' && path[1] === 'auth') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const base = getAuthApiBaseUrlForProxy();
  const url = new URL(req.url);
  const backendUrl = `${base}/${path.join('/')}${url.search}`;

  const accessToken = await readAccessTokenCookie();
  const first = await proxyOnce(req, backendUrl, accessToken);

  // Happy path
  if (first.status !== 401) {
    const payload = await first.arrayBuffer();
    const res = new NextResponse(payload, {
      status: first.status,
      headers: first.headers,
    });
    return res;
  }

  // Try refresh once (server-side) and retry.
  const refreshToken = await readRefreshTokenCookie();
  if (!refreshToken) {
    const res = NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    applyClearAuthCookies(res);
    return res;
  }

  const refreshed = await backendDriverRefresh(refreshToken);
  if (!refreshed.ok) {
    const res = NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    applyClearAuthCookies(res);
    return res;
  }

  const retry = await proxyOnce(req, backendUrl, refreshed.tokens.accessToken);
  const retryPayload = await retry.arrayBuffer();

  const res = new NextResponse(retryPayload, {
    status: retry.status,
    headers: retry.headers,
  });

  applyAuthCookies(res, refreshed.tokens);
  return res;
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, ctx);
}
export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, ctx);
}
export async function PUT(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, ctx);
}
export async function PATCH(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, ctx);
}
export async function DELETE(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return handleProxy(req, ctx);
}
