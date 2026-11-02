import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/utils/keycloak';
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  isSecureCookie,
} from '@/utils/auth';
import { getAppUrl } from '@/utils/app-url';



export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  const baseUrl = getAppUrl();

  // Hanya kode error tetap yang dikirim ke halaman login (pesan dipetakan di sana), sehingga
  // teks dari query string / Keycloak / backend tidak pernah ditampilkan apa adanya ke pengguna.
  const buildErrorRedirect = (code: string) => {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, baseUrl));
  };

  // 1. Cek error dari Keycloak
  if (error) {
    console.error('Keycloak Auth Callback Error:', error, errorDescription);
    return buildErrorRedirect(error === 'access_denied' ? 'access_denied' : 'sso_error');
  }

  if (!code) {
    return buildErrorRedirect('missing_code');
  }

  // 2. Validasi State CSRF
  const savedState = request.cookies.get('kc_auth_state')?.value;
  if (!state || state !== savedState) {
    return buildErrorRedirect('invalid_state');
  }

  // 3. Ambil PKCE Verifier
  const codeVerifier = request.cookies.get('kc_pkce_verifier')?.value;
  if (!codeVerifier) {
    return buildErrorRedirect('missing_verifier');
  }

  try {
    // 4. Tukar OIDC Authorization Code dengan Access Token & ID Token
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier,
    });

    if (tokens.error || !tokens.access_token) {
      console.error('Exchange Token Error:', tokens);
      return buildErrorRedirect('token_exchange_failed');
    }

    // 5. Kirim Token Resmi Keycloak ke FastAPI Backend untuk Diverifikasi Kriptografis (RS256 JWKS)
    const backendBase =
      process.env.FASTAPI_INTERNAL_URL || 'http://127.0.0.1:8000';
    let sessionToken: string | null = null;

    try {
      const syncRes = await fetch(`${backendBase}/api/v1/auth/sync-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: tokens.id_token,
          access_token: tokens.access_token,
        }),
      });

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        sessionToken = syncData.access_token || null;
      } else {
        const errJson = await syncRes.json().catch(() => ({}));
        console.error('Sync session error, status:', syncRes.status, errJson);
        // Backend mengembalikan 400 jika token valid tetapi tidak memuat klaim NIP resmi
        return buildErrorRedirect(syncRes.status === 400 ? 'nip_missing' : 'sync_failed');
      }
    } catch (syncErr) {
      console.error('Failed to sync user session with backend:', syncErr);
      return buildErrorRedirect('backend_unreachable');
    }

    if (!sessionToken) {
      return buildErrorRedirect('sync_failed');
    }


    // 8. Buat Respon Redirect ke Dashboard
    const response = NextResponse.redirect(new URL('/dashboard', baseUrl));

    // Simpan Cookie Sesi
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: isSecureCookie(),
      sameSite: 'lax',
      maxAge: SESSION_DURATION_SECONDS,
      path: '/',
    });

    // Hapus Cookie PKCE Sementara
    response.cookies.delete('kc_pkce_verifier');
    response.cookies.delete('kc_auth_state');

    return response;
  } catch (err: any) {
    console.error('Unhandled Keycloak Callback Exception:', err);
    return buildErrorRedirect('internal_error');
  }
}
