import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = ['/owner', '/admin', '/dashboard'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = protectedPrefixes.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const hasAuthCookie = req.cookies.getAll().some((c) => c.name.includes('sb-') && c.name.endsWith('auth-token'));
  if (hasAuthCookie) return NextResponse.next();

  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/owner/:path*', '/admin/:path*', '/dashboard/:path*'],
};
