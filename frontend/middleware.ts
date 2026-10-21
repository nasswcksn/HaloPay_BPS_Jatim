import { NextRequest, NextResponse } from 'next/server';
import { decodeJwt } from 'jose';


const SESSION_COOKIE_NAME = 'bps_payroll_session';

function getBaseUrl(request: NextRequest): string {
  let clientHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  if (clientHost.startsWith('0.0.0.0')) {
    clientHost = clientHost.replace('0.0.0.0', 'localhost');
  }
  const forwardedProto = request.headers.get('x-forwarded-proto');
  let envProto: string | null = null;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    envProto = process.env.NEXT_PUBLIC_APP_URL.startsWith('https') ? 'https' : 'http';
  }
  const protocol = forwardedProto || envProto || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
  return `${protocol}://${clientHost}`;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const baseUrl = getBaseUrl(request);

  // Lewati file statis dan API internal
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session: any = null;

  if (token) {
    try {
      const payload = decodeJwt(token);
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        session = null;
      } else {
        session = payload;
      }
    } catch {
      session = null;
    }
  }

  // Jika di root ('/')
  if (pathname === '/') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', baseUrl));
    }
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  // Halaman Login
  if (pathname === '/login') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', baseUrl));
    }
    return NextResponse.next();
  }

  // Halaman Admin (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', baseUrl));
    }
    if (session.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', baseUrl));
    }
    return NextResponse.next();
  }

  // Halaman Karyawan (/dashboard/*)
  if (pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', baseUrl));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public static files (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
