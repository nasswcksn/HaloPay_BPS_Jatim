import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/utils/auth';
import { buildLogoutUrl } from '@/utils/keycloak';

export async function POST(request: NextRequest) {
  let host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  if (host.startsWith('0.0.0.0')) {
    host = host.replace('0.0.0.0', 'localhost');
  }
  const forwardedProto = request.headers.get('x-forwarded-proto');
  let envProto: string | null = null;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    envProto = process.env.NEXT_PUBLIC_APP_URL.startsWith('https') ? 'https' : 'http';
  }
  const protocol = forwardedProto || envProto || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
  const postLogoutRedirectUri = `${protocol}://${host}/login`;

  const keycloakLogoutUrl = buildLogoutUrl(postLogoutRedirectUri);

  const response = NextResponse.json({
    success: true,
    message: 'Logout berhasil',
    keycloakLogoutUrl,
  });

  // Hapus cookie sesi lokal HaloPay
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });

  return response;
}

export async function GET(request: NextRequest) {
  let host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
  if (host.startsWith('0.0.0.0')) {
    host = host.replace('0.0.0.0', 'localhost');
  }
  const forwardedProto = request.headers.get('x-forwarded-proto');
  let envProto: string | null = null;
  if (process.env.NEXT_PUBLIC_APP_URL) {
    envProto = process.env.NEXT_PUBLIC_APP_URL.startsWith('https') ? 'https' : 'http';
  }
  const protocol = forwardedProto || envProto || (request.nextUrl.protocol ? request.nextUrl.protocol.replace(':', '') : 'http');
  const postLogoutRedirectUri = `${protocol}://${host}/login`;

  const keycloakLogoutUrl = buildLogoutUrl(postLogoutRedirectUri);

  const response = NextResponse.redirect(keycloakLogoutUrl);

  // Hapus cookie sesi lokal HaloPay
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });

  return response;
}
