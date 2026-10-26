/**
 * URL publik aplikasi dari konfigurasi server (NEXT_PUBLIC_APP_URL).
 * Seluruh redirect dibangun dari nilai ini, bukan dari header Host / X-Forwarded-Host
 * yang dapat dimanipulasi klien (mencegah open redirect & cache poisoning).
 * Tanpa dependensi Node agar dapat diimpor oleh middleware.
 */
export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
}
