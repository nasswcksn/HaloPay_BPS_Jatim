export const SESSION_COOKIE_NAME = 'bps_payroll_session';

export interface SessionPayload {
  id: string;
  nip: string;
  nama_lengkap: string;
  username: string;
  role: 'admin' | 'karyawan';
  email?: string | null;
  jabatan?: string | null;
  satker?: string | null;
}

/**
 * Memverifikasi token sesi ke backend FastAPI (tanda tangan JWT, keberadaan akun,
 * dan role terkini dari database). Mengembalikan null jika token tidak sah.
 * Isi cookie tidak pernah dipercaya tanpa verifikasi ini, karena cookie dapat dipalsukan klien.
 * Tanpa dependensi Node agar dapat diimpor oleh middleware.
 */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const backendBase = process.env.FASTAPI_INTERNAL_URL || 'http://127.0.0.1:8000';
  try {
    const res = await fetch(`${backendBase}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as SessionPayload;
  } catch {
    return null;
  }
}
