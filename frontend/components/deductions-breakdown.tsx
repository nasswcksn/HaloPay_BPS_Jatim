'use client';

import { formatRupiah } from '@/utils/etl';
import { Layers, ArrowDownRight } from 'lucide-react';

interface DeductionsBreakdownProps {
  gajiBruto: number;
  tkBruto: number;
  potonganGaji: number;
  potonganTK: number;
  gagalDebet: number;
  thpTotal: number;
}

export default function DeductionsBreakdown({
  gajiBruto,
  tkBruto,
  potonganGaji,
  potonganTK,
  gagalDebet,
  thpTotal,
}: DeductionsBreakdownProps) {
  const totalInflow = gajiBruto + tkBruto;
  const totalPotongan = potonganGaji + potonganTK;

  // Persentase
  const percentTHP = totalInflow > 0 ? Math.round((thpTotal / totalInflow) * 100) : 0;
  const percentPotongan = totalInflow > 0 ? Math.round((totalPotongan / totalInflow) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm no-print">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-800" />
          <h3 className="text-sm font-bold text-slate-900">Visual Flow Dekonstruksi Pendapatan</h3>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Diterima Bersih: <strong className="text-emerald-700">{percentTHP}%</strong>
        </span>
      </div>

      {/* Progress Multi-Bar */}
      <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex p-0.5 mb-4 border border-slate-200">
        <div
          style={{ width: `${percentTHP}%` }}
          className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
          title={`Jumlah Diterima: ${formatRupiah(thpTotal)} (${percentTHP}%)`}
        />
        <div
          style={{ width: `${percentPotongan}%` }}
          className="bg-rose-500 h-full rounded-r-full transition-all duration-500"
          title={`Total Potongan: ${formatRupiah(totalPotongan)} (${percentPotongan}%)`}
        />
      </div>

      {/* Breakdown Items Waterfall Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        {/* Step 1: Inflow */}
        <div className="p-3 bg-sky-50 rounded-xl border border-sky-100">
          <span className="text-sky-700 block text-[11px] font-medium">1. Total Bruto</span>
          <span className="font-bold text-sky-950 text-sm">{formatRupiah(totalInflow)}</span>
          <span className="text-[10px] text-sky-600 block mt-0.5">Gaji + TK</span>
        </div>

        {/* Step 2: Potongan Gaji */}
        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
          <div className="flex items-center gap-1 text-rose-700 text-[11px] font-medium">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>2. Pot. Gaji</span>
          </div>
          <span className="font-bold text-rose-900 text-sm">- {formatRupiah(potonganGaji)}</span>
          <span className="text-[10px] text-rose-600 block mt-0.5">Kop, DWP, Korpri</span>
        </div>

        {/* Step 3: Potongan TK */}
        <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
          <div className="flex items-center gap-1 text-rose-700 text-[11px] font-medium">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>3. Pot. TK</span>
          </div>
          <span className="font-bold text-rose-900 text-sm">- {formatRupiah(potonganTK)}</span>
          <span className="text-[10px] text-rose-600 block mt-0.5">Toko, Arisan, Untalan</span>
        </div>

        {/* Step 4: Net THP */}
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
          <span className="text-emerald-700 block text-[11px] font-semibold">4. Jumlah Diterima</span>
          <span className="font-bold text-emerald-950 text-sm">{formatRupiah(thpTotal)}</span>
          <span className="text-[10px] text-emerald-700 block mt-0.5">{percentTHP}% dari Total Bruto</span>
        </div>
      </div>

      {gagalDebet > 0 && (
        <div className="mt-3 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
          <span>Pencatatan Audit Gagal Debet:</span>
          <span className="font-mono font-semibold text-slate-700">
            {formatRupiah(gagalDebet)} (Non-Deducting)
          </span>
        </div>
      )}
    </div>
  );
}
