'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/navbar';
import PaySlipCard from '@/components/pay-slip-card';
import DeductionsBreakdown from '@/components/deductions-breakdown';
import HistoryCharts, { HistoryDataPoint } from '@/components/history-charts';
import { formatRupiah, formatPeriodeLabel } from '@/utils/etl';
import {
  Calendar,
  Wallet,
  TrendingDown,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Ref untuk user dan status inisialisasi agar tidak memicu infinite re-render loop
  const userRef = useRef<any>(null);
  const initializedRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, any>>(new Map());

  // Data Payroll Terpilih
  const [karyawan, setKaryawan] = useState<any>(null);
  const [currentGaji, setCurrentGaji] = useState<any>(null);
  const [currentTK, setCurrentTK] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [selectedPeriode, setSelectedPeriode] = useState<string>('');
  const [historyChartData, setHistoryChartData] = useState<HistoryDataPoint[]>([]);

  // State Pengelolaan Pegawai Khusus Role Admin
  const [allEmployees, setAllEmployees] = useState<Array<{ nip: string; nama: string; no_rekening: string; role?: string }>>([]);
  const [selectedNip, setSelectedNip] = useState<string>('');
  const [switchingEmployee, setSwitchingEmployee] = useState(false);

  // Helper untuk menerapkan data dashboard bundle secara atomik
  const applyDashboardData = (data: any) => {
    setKaryawan(data.karyawan);
    setCurrentGaji(data.gaji);
    setCurrentTK(data.tk);
    setSummary(data.summary);
    setAvailablePeriods(data.available_periods || []);
    setSelectedPeriode(data.periode);

    const mappedHistory: HistoryDataPoint[] = (data.history || []).map((d: any) => ({
      periode: d.periode,
      gajiBruto: d.gaji_bruto ?? d.gajiBruto ?? 0,
      tkBruto: d.tunjangan_kinerja ?? d.tkBruto ?? 0,
      totalBruto: d.total_bruto ?? d.totalBruto ?? 0,
      totalPotongan: d.total_potongan ?? d.totalPotongan ?? 0,
      thp: d.total_thp ?? d.thp ?? 0,
    }));
    setHistoryChartData(mappedHistory);
  };

  // Memuat data slip dan riwayat via Single Round-trip FastAPI Bundle Endpoint
  const fetchPayroll = async (targetNip: string, targetPeriod?: string, activeUser?: any) => {
    const usr = activeUser || userRef.current;
    if (!usr) return;

    // Batalkan request sebelumnya yang masih in-flight untuk mencegah socket exhaustion
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Cek in-memory cache client (0ms latensi)
    const cacheKey = `${targetNip}_${targetPeriod || 'latest'}`;
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      applyDashboardData(cached);
      return;
    }

    setSwitchingEmployee(true);
    try {
      const isAdmin = usr.role === 'admin';
      const isSelf = targetNip === usr.nip;

      // Endpoint terpadu: hanya 1 koneksi HTTP untuk slip transaksi + deret riwayat
      const endpoint =
        isAdmin && !isSelf
          ? `/api/v1/admin/employee-dashboard/${targetNip}${targetPeriod ? `?periode=${encodeURIComponent(targetPeriod)}` : ''}`
          : `/api/v1/payroll/dashboard-bundle${targetPeriod ? `?periode=${encodeURIComponent(targetPeriod)}` : ''}`;

      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      if (res.ok) {
        const bundleData = await res.json();
        cacheRef.current.set(cacheKey, bundleData);
        applyDashboardData(bundleData);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Request dibatalkan secara sengaja oleh pergantian pilihan pengguna, bukan error
        return;
      }
      console.error('Error fetching payroll data from FastAPI:', err);
    } finally {
      setSwitchingEmployee(false);
    }
  };

  // Inisialisasi data pengguna dan slip (HANYA BERJALAN TEPAT SEKALI SAAT MOUNT)
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

        const sessionData = await res.json();
        userRef.current = sessionData.user;
        setUser(sessionData.user);
        const nip = sessionData.user.nip;
        setSelectedNip(nip);

        // Jika Admin: Ambil daftar seluruh karyawan untuk dropdown supervisi
        if (sessionData.user.role === 'admin') {
          try {
            const resEmps = await fetch('/api/v1/admin/employees');
            if (resEmps.ok) {
              const empList = await resEmps.json();
              setAllEmployees(empList);
            }
          } catch (e) {
            console.error('Gagal mengambil daftar pegawai admin:', e);
          }
        }

        // Muat bundle perdana pegawai
        await fetchPayroll(nip, undefined, sessionData.user);
      } catch (err) {
        console.error('Error in initial load:', err);
      } finally {
        setLoading(false);
      }
    }

    init();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []); // Array kosong -> Dijamin 100% tidak akan looping

  // Handler pergantian pegawai (khusus admin)
  const handleSelectEmployee = (targetNip: string) => {
    setSelectedNip(targetNip);
    fetchPayroll(targetNip, selectedPeriode);
  };

  // Handler pergantian periode transaksi
  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriode(newPeriod);
    fetchPayroll(selectedNip, newPeriod);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-sky-700 animate-spin" />
      </div>
    );
  }

  // Hitung Nilai Finansial Periode Terpilih
  const gajiBruto = currentGaji?.gaji_bruto || 0;
  const tkBruto = currentTK?.tunjangan_kinerja || 0;
  const totalBruto = summary?.total_bruto ?? gajiBruto + tkBruto;

  const potGaji =
    summary?.total_potongan_gaji ??
    ((currentGaji?.simpanan_pokok || 0) +
      (currentGaji?.simpanan_sukarela || 0) +
      (currentGaji?.simpanan_wajib || 0) +
      (currentGaji?.iuran_dwp || 0) +
      (currentGaji?.iuran_korpri || 0) +
      (currentGaji?.potongan_pinjaman_koperasi || 0));

  const potTK =
    summary?.total_potongan_tk ??
    ((currentTK?.simpanan_sukarela || 0) +
      (currentTK?.potongan_toko || 0) +
      (currentTK?.potongan_barang_koperasi || 0) +
      (currentTK?.potongan_pinjaman_koperasi || 0) +
      (currentTK?.potongan_pinjaman_dwp || 0) +
      (currentTK?.potongan_untalan || 0) +
      (currentTK?.potongan_arisan_dwp || 0));

  const totalPotongan = summary?.total_potongan ?? potGaji + potTK;
  const totalTHP = summary?.total_thp ?? (currentGaji?.jumlah_diterima || 0) + (currentTK?.jumlah_diterima || 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header & Pemilih Periode */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <FileSpreadsheet className="w-7 h-7 text-sky-800" />
              <span>Rincian Pendapatan & Tunjangan Kinerja</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Nota rincian resmi penerimaan Gaji Pokok dan Tunjangan Kinerja Badan Pusat Statistik
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Dropdown Pegawai Khusus Admin di Header */}
            {user.role === 'admin' && allEmployees.length > 0 && (
              <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-sky-500">
                <Users className="w-4 h-4 text-sky-800" />
                <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">Pegawai:</label>
                {switchingEmployee ? (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 px-1 py-0.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-800" />
                    <span>Memuat...</span>
                  </div>
                ) : (
                  <select
                    value={selectedNip}
                    onChange={(e) => handleSelectEmployee(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer max-w-[190px] sm:max-w-[240px] truncate"
                    title="Pilih pegawai untuk melihat nota rincian gaji & TK"
                  >
                    {allEmployees.map((emp) => (
                      <option key={emp.nip} value={emp.nip}>
                        {emp.nama} ({emp.nip}) {emp.role === 'admin' ? '[Admin]' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Period Selector Dropdown */}
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm">
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

        {/* Banner Khusus Admin Saat Meninjau Pegawai Lain */}
        {user.role === 'admin' && selectedNip !== user.nip && karyawan && (
          <div className="no-print p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between text-xs text-sky-900 shadow-xs">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-700 shrink-0" />
              <span>
                Pratinjau Admin: Memeriksa rincian nota <strong>{karyawan.nama}</strong> (NIP: <span className="font-mono font-semibold">{karyawan.nip}</span>).
              </span>
            </div>
            <button
              onClick={() => handleSelectEmployee(user.nip)}
              className="text-[11px] font-semibold text-sky-800 underline hover:text-sky-950 cursor-pointer whitespace-nowrap ml-3"
            >
              Kembali ke Nota Saya
            </button>
          </div>
        )}

        {/* Ringkasan Finansial Metrik Utama (Cards) */}
        <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total Kotor */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Total Pendapatan (Bruto)</span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-800">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{formatRupiah(totalBruto)}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Gaji ({formatRupiah(gajiBruto)}) + TK ({formatRupiah(tkBruto)})
            </div>
          </div>

          {/* Card 2: Potongan */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold">Total Potongan</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-2">- {formatRupiah(totalPotongan)}</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Pot. Gaji ({formatRupiah(potGaji)}) + Pot. TK ({formatRupiah(potTK)})
            </div>
          </div>

          {/* Card 3: Jumlah Diterima */}
          <div className="bg-emerald-50/80 p-5 rounded-2xl border-2 border-emerald-500/40 shadow-sm">
            <div className="flex items-center justify-between text-emerald-800">
              <span className="text-xs font-bold uppercase tracking-wider">Jumlah Diterima</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
              {formatRupiah(totalTHP)}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1 font-medium">
              Siap ditransfer ke Rekening Mandiri
            </div>
          </div>
        </div>

        {/* Info Jika Belum Ada Data Transaksi Pada Periode Ini */}
        {!currentGaji && !currentTK && (
          <div className="no-print p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-800">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold block">Data transaksi belum tersedia untuk periode {selectedPeriode}.</span>
              <span>
                Jika Anda adalah Administrator, silakan Unggah Berkas Excel transaksi melalui menu <strong>Upload Excel</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Visual Waterfall Breakdown Flow */}
        <DeductionsBreakdown
          gajiBruto={gajiBruto}
          tkBruto={tkBruto}
          potonganGaji={potGaji}
          potonganTK={potTK}
          gagalDebet={currentTK?.potongan_gagal_debet || 0}
          thpTotal={totalTHP}
        />

        {/* Nota Rincian Slip Gaji & TK (A4 Printable Component) */}
        <PaySlipCard
          karyawan={karyawan}
          gaji={currentGaji}
          tk={currentTK}
          periode={selectedPeriode}
        />

        {/* Recharts Historical Trend */}
        <HistoryCharts data={historyChartData} />
      </main>
    </div>
  );
}
