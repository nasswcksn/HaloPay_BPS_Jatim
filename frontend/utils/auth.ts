import { decodeJwt } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'bps_payroll_session';
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 Jam

export interface SessionPayload {
  id: string;
  nip: string;
  nama_lengkap: string;
  username_slug: string;
  role: 'admin' | 'karyawan';
  email?: string;
  jabatan?: string;
  satker?: string;
  username?: string;
  exp?: number;
}

/**
 * Mengambil sesi pengguna aktif dari HTTP-Only cookies di sisi Server.
 * Didekode tanpa memerlukan JWT_SECRET karena verifikasi integritas kriptografis
 * dilakukan oleh backend FastAPI pada setiap panggilan API data.
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = decodeJwt(token);
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
