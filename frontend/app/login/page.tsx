'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  Lock,
} from 'lucide-react';

function LoginFormContent() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const [redirecting, setRedirecting] = useState(false);

  const getErrorMessage = (code: string | null) => {
    if (!code) return null;
    switch (code) {
      case 'access_denied':
        return 'Proses masuk dibatalkan atau izin akses ditolak oleh pengguna.';
      case 'invalid_state':
        return 'Sesi autentikasi telah kedaluwarsa untuk alasan keamanan. Silakan klik tombol masuk kembali.';
      case 'missing_code':
        return 'Kode otorisasi tidak diterima dari server Keycloak.';
      case 'missing_verifier':
        return 'Sesi verifikasi peramban tidak ditemukan. Silakan login kembali.';
      case 'token_exchange_failed':
        return 'Gagal menukarkan token dengan server Keycloak BPS.';
      default:
        return decodeURIComponent(code);
    }
  };

  const errorMessage = getErrorMessage(errorParam);

  const handleKeycloakLogin = () => {
    setRedirecting(true);
    // Mengarahkan ke API route yang menangani handshake PKCE OIDC Keycloak
    window.location.href = '/api/auth/keycloak/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden">
        {/* Header Instansi BPS */}
        <div className="bg-sky-900 px-6 py-8 text-white text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-sky-700/40 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-sky-800/40 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex justify-center mb-3">
            <img
              src="/login_page_logo.svg"
              alt="Badan Pusat Statistik"
              className="h-20 sm:h-24 w-auto object-contain drop-shadow-md"
            />
          </div>

          <div className="relative z-10">
            <h1 className="text-sm font-semibold tracking-wider text-sky-100 uppercase">
              HaloPay &bull; BPS Provinsi Jawa Timur
            </h1>
            <p className="text-xs text-sky-200 mt-1 font-normal">
              Sistem Pemantauan Pendapatan &amp; Tunjangan Kinerja Pegawai
            </p>
          </div>
        </div>

        {/* Isi Formulir / Konten SSO */}
        <div className="p-6 sm:p-8">
          {/* Pesan Error Jika Ada */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold block mb-0.5">Gagal Masuk</span>
                {errorMessage}
              </div>
            </div>
          )}

          {/* Kartu Informasi SSO Majapahit */}
          <div className="p-4 bg-sky-50/70 border border-sky-100 rounded-xl mb-6">
            <div className="flex items-center gap-2.5 text-sky-900 font-semibold text-xs mb-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-700" />
              <span>Autentikasi Terpadu Majapahit (Keycloak SSO)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Masuk menggunakan akun resmi Badan Pusat Statistik. Kredensial Anda diverifikasi langsung melalui portal terpusat tanpa perlu kata sandi baru.
            </p>
          </div>

          {/* Tombol Utama SSO */}
          <button
            type="button"
            onClick={handleKeycloakLogin}
            disabled={redirecting}
            className="w-full py-3.5 px-5 bg-sky-900 hover:bg-sky-800 active:bg-sky-950 text-white font-medium text-sm rounded-xl transition duration-150 flex items-center justify-between shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              {redirecting ? (
                <Loader2 className="w-5 h-5 animate-spin text-sky-200" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-sky-800 flex items-center justify-center text-sky-200 group-hover:scale-105 transition">
                  <Lock className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="text-left">
                <div className="font-semibold text-sm">
                  {redirecting ? 'Menghubungkan ke Portal BPS...' : 'Masuk dengan Akun BPS Jatim'}
                </div>
                <div className="text-[11px] text-sky-200 font-normal">
                  Single Sign-On (auth.majapah.it)
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-sky-200 group-hover:translate-x-1 transition" />
          </button>

          {/* Catatan Kepatuhan & Keamanan */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-500">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Koneksi terenkripsi standar OIDC dengan perlindungan PKCE S256. Kata sandi Anda dikelola terpusat oleh server resmi BPS dan tidak pernah disimpan pada database HaloPay.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-sky-900" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
