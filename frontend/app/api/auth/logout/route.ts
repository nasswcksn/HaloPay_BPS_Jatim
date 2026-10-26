import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, isSecureCookie } from '@/utils/auth';
import { buildLogoutUrl } from '@/utils/keycloak';

// post_logout_redirect_uri diambil dari NEXT_PUBLIC_APP_URL (lihat buildLogoutUrl)
function clearSessionCookie(response: NextResponse) {
  // Hapus cookie sesi lokal HaloPay
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
  return response;
}

export async function POST() {
  const keycloakLogoutUrl = buildLogoutUrl();
  return clearSessionCookie(
    NextResponse.json({
      success: true,
      message: 'Logout berhasil',
      keycloakLogoutUrl,
    })
  );
}

export async function GET() {
  return clearSessionCookie(NextResponse.redirect(buildLogoutUrl()));
}
