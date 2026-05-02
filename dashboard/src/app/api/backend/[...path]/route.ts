import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendBaseForProxy } from '@/lib/backend-base';

const CONFIG_ERROR_BODY = JSON.stringify({
  ok: false,
  error:
    'Dashboard proxy: backend URL is not set. In Vercel → Project → Environment Variables, add BACKEND_URL (or NEXT_PUBLIC_API_URL) = your Railway service URL, e.g. https://xxxx.up.railway.app — then redeploy.',
});

async function forward(req: NextRequest, method: 'GET' | 'POST' | 'PATCH') {
  const BACKEND_BASE = resolveBackendBaseForProxy();
  if (!BACKEND_BASE) {
    return new NextResponse(CONFIG_ERROR_BODY, {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const parts = req.nextUrl.pathname.split('/').slice(3); // /api/backend/*
  const path = parts.join('/');
  const url = `${BACKEND_BASE}/${path}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  const contentType = req.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;
  const body = method === 'GET' ? undefined : await req.text();

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, cache: 'no-store' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(
      JSON.stringify({
        ok: false,
        error: `Proxy could not reach backend at ${BACKEND_BASE}: ${msg}`,
      }),
      { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } },
    );
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
  });
}

export async function GET(req: NextRequest) {
  return forward(req, 'GET');
}

export async function POST(req: NextRequest) {
  return forward(req, 'POST');
}

export async function PATCH(req: NextRequest) {
  return forward(req, 'PATCH');
}
