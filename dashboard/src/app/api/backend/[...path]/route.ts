import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE = (
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
  'http://localhost:3000'
).replace(/\/+$/, '');

async function forward(req: NextRequest, method: 'GET' | 'POST' | 'PATCH') {
  const parts = req.nextUrl.pathname.split('/').slice(3); // /api/backend/*
  const path = parts.join('/');
  const url = `${BACKEND_BASE}/${path}${req.nextUrl.search}`;
  const headers: Record<string, string> = {};
  const contentType = req.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;
  const body = method === 'GET' ? undefined : await req.text();
  const res = await fetch(url, { method, headers, body, cache: 'no-store' });
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
