import { NextRequest, NextResponse } from 'next/server';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  buildAuthorizationUrl,
  getKeycloakConfig,
} from '@/utils/keycloak';

export async function GET(request: NextRequest) {
  try {
    const config = getKeycloakConfig();
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Dapatkan origin saat ini (bisa localhost:3000 atau domain lokal BPS)
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

    const authUrl = buildAuthorizationUrl({
      state,
      codeChallenge,
      customRedirectUri: dynamicRedirectUri,
      prompt: 'login', // Memaksa Keycloak selalu meminta kredensial ulang (mencegah auto-login setelah logout)
    });

    const response = NextResponse.redirect(authUrl);

    // Simpan code_verifier dan state ke cookies terenkripsi/HTTP-Only sementara (10 menit)
    // Cookie hanya diberi flag secure jika koneksi menggunakan HTTPS
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
    let clientHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    if (clientHost.startsWith('0.0.0.0')) {
      clientHost = clientHost.replace('0.0.0.0', 'localhost');
    }
    const protocol = request.headers.get('x-forwarded-proto') || (clientHost.includes('localhost') || clientHost.includes('127.0.0.1') ? 'http' : 'https');
    return NextResponse.redirect(
      new URL('/login?error=init_failed', `${protocol}://${clientHost}`)
    );
  }
}
