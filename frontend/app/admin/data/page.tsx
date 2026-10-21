'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/navbar';
import { formatRupiah, formatPeriodeLabel } from '@/utils/etl';
import {
  Database,
  Search,
  Calendar,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  X,
  Check,
  Radio,
  Users,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  UserCog,
  CheckCircle2,
} from 'lucide-react';

interface CombinedRow {
  nip: string;
  nama: string;
  no_rekening: string;
  periode: string;
  gaji_bruto: number;
  simpanan_pokok: number;
  simpanan_sukarela_gaji: number;
  simpanan_wajib: number;
  iuran_dwp: number;
  iuran_korpri: number;
  potongan_pinjaman_koperasi_gaji: number;
  thp_gaji: number;
  tunjangan_kinerja: number;
  simpanan_sukarela_tk: number;
  potongan_toko: number;
  potongan_barang_koperasi: number;
  potongan_pinjaman_koperasi_tk: number;
  potongan_pinjaman_dwp: number;
  potongan_untalan: number;
  potongan_arisan_dwp: number;
  potongan_gagal_debet: number;
  thp_tk: number;
  total_bruto: number;
  total_potongan: number;
  total_thp: number;
}

interface UserRBACRow {
  nip: string;
  nama: string;
  no_rekening: string;
  has_account: boolean;
  user_id: string | null;
  username?: string | null;
  username_slug?: string | null;
  role: 'admin' | 'karyawan';
}

export default function AdminDataGridPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<'transactions' | 'rbac'>('transactions');

  // Transactions State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriode, setSelectedPeriode] = useState('2026-08');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [rows, setRows] = useState<CombinedRow[]>([]);

  // RBAC Users State
  const [rbacUsers, setRbacUsers] = useState<UserRBACRow[]>([]);
  const [rbacLoading, setRbacLoading] = useState(false);
  const [rbacSearch, setRbacSearch] = useState('');
  const [updatingNip, setUpdatingNip] = useState<string | null>(null);
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');

  // Modal Edit State
  const [editingRow, setEditingRow] = useState<CombinedRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal Delete State
  const [deletingNIP, setDeletingNIP] = useState<string | null>(null);
  const [deletingProgress, setDeletingProgress] = useState(false);

  // 1. Fetch Transaksi Payroll via FastAPI
  const fetchTransactionData = useCallback(async (targetPeriod?: string) => {
    const period = targetPeriod || selectedPeriode;
    setLoading(true);
    try {
      const [resGrid, resPeriods] = await Promise.all([
        fetch(`/api/v1/admin/payroll-grid?periode=${encodeURIComponent(period)}`),
        fetch('/api/v1/payroll/periods'),
      ]);

      if (resPeriods.ok) {
        const periodList = await resPeriods.json();
        const periodSet = new Set<string>(periodList || []);
        if (period) periodSet.add(period);
        setAvailablePeriods(Array.from(periodSet).sort().reverse());
      }

      if (resGrid.ok) {
        const gridData = await resGrid.json();
        setRows(gridData.rows || []);
      }
    } catch (err) {
      console.error('Error fetching payroll grid from FastAPI:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriode]);

  // 2. Fetch Data RBAC Pengguna via FastAPI
  const fetchRBACUsers = useCallback(async () => {
    setRbacLoading(true);
    try {
      const res = await fetch('/api/v1/admin/employees');
      if (res.ok) {
        const empList = await res.json();
        setRbacUsers(
          (empList || []).map((k: any) => ({
            nip: k.nip,
            nama: k.nama,
            no_rekening: k.no_rekening,
            has_account: k.has_account,
            user_id: k.nip,
            username: k.username,
            username_slug: k.username,
            role: k.role || 'karyawan',
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching RBAC users:', err);
    } finally {
      setRbacLoading(false);
    }
  }, []);

  // Handler Pergantian Periode
  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriode(newPeriod);
    fetchTransactionData(newPeriod);
  };

  // Inisialisasi (Hanya Berjalan Sekali Saat Mount)
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function init() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }

        const data = await res.json();
        if (data.user.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        setUser(data.user);

        let initialPeriod = '2026-08';
        try {
          const resPeriods = await fetch('/api/v1/payroll/periods');
          if (resPeriods.ok) {
            const pList: string[] = await resPeriods.json();
            if (pList && pList.length > 0) {
              initialPeriod = pList[0];
              setAvailablePeriods(pList);
              setSelectedPeriode(initialPeriod);
            }
          }
        } catch (e) {
          console.error('Error fetching initial periods:', e);
        }

        await Promise.all([
          fetchTransactionData(initialPeriod),
          fetchRBACUsers(),
        ]);
      } catch (err) {
        console.error('Error init admin page:', err);
      }
    }

    init();
  }, []); // Strictly mount once

  // Ubah Role Akses Pengguna via FastAPI
  const handleRoleChange = async (nip: string, newRole: 'admin' | 'karyawan') => {
    setActionErrorMsg('');
    setActionSuccessMsg('');
    setUpdatingNip(nip);

    try {
      const res = await fetch('/api/v1/admin/users/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nip, role: newRole }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || resData.message || 'Gagal memperbarui role.');
      }

      setActionSuccessMsg(resData.message || `Role berhasil diubah menjadi ${newRole}.`);
      setRbacUsers((prev) =>
        prev.map((u) => (u.nip === nip ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Terjadi kesalahan saat mengubah role.');
    } finally {
      setUpdatingNip(null);
    }
  };

  // Sinkronkan Semua Akun Pengguna (Backfill Masal)
  const handleSyncAllUsers = async () => {
    setActionErrorMsg('');
    setActionSuccessMsg('');
    setSyncingUsers(true);

    try {
      const res = await fetch('/api/v1/admin/employees');
      if (!res.ok) {
        throw new Error('Gagal menyinkronkan data pengguna.');
      }
      setActionSuccessMsg('Sinkronisasi akun selesai!');
      await fetchRBACUsers();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Gagal menjalankan sinkronisasi.');
    } finally {
      setSyncingUsers(false);
    }
  };

  // Simpan Perubahan Modal Edit via FastAPI
  const handleSaveEdit = async () => {
    if (!editingRow) return;
    setSavingEdit(true);

    try {
      const res = await fetch('/api/v1/admin/payroll-entry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nip: editingRow.nip,
          periode: selectedPeriode,
          gaji_bruto: editingRow.gaji_bruto,
          simpanan_pokok: editingRow.simpanan_pokok,
          simpanan_sukarela_gaji: editingRow.simpanan_sukarela_gaji,
          simpanan_wajib: editingRow.simpanan_wajib,
          iuran_dwp: editingRow.iuran_dwp,
          iuran_korpri: editingRow.iuran_korpri,
          potongan_pinjaman_koperasi_gaji: editingRow.potongan_pinjaman_koperasi_gaji,
          tunjangan_kinerja: editingRow.tunjangan_kinerja,
          simpanan_sukarela_tk: editingRow.simpanan_sukarela_tk,
          potongan_toko: editingRow.potongan_toko,
          potongan_barang_koperasi: editingRow.potongan_barang_koperasi,
          potongan_pinjaman_koperasi_tk: editingRow.potongan_pinjaman_koperasi_tk,
          potongan_pinjaman_dwp: editingRow.potongan_pinjaman_dwp,
          potongan_untalan: editingRow.potongan_untalan,
          potongan_arisan_dwp: editingRow.potongan_arisan_dwp,
          potongan_gagal_debet: editingRow.potongan_gagal_debet,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Gagal menyimpan perubahan transaksi.');
      }

      setActionSuccessMsg(`Transaksi NIP ${editingRow.nip} periode ${selectedPeriode} berhasil diperbarui.`);
      setEditingRow(null);
      await fetchTransactionData();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan data.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Hapus Record Transaksi via FastAPI
  const handleDeleteRow = async () => {
    if (!deletingNIP) return;
    setDeletingProgress(true);

    try {
      const res = await fetch('/api/v1/admin/payroll-entry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nip: deletingNIP, periode: selectedPeriode }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Gagal menghapus transaksi.');
      }

      setActionSuccessMsg(`Transaksi NIP ${deletingNIP} periode ${selectedPeriode} berhasil dihapus.`);
      setDeletingNIP(null);
      await fetchTransactionData();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Terjadi kesalahan saat menghapus data.');
    } finally {
      setDeletingProgress(false);
    }
  };

  // Filter Baris Transaksi
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(
      (r) => r.nip.toLowerCase().includes(q) || r.nama.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  // Filter Baris RBAC Users
  const filteredRBACUsers = useMemo(() => {
    if (!rbacSearch.trim()) return rbacUsers;
    const q = rbacSearch.toLowerCase().trim();
    return rbacUsers.filter(
      (u) => u.nip.toLowerCase().includes(q) || u.nama.toLowerCase().includes(q)
    );
  }, [rbacUsers, rbacSearch]);

  const totalAdmins = useMemo(() => rbacUsers.filter((u) => u.role === 'admin').length, [rbacUsers]);
  const totalKaryawan = useMemo(() => rbacUsers.filter((u) => u.role === 'karyawan').length, [rbacUsers]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-sky-700 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Title & Status Realtime */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Database className="w-7 h-7 text-sky-800" />
              <span>Pusat Kendali Data & Akses Pengguna</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Kelola data transaksi payroll, ubah nominal finansial, dan atur Role-Based Access Control (RBAC) pegawai.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Database Refresh</span>
            </div>

            <button
              onClick={() => {
                fetchTransactionData();
                fetchRBACUsers();
              }}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifikasi Feedback */}
        {actionSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionErrorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionErrorMsg}</span>
            </div>
            <button onClick={() => setActionErrorMsg('')} className="text-rose-700 hover:text-rose-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigasi Utama: Transaksi vs RBAC */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveMainTab('transactions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeMainTab === 'transactions'
                ? 'bg-sky-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Data Transaksi Payroll ({rows.length})</span>
          </button>

          <button
            onClick={() => setActiveMainTab('rbac')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeMainTab === 'rbac'
                ? 'bg-sky-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <UserCog className="w-4 h-4" />
            <span>Hak Akses Pegawai ({rbacUsers.length})</span>
          </button>
        </div>

        {/* TAB 1: TRANSAKSI PAYROLL */}
        {activeMainTab === 'transactions' && (
          <div className="space-y-4">
            {/* Filter Toolbar: Search & Periode */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari transaksi berdasarkan NIP atau Nama Pegawai..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 border border-slate-300 rounded-xl">
                  <Calendar className="w-4 h-4 text-sky-800" />
                  <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Periode:</label>
                  <select
                    value={selectedPeriode}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                  >
                    {Array.from(new Set([selectedPeriode, ...availablePeriods].filter(Boolean)))
                      .sort()
                      .reverse()
                      .map((p) => (
                        <option key={p} value={p}>
                          {formatPeriodeLabel(p)}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Data Grid Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-3 px-4">Pegawai</th>
                      <th className="py-3 px-3">No. Rekening</th>
                      <th className="py-3 px-3 text-right">Gaji Bruto</th>
                      <th className="py-3 px-3 text-right">TK Bruto</th>
                      <th className="py-3 px-3 text-right">Total Potongan</th>
                      <th className="py-3 px-3 text-right">Jumlah Diterima</th>
                      <th className="py-3 px-4 text-center">Aksi Kendali</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          Tidak ada transaksi ditemukan untuk periode {selectedPeriode}.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r) => (
                        <tr key={r.nip} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{r.nama}</div>
                            <div className="font-mono text-[11px] text-slate-500">{r.nip}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">{r.no_rekening}</td>
                          <td className="py-3 px-3 text-right font-medium text-slate-900">
                            {formatRupiah(r.gaji_bruto)}
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-slate-900">
                            {formatRupiah(r.tunjangan_kinerja)}
                          </td>
                          <td className="py-3 px-3 text-right text-rose-600 font-medium">
                            - {formatRupiah(r.total_potongan)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-700">
                            {formatRupiah(r.total_thp)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setEditingRow({ ...r })}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-sky-700 hover:bg-sky-50 transition cursor-pointer"
                                title="Edit Angka Nominal"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingNIP(r.nip)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="Hapus Transaksi Periode Ini"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MANAJEMEN RBAC HAK AKSES */}
        {activeMainTab === 'rbac' && (
          <div className="space-y-4">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center text-sky-800 shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Total Master Pegawai</span>
                  <span className="text-xl font-bold text-slate-900">{rbacUsers.length} Orang</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Total Role Administrator</span>
                  <span className="text-xl font-bold text-amber-800">{totalAdmins} Akun</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Total Role Karyawan</span>
                  <span className="text-xl font-bold text-emerald-800">{totalKaryawan} Akun</span>
                </div>
              </div>
            </div>

            {/* Filter & Action Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={rbacSearch}
                  onChange={(e) => setRbacSearch(e.target.value)}
                  placeholder="Cari pegawai berdasarkan NIP atau Nama..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition"
                />
              </div>

              <button
                onClick={handleSyncAllUsers}
                disabled={syncingUsers}
                className="px-4 py-2 bg-sky-900 hover:bg-sky-800 active:bg-sky-950 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {syncingUsers ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                <span>Sinkronkan & Buat Akun Otomatis</span>
              </button>
            </div>

            {/* RBAC Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <th className="py-3 px-4">Pegawai</th>
                      <th className="py-3 px-3">Username SSO</th>
                      <th className="py-3 px-3">No. Rekening</th>
                      <th className="py-3 px-3">Status Akun Login</th>
                      <th className="py-3 px-4">Peran Hak Akses (Role)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rbacLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-800" />
                          Memuat data pengguna...
                        </td>
                      </tr>
                    ) : filteredRBACUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          Tidak ada data pegawai ditemukan.
                        </td>
                      </tr>
                    ) : (
                      filteredRBACUsers.map((u) => {
                        const isSelf = user.nip === u.nip;
                        return (
                          <tr key={u.nip} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900 flex items-center gap-2">
                                <span>{u.nama}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-sky-100 text-sky-800 font-medium px-1.5 py-0.2 rounded">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[11px] text-slate-500">{u.nip}</div>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-700">
                              {u.username || u.username_slug || '-'}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">{u.no_rekening}</td>
                            <td className="py-3 px-3">
                              {u.has_account ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3" />
                                  <span>Aktif (SSO)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  <span>Belum Terdaftar</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <select
                                  value={u.role}
                                  disabled={isSelf || updatingNip === u.nip}
                                  onChange={(e) =>
                                    handleRoleChange(u.nip, e.target.value as 'admin' | 'karyawan')
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer focus:outline-none ${
                                    u.role === 'admin'
                                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                                      : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                                >
                                  <option value="karyawan">Role: Karyawan (Default)</option>
                                  <option value="admin">Role: Administrator</option>
                                </select>
                                {updatingNip === u.nip && (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-800" />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Edit Nominal Transaksi */}
        {editingRow && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Ubah Nominal Transaksi</h3>
                  <p className="text-xs text-slate-500">
                    {editingRow.nama} (NIP: {editingRow.nip}) - Periode {selectedPeriode}
                  </p>
                </div>
                <button
                  onClick={() => setEditingRow(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-sky-900 uppercase">Komponen Gaji</h4>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Gaji Bruto</label>
                    <input
                      type="number"
                      value={editingRow.gaji_bruto}
                      onChange={(e) => setEditingRow({ ...editingRow, gaji_bruto: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Simpanan Pokok</label>
                    <input
                      type="number"
                      value={editingRow.simpanan_pokok}
                      onChange={(e) => setEditingRow({ ...editingRow, simpanan_pokok: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Simpanan Sukarela</label>
                    <input
                      type="number"
                      value={editingRow.simpanan_sukarela_gaji}
                      onChange={(e) => setEditingRow({ ...editingRow, simpanan_sukarela_gaji: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Pinjaman Koperasi</label>
                    <input
                      type="number"
                      value={editingRow.potongan_pinjaman_koperasi_gaji}
                      onChange={(e) => setEditingRow({ ...editingRow, potongan_pinjaman_koperasi_gaji: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-sky-900 uppercase">Komponen TK</h4>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">TK Bruto</label>
                    <input
                      type="number"
                      value={editingRow.tunjangan_kinerja}
                      onChange={(e) => setEditingRow({ ...editingRow, tunjangan_kinerja: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Potongan Toko</label>
                    <input
                      type="number"
                      value={editingRow.potongan_toko}
                      onChange={(e) => setEditingRow({ ...editingRow, potongan_toko: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Barang Koperasi</label>
                    <input
                      type="number"
                      value={editingRow.potongan_barang_koperasi}
                      onChange={(e) => setEditingRow({ ...editingRow, potongan_barang_koperasi: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Gagal Debet (Non-Deducting)
                    </label>
                    <input
                      type="number"
                      value={editingRow.potongan_gagal_debet}
                      onChange={(e) => setEditingRow({ ...editingRow, potongan_gagal_debet: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-900 hover:bg-sky-800 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEdit ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Hapus */}
        {deletingNIP && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Transaksi Periode?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Transaksi gaji dan TK untuk NIP <strong>{deletingNIP}</strong> pada periode{' '}
                  <strong>{selectedPeriode}</strong> akan dihapus permanen dari database.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setDeletingNIP(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteRow}
                  disabled={deletingProgress}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  {deletingProgress ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Ya, Hapus</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
