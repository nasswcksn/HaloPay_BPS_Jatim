import { NextResponse } from 'next/server';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthorizationUrl,
} from '@/utils/keycloak';
import { isSecureCookie } from '@/utils/auth';
import { getAppUrl } from '@/utils/app-url';

export async function GET() {
  try {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const isHttps = isSecureCookie();

    // redirect_uri diambil dari NEXT_PUBLIC_APP_URL (lihat getKeycloakConfig)
    const authUrl = buildAuthorizationUrl({
      state,
      codeChallenge,
      prompt: 'login', // Memaksa Keycloak selalu meminta kredensial ulang (mencegah auto-login setelah logout)
    });

    const response = NextResponse.redirect(authUrl);

    // Simpan code_verifier dan state ke cookies terenkripsi/HTTP-Only sementara (10 menit)
    // Cookie diberi flag secure jika NEXT_PUBLIC_APP_URL menggunakan HTTPS
    response.cookies.set('kc_pkce_verifier', codeVerifier, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 menit
      path: '/',
    });

    response.cookies.set('kc_auth_state', state, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 menit
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error saat inisialisasi login Keycloak:', error);
    return NextResponse.redirect(new URL('/login?error=init_failed', getAppUrl()));
  }
}
