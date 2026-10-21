'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/navbar';
import {
  processPayrollExcel,
  ParsedETLResult,
  formatRupiah,
} from '@/utils/etl';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Users,
  Wallet,
  TrendingDown,
  Calendar,
  Layers,
  Loader2,
  ArrowRight,
  Database,
} from 'lucide-react';

export default function AdminUploadPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState('09');
  const [customYearMode, setCustomYearMode] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedETLResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'karyawan' | 'gaji' | 'tk'>('summary');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedPeriode = `${selectedYear}-${selectedMonth}`;

  // Daftar tahun fleksibel dari 2035 turun ke 2010 (mencakup 26 tahun arsip migrasi)
  const availableYears = Array.from({ length: 26 }, (_, i) => String(2035 - i));

  useEffect(() => {
    async function loadUser() {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        router.push('/login');
      }
    }
    loadUser();
  }, []);

  // Sinkronisasi otomatis target periode ke parsedData jika file sudah dimuat di memori
  useEffect(() => {
    if (parsedData) {
      setParsedData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          gajiList: prev.gajiList.map((g) => ({ ...g, periode: selectedPeriode })),
          tkList: prev.tkList.map((t) => ({ ...t, periode: selectedPeriode })),
        };
      });
    }
  }, [selectedPeriode]);

  const handleFileChange = async (file: File) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErrorMsg('Harap unggah file spreadsheet berekstensi .xlsx atau .xls');
      return;
    }

    setFileName(file.name);
    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await processPayrollExcel(buffer, selectedPeriode);

      if (result.karyawanList.length === 0 && result.gajiList.length === 0 && result.tkList.length === 0) {
        setErrorMsg('Tidak dapat menemukan lembar GAJI (Gaji/gaji/15) atau TK (tk/Tk/16) yang valid pada berkas Excel. Pastikan nama sheet atau format kolom sesuai.');
        setParsedData(null);
      } else {
        setParsedData(result);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal membaca berkas Excel: ' + (err.message || 'Format tidak didukung'));
      setParsedData(null);
    } finally {
      setParsing(false);
    }
  };

  const handleSyncToDatabase = async () => {
    if (!parsedData) return;

    setUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Sanitasi payload: buang field 'nama' dari gaji dan TK sebelum dikirim ke backend
      const cleanGajiList = parsedData.gajiList.map(({ nama, ...rest }) => ({
        ...rest,
        periode: selectedPeriode,
      }));
      const cleanTKList = parsedData.tkList.map(({ nama, ...rest }) => ({
        ...rest,
        periode: selectedPeriode,
      }));

      const res = await fetch('/api/v1/admin/payroll-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          karyawanList: parsedData.karyawanList,
          gajiList: cleanGajiList,
          tkList: cleanTKList,
          periode: selectedPeriode,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.detail || resData.message || 'Gagal menyinkronkan data payroll.');
      }

      const counts = resData.counts || {
        karyawan: parsedData.karyawanList.length,
        gaji: cleanGajiList.length,
        tk: cleanTKList.length,
      };

      if (cleanGajiList.length > 0 && counts.gaji === 0) {
        throw new Error('Peringatan: Data Gaji tidak tersimpan ke database. Periksa log backend.');
      }

      setSuccessMsg(
        `Sukses! Berhasil menyinkronkan ${counts.karyawan} master pegawai, ${counts.gaji} slip gaji, dan ${counts.tk} slip TK untuk periode ${selectedPeriode} ke database.`
      );
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan data payroll.');
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-sky-700 animate-spin" />
      </div>
    );
  }

  const months = [
    { val: '01', label: 'Januari' },
    { val: '02', label: 'Februari' },
    { val: '03', label: 'Maret' },
    { val: '04', label: 'April' },
    { val: '05', label: 'Mei' },
    { val: '06', label: 'Juni' },
    { val: '07', label: 'Juli' },
    { val: '08', label: 'Agustus' },
    { val: '09', label: 'September' },
    { val: '10', label: 'Oktober' },
    { val: '11', label: 'November' },
    { val: '12', label: 'Desember' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Title */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <UploadCloud className="w-7 h-7 text-sky-800" />
              <span>Smart Spreadsheet Auto-ETL Ingestion</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Ekstraksi berkas Excel (.xlsx) tanpa cleaning manual dengan injeksi target periode.


            </p>
          </div>
        </div>

        {/* Notifikasi Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Kendala Ekstraksi</span>
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Sinkronisasi Database Berhasil</span>
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => router.push('/admin/data')}
              className="text-xs font-semibold text-emerald-900 underline hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
            >
              Lihat di Tabel Kendali <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sisi Kiri: Form Parameter Periode & Uploader */}
          <div className="lg:col-span-1 space-y-6">
            {/* Box 1: UI Period Selector */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-900 font-semibold text-sm">
                <Calendar className="w-4 h-4 text-sky-800" />
                <span>Target Periode Transaksi</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Pilih bulan dan tahun yang akan disuntikkan ke data transaksi:
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bulan</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:bg-white"
                  >
                    {months.map((m) => (
                      <option key={m.val} value={m.val}>
                        {m.label} ({m.val})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-600">Tahun</label>
                    <button
                      type="button"
                      onClick={() => setCustomYearMode(!customYearMode)}
                      className="text-[10px] text-sky-800 font-semibold underline hover:text-sky-950 cursor-pointer"
                    >
                      {customYearMode ? 'Pilih Dropdown' : 'Ketik Tahun Manual'}
                    </button>
                  </div>

                  {customYearMode ? (
                    <input
                      type="number"
                      min="1990"
                      max="2099"
                      placeholder="Contoh: 2024"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:bg-white"
                    />
                  ) : (
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 focus:bg-white cursor-pointer"
                    >
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="mt-4 p-2.5 bg-sky-50 rounded-xl border border-sky-100 flex items-center justify-between">
                <span className="text-xs text-sky-800 font-medium">Insert Periode:</span>
                <span className="text-xs font-bold font-mono text-sky-950 px-2 py-0.5 bg-white rounded-lg border border-sky-200">
                  {selectedPeriode}
                </span>
              </div>
            </div>

            {/* Box 2: Dropzone Excel */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-slate-900 font-semibold text-sm">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Unggah Berkas Excel</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Pilih atau seret berkas asli Excel (.xlsx) divisi keuangan:
              </p>

              <label
                htmlFor="excel-upload"
                className="border-2 border-dashed border-slate-300 hover:border-sky-600 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50 hover:bg-sky-50/40 group"
              >
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm border border-slate-200 group-hover:scale-105 transition mb-3">
                  <UploadCloud className="w-6 h-6 text-sky-800" />
                </div>
                <span className="text-xs font-semibold text-slate-800 group-hover:text-sky-900">
                  Klik untuk memilih file
                </span>
                <span className="text-[11px] text-slate-400 mt-1">atau tarik berkas ke kotak ini</span>
                <input
                  id="excel-upload"
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file);
                  }}
                />
              </label>

              {fileName && (
                <div className="mt-4 p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center gap-2.5 text-xs text-slate-700">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate font-medium flex-1">{fileName}</span>
                </div>
              )}

              {parsing && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-sky-800 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses berkas spreadsheet...</span>
                </div>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Pratinjau & Ringkasan Data */}
          <div className="lg:col-span-2 space-y-6">
            {!parsedData ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center min-h-[360px]">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-700">Pratinjau Data Belum Tersedia</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                  Silakan tentukan target periode dan Unggah Berkas Excel di panel sebelah kiri untuk melihat hasil parsing cerdas.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold">
                      <Users className="w-3.5 h-3.5 text-sky-700" />
                      <span>Total Pegawai</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {parsedData.summary.totalEmployees}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Master Karyawan</div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold">
                      <Wallet className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Baris Gaji</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {parsedData.summary.totalGajiRows}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Transaksi Gaji</div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold">
                      <TrendingDown className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Baris TK</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {parsedData.summary.totalTKRows}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Transaksi TK</div>
                  </div>

                  <div className="bg-emerald-50/80 p-4 rounded-xl border border-emerald-200 shadow-sm">
                    <div className="text-emerald-800 text-[11px] font-semibold">Total Bersih (THP)</div>
                    <div className="text-sm font-bold text-emerald-950 mt-1 truncate">
                      {formatRupiah(parsedData.summary.totalGajiDiterima + parsedData.summary.totalTKDiterima)}
                    </div>
                    <div className="text-[10px] text-emerald-700 mt-0.5">Akumulasi Gaji + TK</div>
                  </div>
                </div>

                {/* Detected Sheets Badges */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium text-[11px]">Sheet Teridentifikasi:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    Sheet Gaji: <strong>{parsedData.detectedSheets?.gaji || 'Tidak Ditemukan'}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 font-mono text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-sky-600"></span>
                    Sheet TK: <strong>{parsedData.detectedSheets?.tk || 'Tidak Ditemukan'}</strong>
                  </span>
                </div>

                {/* Data Preview Card with Tabs */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="border-b border-slate-200 px-6 py-3.5 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveTab('summary')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          activeTab === 'summary'
                            ? 'bg-sky-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Ringkasan
                      </button>
                      <button
                        onClick={() => setActiveTab('karyawan')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          activeTab === 'karyawan'
                            ? 'bg-sky-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Master Pegawai ({parsedData.karyawanList.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('gaji')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          activeTab === 'gaji'
                            ? 'bg-sky-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Gaji ({parsedData.gajiList.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('tk')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          activeTab === 'tk'
                            ? 'bg-sky-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Tunjangan Kinerja ({parsedData.tkList.length})
                      </button>
                    </div>

                    {/* Commit Button */}
                    <button
                      onClick={handleSyncToDatabase}
                      disabled={uploading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Menyimpan ke Database...</span>
                        </>
                      ) : (

                        <>
                          <Database className="w-3.5 h-3.5" />
                          <span>Simpan Database</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-6">
                    {activeTab === 'summary' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Gaji Box */}
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                              Lembar Gaji Pokok
                            </h4>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Total Gaji Bruto:</span>
                                <span className="font-semibold text-slate-900">
                                  {formatRupiah(parsedData.summary.totalGajiBruto)}
                                </span>
                              </div>
                              <div className="flex justify-between text-rose-600">
                                <span>Total Potongan:</span>
                                <span className="font-semibold">
                                  - {formatRupiah(parsedData.summary.totalGajiBruto - parsedData.summary.totalGajiDiterima)}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                                <span>Total Jumlah Diterima:</span>
                                <span className="text-emerald-700">
                                  {formatRupiah(parsedData.summary.totalGajiDiterima)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* TK Box */}
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                              Lembar Tunjangan Kinerja (TK)
                            </h4>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Total TK Bruto:</span>
                                <span className="font-semibold text-slate-900">
                                  {formatRupiah(parsedData.summary.totalTKBruto)}
                                </span>
                              </div>
                              <div className="flex justify-between text-rose-600">
                                <span>Total Potongan:</span>
                                <span className="font-semibold">
                                  - {formatRupiah(parsedData.summary.totalTKBruto - parsedData.summary.totalTKDiterima)}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                                <span>Total Jumlah Diterima:</span>
                                <span className="text-emerald-700">
                                  {formatRupiah(parsedData.summary.totalTKDiterima)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Catatan: Kolom <strong>Potongan Gagal Debet</strong> tercatat pada database namun <strong>tidak mengurangi</strong> THP Tunjangan Kinerja.
                          </span>
                        </div>
                      </div>
                    )}

                    {activeTab === 'karyawan' && (
                      <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                              <th className="py-2.5 px-3">No</th>
                              <th className="py-2.5 px-3">NIP (18 Digit)</th>
                              <th className="py-2.5 px-3">Nama Pegawai</th>
                              <th className="py-2.5 px-3">No. Rekening Bank Mandiri</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedData.karyawanList.map((k, i) => (
                              <tr key={k.nip} className="hover:bg-slate-50 transition">
                                <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                                <td className="py-2 px-3 font-mono text-slate-700 font-medium">{k.nip}</td>
                                <td className="py-2 px-3 font-semibold text-slate-900">{k.nama}</td>
                                <td className="py-2 px-3 text-slate-600 font-mono">{k.no_rekening}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeTab === 'gaji' && (
                      <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                              <th className="py-2.5 px-3">NIP</th>
                              <th className="py-2.5 px-3">Nama</th>
                              <th className="py-2.5 px-3 text-right">Gaji Bruto</th>
                              <th className="py-2.5 px-3 text-right">Koperasi</th>
                              <th className="py-2.5 px-3 text-right">DWP/Korpri</th>
                              <th className="py-2.5 px-3 text-right">THP Gaji</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedData.gajiList.map((g) => (
                              <tr key={g.nip} className="hover:bg-slate-50 transition">
                                <td className="py-2 px-3 font-mono text-slate-700">{g.nip}</td>
                                <td className="py-2 px-3 font-medium text-slate-900">{g.nama || '-'}</td>
                                <td className="py-2 px-3 text-right font-medium">{formatRupiah(g.gaji_bruto)}</td>
                                <td className="py-2 px-3 text-right text-rose-600">{formatRupiah(g.potongan_pinjaman_koperasi)}</td>
                                <td className="py-2 px-3 text-right text-rose-600">{formatRupiah(g.iuran_dwp + g.iuran_korpri)}</td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatRupiah(g.jumlah_diterima)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {activeTab === 'tk' && (
                      <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                              <th className="py-2.5 px-3">NIP</th>
                              <th className="py-2.5 px-3">Nama</th>
                              <th className="py-2.5 px-3 text-right">TK Bruto</th>
                              <th className="py-2.5 px-3 text-right">Pot. Toko & Kop</th>
                              <th className="py-2.5 px-3 text-right">Gagal Debet</th>
                              <th className="py-2.5 px-3 text-right">THP TK</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {parsedData.tkList.map((t) => (
                              <tr key={t.nip} className="hover:bg-slate-50 transition">
                                <td className="py-2 px-3 font-mono text-slate-700">{t.nip}</td>
                                <td className="py-2 px-3 font-medium text-slate-900">{t.nama || '-'}</td>
                                <td className="py-2 px-3 text-right font-medium">{formatRupiah(t.tunjangan_kinerja)}</td>
                                <td className="py-2 px-3 text-right text-rose-600">
                                  {formatRupiah(t.potongan_toko + t.potongan_barang_koperasi + t.potongan_pinjaman_koperasi)}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-400 font-mono">
                                  {formatRupiah(t.potongan_gagal_debet)}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatRupiah(t.jumlah_diterima)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
