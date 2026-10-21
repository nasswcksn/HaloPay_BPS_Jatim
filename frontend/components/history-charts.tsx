'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { formatRupiah } from '@/utils/etl';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { useState } from 'react';

export interface HistoryDataPoint {
  periode: string;
  gajiBruto: number;
  tkBruto: number;
  totalBruto: number;
  totalPotongan: number;
  thp: number;
}

interface HistoryChartsProps {
  data: HistoryDataPoint[];
}

export default function HistoryCharts({ data }: HistoryChartsProps) {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-400 no-print">
        Belum ada data historis periode sebelumnya untuk ditampilkan pada grafik.
      </div>
    );
  }

  // Format Y-axis Rupiah ringkas (Juta)
  const formatYAxis = (val: number) => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)} jt`;
    }
    return String(val);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg text-xs space-y-1">
          <p className="font-bold text-sky-300 mb-1 border-b border-slate-700 pb-1">
            Periode: {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-semibold">{formatRupiah(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm no-print">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-800" />
            <h3 className="text-sm font-bold text-slate-900">Analitik Tren Historis Pendapatan</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Perbandingan fluktuasi penghasilan kotor, potongan, dan nominal bersih antar-periode
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setChartType('bar')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1 cursor-pointer ${
              chartType === 'bar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Batang</span>
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1 cursor-pointer ${
              chartType === 'line' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Garis</span>
          </button>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="periode" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Bar dataKey="totalBruto" name="Total Bruto" fill="#0284c7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalPotongan" name="Potongan" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="thp" name="Jumlah Diterima" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="periode" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Line
                type="monotone"
                dataKey="totalBruto"
                name="Total Bruto"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="totalPotongan"
                name="Potongan"
                stroke="#f43f5e"
                strokeWidth={2.5}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="thp"
                name="Jumlah Diterima"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 5 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
