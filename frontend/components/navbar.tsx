'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UploadCloud, Database, FileText, LogOut, Menu, X, User } from 'lucide-react';
import { useState } from 'react';
import ProfileModal from './profile-modal';

interface NavbarProps {
  user: {
    nama_lengkap: string;
    nip: string;
    role: 'admin' | 'karyawan';
  };
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      const data = await res.json();
      if (data?.keycloakLogoutUrl) {
        window.location.href = data.keycloakLogoutUrl;
        return;
      }
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error(err);
      router.push('/login');
    }
  };

  const isAdmin = user.role === 'admin';

  return (
    <>
      <header className="bg-sky-950 text-white shadow-md border-b border-sky-900 sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo Resmi BPS (Hanya Logo tanpa Teks Redundan) */}
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="flex items-center group">
                <img
                  src="/sidebar_logo.svg"
                  alt="Badan Pusat Statistik"
                  className="h-8 sm:h-9 w-auto object-contain transition group-hover:opacity-90"
                />
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {isAdmin && (
                <>
                  <Link
                    href="/dashboard"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      pathname === '/dashboard'
                        ? 'bg-sky-800 text-white shadow-inner'
                        : 'text-sky-200 hover:text-white hover:bg-sky-900'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Rincian</span>
                  </Link>
                  <Link
                    href="/admin/upload"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      pathname === '/admin/upload'
                        ? 'bg-sky-800 text-white shadow-inner'
                        : 'text-sky-200 hover:text-white hover:bg-sky-900'
                    }`}
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Excel</span>
                  </Link>
                  <Link
                    href="/admin/data"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      pathname === '/admin/data'
                        ? 'bg-sky-800 text-white shadow-inner'
                        : 'text-sky-200 hover:text-white hover:bg-sky-900'
                    }`}
                  >
                    <Database className="w-4 h-4" />
                    <span>Kendali Data CRUD</span>
                  </Link>
                </>
              )}
            </nav>

            {/* User Profile Trigger & Logout (Desktop) */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setProfileModalOpen(true)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-sky-900/70 border border-transparent hover:border-sky-800 transition text-left cursor-pointer group"
                title="Klik untuk melihat profil akun"
              >
                <div className="text-right">
                  <div className="text-xs font-semibold text-white truncate max-w-[170px] group-hover:text-sky-100">
                    {user.nama_lengkap}
                  </div>
                  <div className="text-[10px] text-sky-300 flex items-center justify-end gap-1.5">
                    <span>NIP: {user.nip}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider ${
                        isAdmin ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-sky-900 flex items-center justify-center text-sky-300 group-hover:text-white group-hover:bg-sky-800 border border-sky-700/50 transition">
                  <User className="w-3.5 h-3.5" />
                </div>
              </button>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                title="Keluar dari akun"
                className="p-2 rounded-lg text-sky-300 hover:text-white hover:bg-rose-900/40 border border-transparent hover:border-rose-700/50 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-sky-200 hover:text-white hover:bg-sky-900 focus:outline-none"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-sky-900 px-4 pt-3 pb-4 space-y-2 bg-sky-950">
            <div className="pb-2 border-b border-sky-900 flex items-center justify-between">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setProfileModalOpen(true);
                }}
                className="text-left flex-1 cursor-pointer group"
              >
                <div className="text-xs font-semibold text-white flex items-center gap-1.5 group-hover:text-sky-200">
                  <span>{user.nama_lengkap}</span>
                  <User className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-[10px] text-sky-300 mt-0.5">
                  NIP: {user.nip} ({user.role}) • <span className="underline font-medium">Profil Akun</span>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="text-xs text-rose-300 flex items-center gap-1 px-2.5 py-1 bg-rose-950/60 rounded border border-rose-900 ml-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

            {isAdmin && (
              <>
                <Link
                  href="/admin/upload"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sky-200 hover:bg-sky-900"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload Excel</span>
                </Link>
                <Link
                  href="/admin/data"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sky-200 hover:bg-sky-900"
                >
                  <Database className="w-4 h-4" />
                  <span>Kendali Data (CRUD)</span>
                </Link>
              </>
            )}

            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sky-200 hover:bg-sky-900"
            >
              <FileText className="w-4 h-4" />
              <span>Nota Slip & Analitik</span>
            </Link>
          </div>
        )}
      </header>

      {/* Modal Profil & Ubah Kata Sandi */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
      />
    </>
  );
}
