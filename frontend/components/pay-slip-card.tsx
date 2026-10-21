'use client';

import { Printer, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatRupiah } from '@/utils/etl';

interface PaySlipCardProps {
  karyawan: {
    nip: string;
    nama: string;
    no_rekening: string;
  };
  gaji?: {
    gaji_bruto: number;
    simpanan_pokok: number;
    simpanan_sukarela: number;
    simpanan_wajib: number;
    iuran_dwp: number;
    iuran_korpri: number;
    potongan_pinjaman_koperasi: number;
    jumlah_diterima: number;
  };
  tk?: {
    tunjangan_kinerja: number;
    simpanan_sukarela: number;
    potongan_toko: number;
    potongan_barang_koperasi: number;
    potongan_pinjaman_koperasi: number;
    potongan_pinjaman_dwp: number;
    potongan_untalan: number;
    potongan_arisan_dwp: number;
    potongan_gagal_debet: number;
    jumlah_diterima: number;
  };
  periode: string;
}

export default function PaySlipCard({
  karyawan,
  gaji,
  tk,
  periode,
}: PaySlipCardProps) {
  const handlePrint = () => {
    window.print();
  };

  const gajiBruto = gaji?.gaji_bruto || 0;
  const tkBruto = tk?.tunjangan_kinerja || 0;
  const totalInflow = gajiBruto + tkBruto;

  const totalPotonganGaji =
    (gaji?.simpanan_pokok || 0) +
    (gaji?.simpanan_sukarela || 0) +
    (gaji?.simpanan_wajib || 0) +
    (gaji?.iuran_dwp || 0) +
    (gaji?.iuran_korpri || 0) +
    (gaji?.potongan_pinjaman_koperasi || 0);

  const totalPotonganTK =
    (tk?.simpanan_sukarela || 0) +
    (tk?.potongan_toko || 0) +
    (tk?.potongan_barang_koperasi || 0) +
    (tk?.potongan_pinjaman_koperasi || 0) +
    (tk?.potongan_pinjaman_dwp || 0) +
    (tk?.potongan_untalan || 0) +
    (tk?.potongan_arisan_dwp || 0);

  const totalPotonganEfektif = totalPotonganGaji + totalPotonganTK;
  const takeHomePayGaji = gaji?.jumlah_diterima ?? (gajiBruto - totalPotonganGaji);
  const takeHomePayTK = tk?.jumlah_diterima ?? (tkBruto - totalPotonganTK);
  const totalTakeHomePay = takeHomePayGaji + takeHomePayTK;

  // Format label periode: "2026-08" -> "Agustus 2026"
  const formatPeriodeLabel = (p: string) => {
    if (!p || !p.includes('-')) return p;
    const [year, month] = p.split('-');
    const mNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const idx = parseInt(month, 10) - 1;
    return `${mNames[idx] || month} ${year}`;
  };

  const formatNominalOrDash = (val?: number) => {
    if (!val || val === 0) return 'Rp -';
    return formatRupiah(val);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print-card">
      {/* Action Bar (Hidden during print) */}
      <div className="no-print bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>Nota Resmi Slip Gaji & Tunjangan Kinerja Terverifikasi</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-900 hover:bg-sky-800 text-white text-xs font-medium rounded-lg transition shadow-sm cursor-pointer shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Slip (PDF / A4)</span>
          </button>
        </div>
      </div>

      {/* Slip Content Container */}
      <div className="p-8 sm:p-10 space-y-8">
        {/* Kop Surat / Header Instansi */}
        <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shrink-0 p-1.5 shadow-xs">
              <img
                src="/bps_slip_card.png"
                alt="Logo BPS"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
                BADAN PUSAT STATISTIK
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                SURAT RINCIAN PENDAPATAN & TUNJANGAN KINERJA PEGAWAI
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Dokumen Resmi Penatausahaan Keuangan & Penggajian
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-sky-900 uppercase tracking-wide">
              PERIODE TRANSAKSI
            </div>
            <div className="text-sm font-black text-slate-900 mt-0.5">
              {formatPeriodeLabel(periode)}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">
              Ref: {karyawan.nip}-{periode}
            </div>
          </div>
        </div>

        {/* Identitas Karyawan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px] font-medium">Nama Lengkap:</span>
            <span className="font-bold text-slate-900 text-sm">{karyawan.nama}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px] font-medium">Nomor Induk Pegawai (NIP):</span>
            <span className="font-mono font-semibold text-slate-800 text-sm">{karyawan.nip}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px] font-medium">No. Rekening Penerima:</span>
            <span className="font-mono font-semibold text-slate-800 text-sm">
              Bank Mandiri {karyawan.no_rekening || '-'}
            </span>
          </div>
        </div>

        {/* Tabel Komponen Penerimaan (Inflow) */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-900 inline-block" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Komponen Penghasilan 
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold border-y border-slate-200">
                  <th className="py-2.5 px-4 text-left">Komponen Pendapatan</th>
                  <th className="py-2.5 px-4 text-left">Keterangan Sumber</th>
                  <th className="py-2.5 px-4 text-right">Nominal (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">Gaji Pokok Kotor (Bruto)</td>
                  <td className="py-2.5 px-4 text-slate-500">Lembar Transaksi Penggajian</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900">{formatRupiah(gajiBruto)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">Tunjangan Kinerja Kotor (Bruto)</td>
                  <td className="py-2.5 px-4 text-slate-500">Lembar Transaksi Tunjangan Kinerja</td>
                  <td className="py-2.5 px-4 text-right font-medium text-slate-900">{formatRupiah(tkBruto)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t border-slate-200">
                  <td colSpan={2} className="py-2.5 px-4 text-slate-800">Total Penghasilan Kotor:</td>
                  <td className="py-2.5 px-4 text-right text-sky-900">{formatRupiah(totalInflow)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Tabel Komponen Potongan (Deductions) */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-600 inline-block" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Komponen Kewajiban & Potongan
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-rose-50/50 text-slate-700 font-semibold border-y border-slate-200">
                  <th className="py-2.5 px-4 text-left">Pos Potongan</th>
                  <th className="py-2.5 px-4 text-left">Kategori Sumber</th>
                  <th className="py-2.5 px-4 text-right">Nominal (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* 1. Potongan Gaji (Seluruh Komponen Selalu Tampil) */}
                <tr>
                  <td className="py-2 px-4 text-slate-700">Simpanan Pokok Koperasi</td>
                  <td className="py-2 px-4 text-slate-400">Potongan Gaji</td>
                  <td className={`py-2 px-4 text-right ${gaji?.simpanan_pokok ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(gaji?.simpanan_pokok)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Simpanan Wajib Koperasi</td>
                  <td className="py-2 px-4 text-slate-400">Potongan Gaji</td>
                  <td className={`py-2 px-4 text-right ${gaji?.simpanan_wajib ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(gaji?.simpanan_wajib)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Simpanan Sukarela (Gaji)</td>
                  <td className="py-2 px-4 text-slate-400">Potongan Gaji</td>
                  <td className={`py-2 px-4 text-right ${gaji?.simpanan_sukarela ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(gaji?.simpanan_sukarela)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Iuran DWP (Dharma Wanita Persatuan)</td>
                  <td className="py-2 px-4 text-slate-400">Potongan Gaji</td>
                  <td className={`py-2 px-4 text-right ${gaji?.iuran_dwp ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(gaji?.iuran_dwp)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Iuran KORPRI</td>
                  <td className="py-2 px-4 text-slate-400">Potongan Gaji</td>
                  <td className={`py-2 px-4 text-right ${gaji?.iuran_korpri ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(gaji?.iuran_korpri)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Pinjaman Koperasi (Gaji)</td>
                  <td className="py-2 px-4 text-slate-400">Potongan Gaji</td>
                  <td className={`py-2 px-4 text-right ${gaji?.potongan_pinjaman_koperasi ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(gaji?.potongan_pinjaman_koperasi)}
                  </td>
                </tr>

                {/* 2. Potongan TK (Seluruh Komponen Selalu Tampil) */}
                <tr>
                  <td className="py-2 px-4 text-slate-700">Simpanan Sukarela (TK)</td>
                  <td className="py-2 px-4 text-slate-400">Potongan TK</td>
                  <td className={`py-2 px-4 text-right ${tk?.simpanan_sukarela ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(tk?.simpanan_sukarela)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Potongan Belanja Toko</td>
                  <td className="py-2 px-4 text-slate-400">Potongan TK</td>
                  <td className={`py-2 px-4 text-right ${tk?.potongan_toko ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(tk?.potongan_toko)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Potongan Barang Koperasi</td>
                  <td className="py-2 px-4 text-slate-400">Potongan TK</td>
                  <td className={`py-2 px-4 text-right ${tk?.potongan_barang_koperasi ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(tk?.potongan_barang_koperasi)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Pinjaman Koperasi (TK)</td>
                  <td className="py-2 px-4 text-slate-400">Potongan TK</td>
                  <td className={`py-2 px-4 text-right ${tk?.potongan_pinjaman_koperasi ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(tk?.potongan_pinjaman_koperasi)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Pinjaman DWP</td>
                  <td className="py-2 px-4 text-slate-400">Potongan TK</td>
                  <td className={`py-2 px-4 text-right ${tk?.potongan_pinjaman_dwp ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(tk?.potongan_pinjaman_dwp)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Potongan Untalan / Keu+</td>
                  <td className="py-2 px-4 text-slate-400">Potongan TK</td>
                  <td className={`py-2 px-4 text-right ${tk?.potongan_untalan ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(tk?.potongan_untalan)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-4 text-slate-700">Arisan DWP</td>
                  <td className="py-2 px-4 text-slate-400">Potongan TK</td>
                  <td className={`py-2 px-4 text-right ${tk?.potongan_arisan_dwp ? 'text-rose-600 font-medium' : 'text-slate-400'}`}>
                    {formatNominalOrDash(tk?.potongan_arisan_dwp)}
                  </td>
                </tr>

                {/* 3. Potongan Gagal Debet (Non-Deducting Audit Note) */}
                <tr className="bg-slate-50/70 italic">
                  <td className="py-2 px-4 text-slate-500 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Potongan Gagal Debet Gaji (Terkecuali)</span>
                  </td>
                  <td className="py-2 px-4 text-slate-400">Rekonsiliasi Bank</td>
                  <td className="py-2 px-4 text-right font-mono text-slate-400">
                    {tk?.potongan_gagal_debet && tk.potongan_gagal_debet > 0
                      ? `(${formatRupiah(tk.potongan_gagal_debet)})`
                      : 'Rp -'}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-rose-50/70 font-bold border-t border-slate-200">
                  <td colSpan={2} className="py-2.5 px-4 text-slate-800">
                    Potongan:
                  </td>
                  <td className="py-2.5 px-4 text-right text-rose-700">
                    - {formatRupiah(totalPotonganEfektif)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Bersih (Jumlah Diterima) */}
        <div className="bg-emerald-50 border-2 border-emerald-600/60 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                TOTAL PENDAPATAN (BERSIH)
              </span>
            </div>
            <div className="text-xs text-emerald-700 mt-1">
              Rincian: THP Gaji ({formatRupiah(takeHomePayGaji)}) + THP Tunjangan Kinerja ({formatRupiah(takeHomePayTK)})
            </div>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight block">
              {formatRupiah(totalTakeHomePay)}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">Ditransfer ke Rekening Mandiri</span>
          </div>
        </div>
      </div>
    </div>
  );
}
