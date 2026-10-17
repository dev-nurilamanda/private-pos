import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Calendar,
  Search,
  FileSpreadsheet,
  X,
  Coins,
  Building2,
  CreditCard,
  Clock,
  BarChart2,
} from 'lucide-react';
import { db, type Transaction } from '../db/db';
import { formatRupiah } from '../utils/formatters';

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'ALL' | 'CUSTOM';
type ChartMetric = 'SELLING' | 'PROFIT';

interface ChartPoint {
  label: string;
  subLabel?: string;
  selling: number;
  profit: number;
  trxCount: number;
}

export const SalesReport: React.FC = () => {
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];

  // Filter States
  const [preset, setPreset] = useState<DatePreset>('TODAY');
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [customStart, setCustomStart] = useState<string>(todayStr);
  const [customEnd, setCustomEnd] = useState<string>(todayStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  // Chart Metric Toggle & Active Selected Bar Tooltip
  const [chartMetric, setChartMetric] = useState<ChartMetric>('SELLING');
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  // Filter Transactions by Date and Search
  const filteredTransactions = useMemo(() => {
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (preset === 'TODAY') {
      // today range
    } else if (preset === 'YESTERDAY') {
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
    } else if (preset === 'LAST_7_DAYS') {
      startDate.setDate(startDate.getDate() - 6);
    } else if (preset === 'THIS_MONTH') {
      startDate.setDate(1);
    } else if (preset === 'ALL') {
      startDate = new Date(2000, 0, 1, 0, 0, 0, 0);
      endDate = new Date(2099, 11, 31, 23, 59, 59, 999);
    } else if (preset === 'CUSTOM') {
      if (customStart) {
        const [sy, sm, sd] = customStart.split('-').map(Number);
        startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      }
      if (customEnd) {
        const [ey, em, ed] = customEnd.split('-').map(Number);
        endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      }
    }

    return transactions
      .filter((t) => {
        const tDate = new Date(t.date);
        const inDateRange = tDate >= startDate && tDate <= endDate;
        if (!inDateRange) return false;

        if (methodFilter !== 'ALL' && t.paymentMethod !== methodFilter) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = t.productName.toLowerCase().includes(q);
          const matchCustomer = t.customerTarget?.toLowerCase().includes(q);
          const matchId = t.id.toLowerCase().includes(q);
          const matchNotes = t.notes?.toLowerCase().includes(q);
          if (!matchName && !matchCustomer && !matchId && !matchNotes) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, preset, customStart, customEnd, methodFilter, searchQuery]);

  // Financial Calculations & KPI Metrics
  const stats = useMemo(() => {
    let totalSelling = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalQty = 0;
    let paidSelling = 0;
    let unpaidSelling = 0;

    const methodBreakdown: Record<string, { count: number; total: number }> = {
      CASH: { count: 0, total: 0 },
      TRANSFER: { count: 0, total: 0 },
      QRIS: { count: 0, total: 0 },
      HUTANG: { count: 0, total: 0 },
    };

    filteredTransactions.forEach((t) => {
      const qty = t.quantity && t.quantity > 0 ? t.quantity : 1;
      totalSelling += t.sellingPrice;
      totalCost += t.costPrice;
      totalProfit += t.profit;
      totalQty += qty;

      if (t.paymentStatus === 'PAID') {
        paidSelling += t.sellingPrice;
      } else {
        unpaidSelling += t.sellingPrice;
      }

      const m = t.paymentMethod || 'CASH';
      if (!methodBreakdown[m]) {
        methodBreakdown[m] = { count: 0, total: 0 };
      }
      methodBreakdown[m].count += 1;
      methodBreakdown[m].total += t.sellingPrice;
    });

    const trxCount = filteredTransactions.length;
    let totalDiscounts = 0;

    filteredTransactions.forEach((t) => {
      if (t.notes) {
        const match = t.notes.match(/\[Diskon:[^\]]*-Rp\s*([\d\.]+)/);
        if (match && match[1]) {
          const cleanVal = parseInt(match[1].replace(/\./g, ''), 10);
          if (!isNaN(cleanVal)) {
            totalDiscounts += cleanVal;
          }
        }
      }
    });

    const grossProfit = totalSelling - totalCost;
    const netProfit = totalDiscounts > 0 ? Math.max(0, grossProfit - totalDiscounts) : totalProfit;
    const grossMargin = totalSelling > 0 ? (grossProfit / totalSelling) * 100 : 0;
    const profitMargin = totalSelling > 0 ? (netProfit / totalSelling) * 100 : 0;
    const averageOrderValue = trxCount > 0 ? Math.round(totalSelling / trxCount) : 0;
    const costRatio = totalSelling > 0 ? (totalCost / totalSelling) * 100 : 0;

    return {
      totalSelling,
      totalCost,
      totalProfit,
      grossProfit,
      netProfit,
      grossMargin,
      totalQty,
      paidSelling,
      unpaidSelling,
      trxCount,
      profitMargin,
      averageOrderValue,
      costRatio,
      methodBreakdown,
    };
  }, [filteredTransactions]);

  // Aggregate Data for Chart
  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (preset === 'TODAY' || preset === 'YESTERDAY') {
      // Kelompokkan dalam interval 3 jam: 00-03, 03-06, 06-09, 09-12, 12-15, 15-18, 18-21, 21-24
      const slots: ChartPoint[] = [
        { label: '00-03', selling: 0, profit: 0, trxCount: 0 },
        { label: '03-06', selling: 0, profit: 0, trxCount: 0 },
        { label: '06-09', selling: 0, profit: 0, trxCount: 0 },
        { label: '09-12', selling: 0, profit: 0, trxCount: 0 },
        { label: '12-15', selling: 0, profit: 0, trxCount: 0 },
        { label: '15-18', selling: 0, profit: 0, trxCount: 0 },
        { label: '18-21', selling: 0, profit: 0, trxCount: 0 },
        { label: '21-24', selling: 0, profit: 0, trxCount: 0 },
      ];

      filteredTransactions.forEach((t) => {
        const hour = new Date(t.date).getHours();
        const slotIdx = Math.min(7, Math.floor(hour / 3));
        slots[slotIdx].selling += t.sellingPrice;
        slots[slotIdx].profit += t.profit;
        slots[slotIdx].trxCount += 1;
      });

      return slots;
    }

    if (preset === 'LAST_7_DAYS') {
      // 7 Hari Terakhir
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const points: ChartPoint[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const ymd = d.toISOString().slice(0, 10);
        const dayLabel = `${dayNames[d.getDay()]} ${d.getDate()}`;
        points.push({
          label: dayLabel,
          subLabel: ymd,
          selling: 0,
          profit: 0,
          trxCount: 0,
        });
      }

      filteredTransactions.forEach((t) => {
        const tYmd = new Date(t.date).toISOString().slice(0, 10);
        const targetPoint = points.find((p) => p.subLabel === tYmd);
        if (targetPoint) {
          targetPoint.selling += t.sellingPrice;
          targetPoint.profit += t.profit;
          targetPoint.trxCount += 1;
        }
      });

      return points;
    }

    // THIS_MONTH / CUSTOM / ALL: Kelompokkan per tanggal
    const mapByDate: Record<string, { selling: number; profit: number; count: number; dateObj: Date }> = {};

    filteredTransactions.forEach((t) => {
      const d = new Date(t.date);
      const key = d.toISOString().slice(0, 10);
      if (!mapByDate[key]) {
        mapByDate[key] = { selling: 0, profit: 0, count: 0, dateObj: d };
      }
      mapByDate[key].selling += t.sellingPrice;
      mapByDate[key].profit += t.profit;
      mapByDate[key].count += 1;
    });

    const sortedKeys = Object.keys(mapByDate).sort();

    if (sortedKeys.length === 0) {
      return [];
    }

    // Ambil maksimal 12 titik terdekat jika rentang sangat panjang
    const displayKeys = sortedKeys.slice(-12);

    return displayKeys.map((k) => {
      const item = mapByDate[k];
      const d = item.dateObj;
      const formattedLabel = `${d.getDate()} ${d.toLocaleDateString('id-ID', { month: 'short' })}`;
      return {
        label: formattedLabel,
        subLabel: k,
        selling: item.selling,
        profit: item.profit,
        trxCount: item.count,
      };
    });
  }, [preset, filteredTransactions]);

  // Nilai Maksimum untuk Skala Grafik
  const maxVal = useMemo(() => {
    if (chartPoints.length === 0) return 100000;
    const values = chartPoints.map((p) => (chartMetric === 'SELLING' ? p.selling : p.profit));
    const highest = Math.max(...values, 0);
    return highest > 0 ? highest * 1.15 : 100000; // beri sedikit ruang atas (headroom)
  }, [chartPoints, chartMetric]);

  // Active Selected Point Info
  const activePoint = activePointIndex !== null && chartPoints[activePointIndex]
    ? chartPoints[activePointIndex]
    : null;

  // Export CSV Ringkas
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = ['ID', 'Tanggal', 'Produk', 'Qty', 'Modal', 'Jual', 'Laba', 'Metode', 'Status', 'Pelanggan'];
    const rows = filteredTransactions.map((t) => [
      t.id,
      new Date(t.date).toLocaleString('id-ID'),
      `"${t.productName.replace(/"/g, '""')}"`,
      t.quantity || 1,
      t.costPrice,
      t.sellingPrice,
      t.profit,
      t.paymentMethod,
      t.paymentStatus,
      `"${(t.customerTarget || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan_${preset.toLowerCase()}_${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="-mx-4 pb-28 space-y-3">
      {/* 1. Bar Filter Periode & Tanggal Kustom (CONTAINER FLAT EDGE-TO-EDGE) */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setPreset('TODAY');
              setActivePointIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
              preset === 'TODAY'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Hari Ini
          </button>

          <button
            type="button"
            onClick={() => {
              setPreset('YESTERDAY');
              setActivePointIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
              preset === 'YESTERDAY'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Kemarin
          </button>

          <button
            type="button"
            onClick={() => {
              setPreset('LAST_7_DAYS');
              setActivePointIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
              preset === 'LAST_7_DAYS'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            7 Hari
          </button>

          <button
            type="button"
            onClick={() => {
              setPreset('THIS_MONTH');
              setActivePointIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
              preset === 'THIS_MONTH'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Bulan Ini
          </button>

          <button
            type="button"
            onClick={() => {
              setPreset('ALL');
              setActivePointIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer shrink-0 ${
              preset === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua
          </button>

          <button
            type="button"
            onClick={() => {
              setPreset('CUSTOM');
              setActivePointIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg border transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              preset === 'CUSTOM'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Pilih Tanggal</span>
          </button>
        </div>

        {/* Input Rentang Tanggal Kustom */}
        {preset === 'CUSTOM' && (
          <div className="flex items-center gap-2 pt-1 text-xs animate-in fade-in duration-100">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Dari</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => {
                  setCustomStart(e.target.value);
                  setActivePointIndex(null);
                }}
                className="w-full bg-transparent text-slate-900 text-xs font-bold focus:outline-none"
              />
            </div>
            <span className="text-slate-400 font-bold text-xs">-</span>
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Sampai</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => {
                  setCustomEnd(e.target.value);
                  setActivePointIndex(null);
                }}
                className="w-full bg-transparent text-slate-900 text-xs font-bold focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. GRAFIK CHART (CONTAINER FLAT EDGE-TO-EDGE) */}
      <div className="bg-white border-y border-slate-200 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-slate-800" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">
              Grafik Tren Penjualan
            </span>
          </div>

          {/* Toggle Metrik: Omset vs Laba */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setChartMetric('SELLING')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  chartMetric === 'SELLING'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Omset
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('PROFIT')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  chartMetric === 'PROFIT'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Laba
              </button>
            </div>
          </div>

          {/* Tooltip Keterangan Titik Terpilih */}
          {activePoint ? (
            <div className="bg-slate-900 text-white rounded-xl px-3 py-1.5 flex items-center justify-between text-xs animate-in fade-in duration-100">
              <span className="font-semibold text-slate-300">
                {activePoint.label} ({activePoint.trxCount} trx)
              </span>
              <div className="flex items-center gap-2.5 font-bold">
                <span>{formatRupiah(activePoint.selling)}</span>
                <span className="text-emerald-400">+{formatRupiah(activePoint.profit)}</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 flex items-center justify-between px-0.5">
              <span>Sentuh grafik untuk melihat rincian</span>
              <span className="font-semibold text-slate-600">
                Maks: {formatRupiah(maxVal)}
              </span>
            </div>
          )}

          {/* Area Grafik Visual SVG */}
          {chartPoints.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-xs text-slate-400 font-medium">
              Belum ada data grafik pada periode ini
            </div>
          ) : (
            <div className="pt-2 pb-1">
              <div className="w-full h-36 flex items-end gap-1.5 select-none">
                {chartPoints.map((point, idx) => {
                  const currentVal = chartMetric === 'SELLING' ? point.selling : point.profit;
                  const heightPercent = maxVal > 0 ? Math.min(100, Math.max(6, (currentVal / maxVal) * 100)) : 6;
                  const isSelected = activePointIndex === idx;

                  return (
                    <div
                      key={point.label + idx}
                      onClick={() => setActivePointIndex(isSelected ? null : idx)}
                      className="flex-1 h-full flex flex-col justify-end items-center cursor-pointer group"
                      title={`${point.label}: ${formatRupiah(currentVal)}`}
                    >
                      {/* Bar visual */}
                      <div className="w-full max-w-[28px] h-full flex items-end justify-center">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-md transition-all duration-200 ${
                            isSelected
                              ? chartMetric === 'SELLING'
                                ? 'bg-slate-950 ring-2 ring-slate-400'
                                : 'bg-emerald-700 ring-2 ring-emerald-300'
                              : chartMetric === 'SELLING'
                              ? currentVal > 0
                                ? 'bg-slate-900 group-hover:bg-slate-800'
                                : 'bg-slate-200'
                              : currentVal > 0
                              ? 'bg-emerald-500 group-hover:bg-emerald-600'
                              : 'bg-slate-200'
                          }`}
                        />
                      </div>

                      {/* Sumbu X Label */}
                      <span
                        className={`text-[9px] mt-1.5 font-bold truncate block w-full text-center leading-none ${
                          isSelected ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {point.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      {/* 3. KEY PERFORMANCE INDICATOR (CONTAINER FLAT EDGE-TO-EDGE TANPA GARIS KISI) */}
      <div className="bg-white border-y border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Key Performance Indicator
          </span>
        </div>

        {/* 6 Metrik dalam Tata Letak Lega & Bersih (Tanpa Garis Pembatas Kisi / No Thin Lines) */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4.5 px-4 py-4">
          {/* Baris 1: Total Omset & Laba Kotor */}
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-medium block">
              Total Omset
            </span>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              {formatRupiah(stats.totalSelling)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">
                Laba Kotor
              </span>
              {stats.grossMargin > 0 && (
                <span className="text-[11px] font-bold text-emerald-600">
                  ({stats.grossMargin.toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="text-xl font-extrabold text-emerald-600 tracking-tight">
              +{formatRupiah(stats.grossProfit)}
            </div>
          </div>

          {/* Baris 2: Total Modal & Laba Bersih */}
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-medium block">
              Total Modal
            </span>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              {formatRupiah(stats.totalCost)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">
                Laba Bersih
              </span>
              {stats.profitMargin > 0 && (
                <span className="text-[11px] font-bold text-emerald-600">
                  ({stats.profitMargin.toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="text-xl font-extrabold text-emerald-600 tracking-tight">
              +{formatRupiah(stats.netProfit)}
            </div>
          </div>

          {/* Baris 3: Kasbon & Transaksi */}
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-medium block">
              Kasbon
            </span>
            <div className="text-xl font-extrabold text-amber-600 tracking-tight">
              {formatRupiah(stats.unpaidSelling)}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-medium block">
              Transaksi
            </span>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              {stats.trxCount} <span className="text-xs font-bold text-slate-500">trx</span> <span className="text-xs font-normal text-slate-400">• {stats.totalQty} unit</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. BREAKDOWN METODE PEMBAYARAN (CONTAINER FLAT EDGE-TO-EDGE TANPA GARIS KISI) */}
      <div className="bg-white border-y border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Metode Pembayaran
          </span>
          <button
            type="button"
            onClick={handleExportCSV}
            className="text-xs font-bold text-slate-700 hover:text-black flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Download CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            <span>Ekspor CSV</span>
          </button>
        </div>

        {/* 2x2 Metode dalam Tata Letak Bersih (Tanpa Garis Pembatas Kisi / No Thin Lines) */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4">
          {/* Metric 1: Tunai */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-xs text-slate-500 font-medium">Tunai</span>
              <span className="text-[11px] font-semibold text-slate-400">({stats.methodBreakdown.CASH.count})</span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              {formatRupiah(stats.methodBreakdown.CASH.total)}
            </div>
          </div>

          {/* Metric 2: Transfer Bank */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="text-xs text-slate-500 font-medium">Transfer</span>
              <span className="text-[11px] font-semibold text-slate-400">({stats.methodBreakdown.TRANSFER.count})</span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              {formatRupiah(stats.methodBreakdown.TRANSFER.total)}
            </div>
          </div>

          {/* Metric 3: QRIS */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-xs text-slate-500 font-medium">QRIS</span>
              <span className="text-[11px] font-semibold text-slate-400">({stats.methodBreakdown.QRIS.count})</span>
            </div>
            <div className="text-xl font-extrabold text-slate-900 tracking-tight">
              {formatRupiah(stats.methodBreakdown.QRIS.total)}
            </div>
          </div>

          {/* Metric 4: Kasbon */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-xs text-slate-500 font-medium">Kasbon</span>
              <span className="text-[11px] font-semibold text-slate-400">({stats.methodBreakdown.HUTANG.count})</span>
            </div>
            <div className="text-xl font-extrabold text-amber-600 tracking-tight">
              {formatRupiah(stats.methodBreakdown.HUTANG.total)}
            </div>
          </div>
        </div>
      </div>

      {/* 5. RINCIAN DAFTAR TRANSAKSI (CONTAINER FLAT EDGE-TO-EDGE) */}
      <div className="bg-white border-y border-slate-200">
        <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Rincian Transaksi ({filteredTransactions.length})
            </span>

            {/* Filter Metode Cepat */}
            <div className="flex items-center gap-1 text-[11px] font-bold">
              {(['ALL', 'CASH', 'TRANSFER', 'QRIS', 'HUTANG'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethodFilter(m)}
                  className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                    methodFilter === m
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900 bg-slate-100'
                  }`}
                >
                  {m === 'ALL' ? 'Semua' : m === 'HUTANG' ? 'Kasbon' : m}
                </button>
              ))}
            </div>
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari transaksi / pembeli / catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* List Transaksi dalam Container Flat Edge-to-Edge */}
        <div className="divide-y divide-slate-100">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400 text-xs">
              Tidak ada data transaksi.
            </div>
          ) : (
            filteredTransactions.map((t) => {
              const dateObj = new Date(t.date);
              const timeStr = dateObj.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const dateStr = dateObj.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <div key={t.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-slate-900 truncate">{t.productName}</span>
                      {t.quantity && t.quantity > 1 && (
                        <span className="text-[10px] font-bold text-slate-500">({t.quantity}x)</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                      <span>{dateStr}, {timeStr}</span>
                      <span>•</span>
                      <span className="font-medium text-slate-600">{t.paymentMethod}</span>
                      {t.customerTarget && (
                        <>
                          <span>•</span>
                          <span className="truncate text-slate-700">{t.customerTarget}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-0.5">
                    <span className="font-black text-slate-900 block text-sm leading-tight">
                      {formatRupiah(t.sellingPrice)}
                    </span>
                    <div className="flex items-center justify-end gap-1.5 text-[10px]">
                      <span className="text-emerald-600 font-semibold">
                        +{formatRupiah(t.profit)}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold ${
                          t.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {t.paymentStatus === 'PAID' ? 'Lunas' : 'Kasbon'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
