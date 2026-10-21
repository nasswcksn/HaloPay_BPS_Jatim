import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/utils/keycloak';
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from '@/utils/auth';



export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

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
  const isHttps = protocol === 'https';
  const baseUrl = `${protocol}://${clientHost}`;
  const dynamicRedirectUri = `${baseUrl}/api/auth/callback`;

  const buildErrorRedirect = (msg: string) => {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, baseUrl));
  };

  // 1. Cek error dari Keycloak
  if (error) {
    console.error('Keycloak Auth Callback Error:', error, errorDescription);
    return buildErrorRedirect(errorDescription || error || 'Autentikasi Keycloak dibatalkan atau ditolak.');
  }

  if (!code) {
    return buildErrorRedirect('Kode otorisasi (code) tidak diterima dari Keycloak.');
  }

  // 2. Validasi State CSRF
  const savedState = request.cookies.get('kc_auth_state')?.value;
  if (!state || state !== savedState) {
    return buildErrorRedirect('Validasi keamanan gagal (state mismatch). Silakan coba login kembali.');
  }

  // 3. Ambil PKCE Verifier
  const codeVerifier = request.cookies.get('kc_pkce_verifier')?.value;
  if (!codeVerifier) {
    return buildErrorRedirect('PKCE Verifier kedaluwarsa atau tidak ditemukan. Silakan login kembali.');
  }

  try {
    // 4. Tukar OIDC Authorization Code dengan Access Token & ID Token
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier,
      customRedirectUri: dynamicRedirectUri,
    });

    if (tokens.error || !tokens.access_token) {
      console.error('Exchange Token Error:', tokens);
      return buildErrorRedirect(
        tokens.error_description || tokens.error || 'Gagal menukarkan kode token dengan Keycloak BPS.'
      );
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
        const errMsg = errJson.detail || 'Gagal memvalidasi token sesi SSO dengan backend.';
        return buildErrorRedirect(errMsg);
      }
    } catch (syncErr) {
      console.error('Failed to sync user session with backend:', syncErr);
      return buildErrorRedirect('Gagal menghubungkan ke backend untuk inisialisasi sesi login.');
    }

    if (!sessionToken) {
      return buildErrorRedirect('Token sesi tidak berhasil diterbitkan oleh backend.');
    }


    // 8. Buat Respon Redirect ke Dashboard
    const response = NextResponse.redirect(new URL('/dashboard', baseUrl));

    // Simpan Cookie Sesi
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: isHttps,
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
    return buildErrorRedirect('Terjadi kesalahan internal saat memproses autentikasi SSO.');
  }
}
