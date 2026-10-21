'use client';

import { X, ShieldCheck, User, ExternalLink, Lock } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    nama_lengkap: string;
    nip: string;
    role: 'admin' | 'karyawan';
    email?: string;
    jabatan?: string;
    satker?: string;
  };
}

export default function ProfileModal({ isOpen, onClose, user }: ProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="bg-sky-950 px-6 py-4 text-white flex items-center justify-between border-b border-sky-900">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-semibold tracking-wide">Profil Akun BPS</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sky-300 hover:text-white hover:bg-sky-900 transition cursor-pointer"
            title="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Ringkasan Identitas Pegawai */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-900 font-bold text-sm shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {user.nama_lengkap}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  NIP: {user.nip}
                </div>
              </div>
              <div>
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                    user.role === 'admin'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {user.role === 'admin' ? 'Administrator' : 'Pegawai'}
                </span>
              </div>
            </div>

            {/* Metadata Tambahan Jika Ada */}
            {(user.jabatan || user.email || user.satker) && (
              <div className="pt-2 border-t border-slate-200/70 text-[11px] space-y-1 text-slate-600">
                {user.jabatan && (
                  <div>
                    <span className="text-slate-400">Jabatan:</span> {user.jabatan}
                  </div>
                )}
                {user.email && (
                  <div>
                    <span className="text-slate-400">Email:</span> {user.email}
                  </div>
                )}
                {user.satker && (
                  <div>
                    <span className="text-slate-400">Satker:</span> {user.satker}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Kartu Status Keamanan Terpusat (Keycloak SSO) */}
          <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sky-900 font-semibold text-xs">
              <Lock className="w-4 h-4 text-sky-700" />
              <span>Autentikasi Terpadu (Keycloak SSO)</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Akun Anda terhubung dengan Single Sign-On (SSO) Majapahit BPS Jawa Timur. Kata sandi dikelola terpusat dan aman di server BPS RI, sehingga Anda tidak perlu mengubah kata sandi di aplikasi HaloPay.
            </p>
          </div>

          {/* Tindakan */}
          <div className="pt-2 flex items-center justify-between gap-2.5">
            <a
              href="https://auth.majapah.it/realms/majapahit/account"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-sky-900 bg-sky-100/70 hover:bg-sky-200/70 rounded-xl transition"
            >
              <span>Portal Akun Majapahit</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-white bg-sky-900 hover:bg-sky-800 rounded-xl transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
