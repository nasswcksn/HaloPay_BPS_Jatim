import { cookies } from 'next/headers';
import { getAppUrl } from '@/utils/app-url';
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionPayload } from '@/utils/session';

export { SESSION_COOKIE_NAME, type SessionPayload };
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 Jam

/**
 * Flag Secure cookie ditentukan dari konfigurasi server (NEXT_PUBLIC_APP_URL),
 * bukan dari header x-forwarded-proto yang dapat dimanipulasi oleh klien.
 */
export function isSecureCookie(): boolean {
  return getAppUrl().startsWith('https://');
}

/**
 * Mengambil sesi pengguna aktif dari HTTP-Only cookie di sisi Server,
 * diverifikasi oleh backend FastAPI (tanda tangan, akun, dan role terkini).
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
