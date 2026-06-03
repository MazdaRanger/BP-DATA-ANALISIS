/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { MetricSummary, ComparativeMatrix } from "../types.js";
import { DollarSign, ShieldAlert, Layers, MapPin, Grid, Percent, TrendingUp, TrendingDown, ArrowUpRight, Award } from "lucide-react";
import { motion } from "motion/react";

interface DashboardProps {
  summary: MetricSummary;
  m2m: ComparativeMatrix | null;
  y2y: ComparativeMatrix | null;
  weeklyTrend: { week: string; revenue: number; cost: number; profit: number }[];
  insuranceStats: { name: string; panels: number; share: number }[];
  activeWeek: number | "ALL";
  setActiveWeek: (week: number | "ALL") => void;
  activeMonthName: string;
  activeYear: number;
}

export default function Dashboard({
  summary,
  m2m,
  y2y,
  weeklyTrend,
  insuranceStats,
  activeWeek,
  setActiveWeek,
  activeMonthName,
  activeYear
}: DashboardProps) {

  // Helper to format currency IDR
  const formatIDR = (v: number) => {
    return `Rp ${v.toLocaleString("id-ID")}`;
  };

  // Helper to render comparison stat badge
  const renderComparisonBadge = (matrix: ComparativeMatrix | null, field: keyof ComparativeMatrix, invertColor = false) => {
    if (!matrix) return <span className="text-[10px] text-gray-500 font-mono">N/A</span>;
    const comp = matrix[field];
    const isGain = comp.percentageChange >= 0;
    
    // For expenses, a gain (cost increase) might be styled red, vice versa
    const isWaringStyle = invertColor ? isGain : !isGain;
    const colorClass = isWaringStyle 
      ? "text-red-400 bg-red-950/40 border-red-500/20" 
      : "text-emerald-400 bg-emerald-950/40 border-emerald-500/20";
    
    return (
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded border font-mono font-semibold ${colorClass}`}>
        {isGain ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
        {isGain ? "+" : ""}{comp.percentageChange}%
      </span>
    );
  };

  const grossProfitMargin = summary.revenue > 0 ? (summary.grossProfit / summary.revenue) * 100 : 0;

  return (
    <div className="space-y-6">
      
      {/* Tab Filter Week */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h3 className="text-sm font-semibold text-white font-sans flex items-center gap-1.5">
            <Grid className="w-4 h-4 text-indigo-400" /> Filter Analisis Mingguan ({activeMonthName} {activeYear})
          </h3>
          <p className="text-xs text-gray-400 font-mono mt-0.5">Saring data performa berdasarkan ritme operasional mingguan</p>
        </div>

        <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-lg border border-gray-900">
          {(["ALL", 1, 2, 3, 4, 5] as const).map((wk) => (
            <button
              key={wk}
              onClick={() => setActiveWeek(wk)}
              type="button"
              id={`filter-week-${wk}`}
              className={`px-3 py-1 text-xs rounded-md font-mono cursor-pointer transition ${
                activeWeek === wk
                  ? "bg-indigo-500 text-black font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  : "text-gray-400 hover:text-white hover:bg-gray-900"
              }`}
            >
              {wk === "ALL" ? "Semua Minggu" : `Minggu ${wk}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Utama 10 Card Sesuai Mandat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Metric 1: Total Jasa Nett */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-400 font-sans text-xs">Total Jasa Nett</span>
            <span className="p-1.5 rounded-lg bg-gray-900 border border-gray-850"><DollarSign className="w-4 h-4 text-indigo-400" /></span>
          </div>
          <div className="mt-3">
            <h4 className="text-[15px] font-mono text-white font-semibold truncate" title={formatIDR(summary.jasaNett)}>
              {formatIDR(summary.jasaNett)}
            </h4>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
              <span className="text-[9px] text-gray-500 font-mono">M2M:</span>
              {renderComparisonBadge(m2m, "jasaNett")}
              <span className="text-[9px] text-gray-500 font-mono">Y2Y:</span>
              {renderComparisonBadge(y2y, "jasaNett")}
            </div>
          </div>
        </div>

        {/* Metric 2: Total Part + Material Nett */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-400 font-sans text-xs">Total Part + Mat Nett</span>
            <span className="p-1.5 rounded-lg bg-gray-900 border border-gray-850"><DollarSign className="w-4 h-4 text-emerald-400" /></span>
          </div>
          <div className="mt-3">
            <h4 className="text-[15px] font-mono text-white font-semibold truncate" title={formatIDR(summary.partMaterialNett)}>
              {formatIDR(summary.partMaterialNett)}
            </h4>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
              <span className="text-[9px] text-gray-500 font-mono">M2M:</span>
              {renderComparisonBadge(m2m, "partMaterialNett")}
              <span className="text-[9px] text-gray-500 font-mono">Y2Y:</span>
              {renderComparisonBadge(y2y, "partMaterialNett")}
            </div>
          </div>
        </div>

        {/* Metric 3: Total Expenses Bahan */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-400 font-sans text-xs">Expenses Bahan</span>
            <span className="p-1.5 rounded-lg bg-gray-900 border border-gray-850"><ShieldAlert className="w-4 h-4 text-amber-400" /></span>
          </div>
          <div className="mt-3">
            <h4 className="text-[15px] font-mono text-white font-semibold truncate" title={formatIDR(summary.expensesBahan)}>
              {formatIDR(summary.expensesBahan)}
            </h4>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
              <span className="text-[9px] text-gray-500 font-mono">M2M:</span>
              {renderComparisonBadge(m2m, "expensesBahan", true)}
              <span className="text-[9px] text-gray-500 font-mono">Y2Y:</span>
              {renderComparisonBadge(y2y, "expensesBahan", true)}
            </div>
          </div>
        </div>

        {/* Metric 4: HPP Part Dan Material */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-400 font-sans text-xs">HPP Part Dan Material</span>
            <span className="p-1.5 rounded-lg bg-gray-900 border border-gray-850"><ShieldAlert className="w-4 h-4 text-orange-400" /></span>
          </div>
          <div className="mt-3">
            <h4 className="text-[15px] font-mono text-white font-semibold truncate" title={formatIDR(summary.hppPartMaterial)}>
              {formatIDR(summary.hppPartMaterial)}
            </h4>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
              <span className="text-[9px] text-gray-500 font-mono">M2M:</span>
              {renderComparisonBadge(m2m, "hppPartMaterial", true)}
              <span className="text-[9px] text-gray-500 font-mono">Y2Y:</span>
              {renderComparisonBadge(y2y, "hppPartMaterial", true)}
            </div>
          </div>
        </div>

        {/* Metric 5: Jasa Pekerjaan Luar (SPKL) */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-400 font-sans text-xs">Subkont Kerja Luar (SPKL)</span>
            <span className="p-1.5 rounded-lg bg-gray-900 border border-gray-850"><ShieldAlert className="w-4 h-4 text-purple-400" /></span>
          </div>
          <div className="mt-3">
            <h4 className="text-[15px] font-mono text-white font-semibold truncate" title={formatIDR(summary.spkl)}>
              {formatIDR(summary.spkl)}
            </h4>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
              <span className="text-[9px] text-gray-500 font-mono">M2M:</span>
              {renderComparisonBadge(m2m, "spkl", true)}
              <span className="text-[9px] text-gray-500 font-mono">Y2Y:</span>
              {renderComparisonBadge(y2y, "spkl", true)}
            </div>
          </div>
        </div>

        {/* Metric 6: Total Revenue */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl bg-gradient-to-br from-indigo-950/20 to-gray-900/60 relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-300 font-medium font-sans text-xs">Total Revenue</span>
            <span className="p-1 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-mono font-bold">In-Flow</span>
          </div>
          <div className="mt-3">
            <h4 className="text-[16px] font-mono text-white font-bold truncate text-glow-cyan" title={formatIDR(summary.revenue)}>
              {formatIDR(summary.revenue)}
            </h4>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
              <span className="text-[9px] text-gray-500 font-mono">M2M:</span>
              {renderComparisonBadge(m2m, "revenue")}
              <span className="text-[9px] text-gray-500 font-mono">Y2Y:</span>
              {renderComparisonBadge(y2y, "revenue")}
            </div>
          </div>
        </div>

        {/* Metric 7: Total Expenses */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl bg-gradient-to-br from-orange-950/20 to-gray-900/60 relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-300 font-medium font-sans text-xs">Total Expenses</span>
            <span className="p-1 rounded bg-orange-500/10 text-orange-400 text-[10px] font-mono font-bold">Out-Flow</span>
          </div>
          <div className="mt-3">
            <h4 className="text-[16px] font-mono text-white font-semibold truncate" title={formatIDR(summary.expenses)}>
              {formatIDR(summary.expenses)}
            </h4>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
              <span className="text-[9px] text-gray-500 font-mono">M2M:</span>
              {renderComparisonBadge(m2m, "expenses", true)}
              <span className="text-[9px] text-gray-500 font-mono">Y2Y:</span>
              {renderComparisonBadge(y2y, "expenses", true)}
            </div>
          </div>
        </div>

        {/* Metric 8: Total Gross Profit & Margins */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl bg-gradient-to-br from-emerald-950/20 to-gray-900/60 relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-300 font-medium font-sans text-xs">Total Gross Profit</span>
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
              <Percent className="w-2.5 h-2.5" /> {grossProfitMargin.toFixed(1)}%
            </span>
          </div>
          <div className="mt-3">
            <h4 className="text-[16px] font-mono text-emerald-300 font-bold truncate text-glow-green" title={formatIDR(summary.grossProfit)}>
              {formatIDR(summary.grossProfit)}
            </h4>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
              <span className="text-[9px] text-gray-500 font-mono">M2M:</span>
              {renderComparisonBadge(m2m, "grossProfit")}
              <span className="text-[9px] text-gray-500 font-mono">Y2Y:</span>
              {renderComparisonBadge(y2y, "grossProfit")}
            </div>
          </div>
        </div>

        {/* Metric 9: Total Jumlah Asuransi */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-400 font-sans text-xs">Jumlah Asuransi</span>
            <span className="p-1.5 rounded-lg bg-gray-900 border border-gray-850"><Layers className="w-4 h-4 text-indigo-400" /></span>
          </div>
          <div className="mt-3">
            <h4 className="text-xl font-mono text-white font-bold">
              {summary.asuransiCount} <span className="text-xs text-gray-500">Mitra</span>
            </h4>
            <p className="text-[10px] text-gray-500 mt-2 font-mono leading-relaxed pt-2 border-t border-gray-900">
              Jumlah asuransi aktif membiayai SPK
            </p>
          </div>
        </div>

        {/* Metric 10: Total Jumlah Panel */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-gray-400 font-sans text-xs">Jumlah Panel</span>
            <span className="p-1.5 rounded-lg bg-gray-900 border border-gray-850"><ArrowUpRight className="w-4 h-4 text-pink-400" /></span>
          </div>
          <div className="mt-3">
            <h4 className="text-xl font-mono text-white font-bold">
              {summary.panelCount} <span className="text-xs text-gray-500">Panel</span>
            </h4>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-900">
              <span className="text-[9px] text-gray-500 font-mono">M2M:</span>
              {renderComparisonBadge(m2m, "panelCount")}
              <span className="text-[9px] text-gray-500 font-mono">Y2Y:</span>
              {renderComparisonBadge(y2y, "panelCount")}
            </div>
          </div>
        </div>

      </div>

      {/* Baris Grafik & Top 5 Daerah */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Perbandingan Area Revenue vs Expenses (Weekly) */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#222] p-4 rounded-xl relative ">
          <h4 className="text-xs font-bold text-gray-200 uppercase font-mono tracking-wider mb-4 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-400" /> Grafik Tren Keuangan Mingguan
          </h4>

          {weeklyTrend.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-xs text-gray-500 font-mono">
              Tidak ada tren mingguan pada rentang waktu ini
            </div>
          ) : (
            <div className="h-60 relative flex flex-col justify-between pt-4">
              
              {/* Simple Legend */}
              <div className="flex items-center gap-4 text-[10px] font-mono absolute top-0 right-0">
                <span className="flex items-center gap-1 text-indigo-400">
                  <span className="w-2.5 h-2.5 rounded bg-indigo-400 inline-block"></span> Revenue
                </span>
                <span className="flex items-center gap-1 text-orange-400">
                  <span className="w-2.5 h-2.5 rounded bg-orange-400 inline-block"></span> Expenses
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-0.5 bg-dashed bg-emerald-400 inline-block"></span> Profit
                </span>
              </div>

              {/* Graphical Canvas (Pure responsive reactive CSS SVG graph) */}
              <svg className="w-full h-44 overflow-visible" preserveAspectRatio="none">
                {/* Visual Guides */}
                <line x1="0" y1="20%" x2="100%" y2="20%" stroke="#1f1f2e" strokeDasharray="3" />
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#1f1f2e" strokeDasharray="3" />
                <line x1="0" y1="80%" x2="100%" y2="80%" stroke="#1f1f2e" strokeDasharray="3" />

                {/* SVG Graph path calculation */}
                {(() => {
                  const maxMoney = Math.max(...weeklyTrend.map(w => Math.max(w.revenue, w.cost, 1000000))) * 1.1;
                  const getPercentY = (val: number) => 100 - (val / maxMoney) * 100;
                  const stepX = 100 / (weeklyTrend.length - 1 || 1);

                  // Paths
                  const revPoints = weeklyTrend.map((w, idx) => `${idx * stepX}%,${getPercentY(w.revenue)}%`).join(" ");
                  const costPoints = weeklyTrend.map((w, idx) => `${idx * stepX}%,${getPercentY(w.cost)}%`).join(" ");
                  const profitPoints = weeklyTrend.map((w, idx) => `${idx * stepX}%,${getPercentY(w.profit)}%`).join(" ");

                  return (
                    <>
                      {/* Gradient definition */}
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Area Shadows */}
                      <polygon points={`0%,100% ${revPoints} 100%,100%`} fill="url(#revGrad)" />
                      <polygon points={`0%,100% ${costPoints} 100%,100%`} fill="url(#costGrad)" />

                      {/* Main Stroke Lines */}
                      <polyline points={revPoints} fill="none" stroke="#06b6d4" strokeWidth="2.5" />
                      <polyline points={costPoints} fill="none" stroke="#f97316" strokeWidth="2" />
                      <polyline points={profitPoints} fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="4" />

                      {/* Hoverable vertices */}
                      {weeklyTrend.map((w, idx) => (
                        <g key={idx}>
                          <circle cx={`${idx * stepX}%`} cy={`${getPercentY(w.revenue)}%`} r="4.5" fill="#06b6d4" stroke="#020205" strokeWidth="1.5" />
                          <circle cx={`${idx * stepX}%`} cy={`${getPercentY(w.cost)}%`} r="4" fill="#f97316" stroke="#020205" strokeWidth="1.5" />
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>

              {/* X Axes names */}
              <div className="flex items-center justify-between font-mono text-[10px] text-gray-500 pt-1 border-t border-gray-900">
                {weeklyTrend.map((w, idx) => (
                  <span key={idx} className="truncate select-none text-center" style={{ width: `${100 / weeklyTrend.length}%` }}>
                    W{w.week.slice(-1)}
                    <span className="block text-[8px] text-gray-600 mt-0.5">({formatIDR(w.revenue).replace("Rp ", "").split(",")[0].slice(0, -3)}K)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5 Besar Wilayah Pelanggan Terbanyak */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-200 uppercase font-mono tracking-wider mb-4 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-purple-400" /> 5 Besar Wilayah Pelanggan
            </h4>

            {summary.regionCounts.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-gray-500 font-mono">
                Tidak ada data wilayah pada rentang waktu ini
              </div>
            ) : (
              <div className="space-y-4">
                {summary.regionCounts.slice(0, 5).map((item, idx) => {
                  const maxCount = summary.regionCounts[0]?.count || 1;
                  const ratio = (item.count / maxCount) * 100;
                  const totalRatio = summary.panelCount > 0 ? (item.count / summary.panelCount) * 100 : 0;

                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-sans font-medium text-gray-300 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded bg-gray-900 flex items-center justify-center text-[9px] font-mono font-bold text-purple-400">
                            {idx + 1}
                          </span>
                          {item.region}
                        </span>
                        <span className="font-mono text-gray-400 font-bold">
                          {item.count} <span className="text-[10px] text-gray-500">Panel ({totalRatio.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="w-full bg-gray-950 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${ratio}%` }}
                          transition={{ duration: 0.6 }}
                          className="bg-purple-500 h-1.5 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-900 text-[10px] text-gray-500 font-mono flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-yellow-500" />
            <span>Peringkat kontribusi pasar dihitung dari jumlah panel.</span>
          </div>
        </div>

      </div>

      {/* Bagian Bawah: Analisis Struktur Biaya Dan Kontraktor Jasa */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Cost Structure Breakdown (Expenses Distribution) */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative ">
          <h4 className="text-xs font-bold text-gray-200 uppercase font-mono tracking-wider mb-4 flex items-center gap-1.5">
            <Percent className="w-4 h-4 text-orange-400" /> Distribusi Proporsi Pengeluaran Bengkel
          </h4>

          {summary.expenses === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-gray-500 font-mono">
              Tidak ada pengeluaran terdeteksi
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: "Pembelian Suku Cadang (HPP Parts)", value: summary.hppPartMaterial, color: "bg-orange-500" },
                { label: "Bahan Cat & Material Ruko (Expenses Bahan)", value: summary.expensesBahan, color: "bg-amber-500" },
                { label: "Jasa Pekerjaan Subkont Luar (SPKL)", value: summary.spkl, color: "bg-purple-500" },
              ].map((item, idx) => {
                const ratio = (item.value / summary.expenses) * 100;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-gray-400 flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded ${item.color}`} />
                        {item.label}
                      </span>
                      <span className="text-gray-200 font-bold">
                        {formatIDR(item.value)} <span className="text-gray-500 text-[10px]">({ratio.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-950 h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color}`} style={{ width: `${ratio}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Insurance Workload Share */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative ">
          <h4 className="text-xs font-bold text-gray-200 uppercase font-mono tracking-wider mb-4 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-400" /> Share Portofolio Asuransi Mitra
          </h4>

          {insuranceStats.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-gray-500 font-mono">
              Tidak ada asuransi yang terekam
            </div>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {insuranceStats.slice(0, 5).map((as, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-950/40 p-2 rounded border border-gray-900/50">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded bg-indigo-500" />
                    <span className="text-xs text-gray-300 font-medium">{as.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-gray-200 font-bold">{as.panels} <span className="text-[10px] text-gray-400">Panels</span></p>
                    <p className="text-[9px] font-mono text-gray-500">Mewakili {as.share.toFixed(1)}% volume</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
