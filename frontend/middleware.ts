import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl } from '@/utils/app-url';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/utils/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const baseUrl = getAppUrl();

  // Lewati file statis dan API internal
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Sesi diverifikasi ke backend; cookie palsu, kedaluwarsa, atau milik akun yang sudah
  // dihapus dianggap tidak ada (juga mencegah loop redirect /login <-> /dashboard).
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);

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
