/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { BodyRepairRecord, MetricSummary, ComparativeMatrix } from "./types.js";
import { filterAndSummarize, generateComparativeMatrix, getMonthName } from "./lib/calculations.js";
import Dashboard from "./components/Dashboard.js";
import AnalysisPanel from "./components/AnalysisPanel.js";
import UploadManager from "./components/UploadManager.js";
import SettingsPanel from "./components/SettingsPanel.js";
import { Grid, BrainCircuit, UploadCloud, RefreshCw, BarChart4, Mail, Milestone, HelpCircle, Calendar, Sparkles, Settings } from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "analysis" | "upload" | "settings">("dashboard");
  const [records, setRecords] = useState<BodyRepairRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorHeader, setErrorHeader] = useState("");

  // Filters State
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(6); // Default: Juni
  const [activeWeek, setActiveWeek] = useState<number | "ALL">("ALL");

  // Fetch records from Express backend
  const fetchRecords = async () => {
    setLoading(true);
    setErrorHeader("");
    try {
      const res = await fetch("/api/records");
      if (!res.ok) throw new Error("Gagal mengunduh records dari backend");
      const data = await res.json();
      setRecords(data);
    } catch (err: any) {
      console.error(err);
      setErrorHeader(err.message || "Gagal tersambung ke server database memori.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Sync state after successful upload of manual files
  const handleDataLoaded = (newRecords: BodyRepairRecord[], message: string) => {
    setRecords(newRecords);
    
    // Automatically extract maximum year and month from uploaded data to focus on
    if (newRecords.length > 0) {
      const dates = newRecords.map(r => new Date(r.tanggal));
      const maximumDate = new Date(Math.max(...dates.map(d => d.getTime())));
      if (!isNaN(maximumDate.getTime())) {
        setSelectedYear(maximumDate.getFullYear());
        setSelectedMonth(maximumDate.getMonth() + 1);
        setActiveWeek("ALL");
      }
    }
    setActiveTab("dashboard");
  };

  const handleResetToSeed = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/records/reset", { method: "POST" });
      const data = await res.json();
      if (data.records && Array.isArray(data.records)) {
        setRecords(data.records);
      } else {
        await fetchRecords();
      }
      setSelectedYear(2026);
      setSelectedMonth(6);
      setActiveWeek("ALL");
    } catch (e) {
      console.error(e);
      await fetchRecords();
    } finally {
      setLoading(false);
    }
  };

  // Calculate distinct available Years & Months in the dataset to drive dropdowns dynamically
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const r of records) {
      const d = new Date(r.tanggal);
      if (!isNaN(d.getTime())) {
        years.add(d.getFullYear());
      }
    }
    return years.size > 0 ? Array.from(years).sort((a, b) => b - a) : [2026, 2025];
  }, [records]);

  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    for (const r of records) {
      const d = new Date(r.tanggal);
      if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear) {
        months.add(d.getMonth() + 1); // 1-indexed
      }
    }
    const sorted = Array.from(months).sort((a, b) => a - b);
    return sorted.length > 0 ? sorted : [4, 5, 6]; // default April, Mei, Juni
  }, [records, selectedYear]);

  // Compute stats based on chosen filter parameters
  const currentStats = useMemo(() => {
    return filterAndSummarize(records, selectedYear, selectedMonth, activeWeek);
  }, [records, selectedYear, selectedMonth, activeWeek]);

  // Compute comparative M2M matching stats (Previous month, same year & week)
  const m2mStats = useMemo(() => {
    if (selectedMonth === 0) return null; // No previous month in "All Months" scenario
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    return filterAndSummarize(records, prevYear, prevMonth, activeWeek);
  }, [records, selectedYear, selectedMonth, activeWeek]);

  // Compute comparative Y2Y matching stats (Same Month, Previous Year & matching Week)
  const y2yStats = useMemo(() => {
    return filterAndSummarize(records, selectedYear - 1, selectedMonth, activeWeek);
  }, [records, selectedYear, selectedMonth, activeWeek]);

  const m2mComparisonMatrix = useMemo(() => {
    if (!m2mStats) return null;
    return generateComparativeMatrix(currentStats, m2mStats);
  }, [currentStats, m2mStats]);

  const y2yComparisonMatrix = useMemo(() => {
    if (!y2yStats) return null;
    return generateComparativeMatrix(currentStats, y2yStats);
  }, [currentStats, y2yStats]);

  // Calculate Weekly trend elements for the selected Month
  const weeklyTrend = useMemo(() => {
    const weeks = [1, 2, 3, 4, 5];
    return weeks.map((w) => {
      const wSummary = filterAndSummarize(records, selectedYear, selectedMonth, w);
      return {
        week: `Week ${w}`,
        revenue: wSummary.revenue,
        cost: wSummary.expenses,
        profit: wSummary.grossProfit
      };
    });
  }, [records, selectedYear, selectedMonth]);

  // Calculate insurance stats for the active filter parameters
  const insuranceStats = useMemo(() => {
    // Collect and aggregate
    const insLookup: Record<string, number> = {};
    const filtered = records.filter((r) => {
      const d = new Date(r.tanggal);
      const mMatch = selectedMonth === 0 ? true : (d.getMonth() + 1) === selectedMonth;
      return d.getFullYear() === selectedYear && mMatch && (activeWeek === "ALL" ? true : r.week === activeWeek);
    });

    for (const r of filtered) {
      if (r.asuransi) {
        insLookup[r.asuransi] = (insLookup[r.asuransi] || 0) + r.jumlahPanel;
      }
    }

    const totalPanels = filtered.reduce((acc, cr) => acc + cr.jumlahPanel, 0);

    return Object.entries(insLookup)
      .map(([name, panels]) => ({
        name,
        panels,
        share: totalPanels > 0 ? (panels / totalPanels) * 105 : 0
      }))
      .sort((a, b) => b.panels - a.panels);
  }, [records, selectedYear, selectedMonth, activeWeek]);

  // Current active records filtered list
  const activeFilteredRecordsList = useMemo(() => {
    return records.filter((r) => {
      const rDate = new Date(r.tanggal);
      const matchYear = rDate.getFullYear() === selectedYear;
      const matchMonth = selectedMonth === 0 ? true : (rDate.getMonth() + 1) === selectedMonth;
      const matchWeek = activeWeek === "ALL" ? true : r.week === activeWeek;
      return matchYear && matchMonth && matchWeek;
    });
  }, [records, selectedYear, selectedMonth, activeWeek]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Banner Header Nav */}
      <nav id="navbar-top" className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#262626] px-4 py-3 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.4)]">
            <BarChart4 className="w-5 h-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-white font-sans font-bold text-xl italic tracking-tight flex items-center gap-2">
              BodyRepair.AI
              <span className="text-[10px] not-italic bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20">Production-Core</span>
            </h1>
          </div>
        </div>

        {/* Outer Tab Navigations */}
        <div className="flex items-center gap-1 bg-[#111111] p-1 rounded-lg border border-[#222]">
          {[
            { id: "dashboard", label: "Dashboard", icon: Grid },
            { id: "analysis", label: "Analisis Masalah", icon: BrainCircuit },
            { id: "upload", label: "Unggah Database", icon: UploadCloud },
            { id: "settings", label: "Pengaturan", icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                type="button"
                id={`nav-tab-${tab.id}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition font-bold cursor-pointer ${
                  active 
                    ? "bg-[#171717] text-white border border-[#262626]" 
                    : "text-gray-400 hover:text-white hover:bg-[#171717]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-indigo-400" : "text-gray-500"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Primary Container Wrap */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:px-8 space-y-6">
        
        {errorHeader && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg text-xs flex items-center gap-2">
            <span>[Koneksi Bermasalah]: {errorHeader}</span>
          </div>
        )}

        {/* Filter Toolbar Area */}
        <div className="bg-[#111111] p-4 rounded-xl border border-[#222] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-[#1a1a1a] border border-[#262626] text-gray-400"><Calendar className="w-4 h-4 text-indigo-400" /></span>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-widest font-sans">Timeframe Penilaian Data</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Analisis diolah backend berdasarkan pilihan di bawah</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            {/* Year selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none">Limit Tahun</label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  setActiveWeek("ALL");
                }}
                id="select-year-filter"
                className="bg-[#1a1a1a] border border-[#262626] rounded-md px-3 py-1 text-xs text-gray-200 outline-none focus:border-indigo-500 cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Month selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none">Pilihan Bulan</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(Number(e.target.value));
                  setActiveWeek("ALL");
                }}
                id="select-month-filter"
                className="bg-[#1a1a1a] border border-[#262626] rounded-md px-3 py-1 text-xs text-gray-200 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value={0}>Semua Bulan (Kumulatif)</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{getMonthName(m)}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchRecords}
              type="button"
              id="btn-sync-server"
              className="px-3 py-1.5 text-xs rounded-md border border-[#262626] hover:bg-[#171717] bg-[#1a1a1a] text-gray-400 hover:text-white transition duration-150 self-end"
              title="Sinkronisasi dengan Server Cloud Database"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

          </div>

        </div>

        {/* Content Tabs Switch */}
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center space-y-3 bg-[#111111]/40 rounded-xl border border-[#222] p-8">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Menghubungkan data dengan basis data memori backend...</p>
          </div>
        ) : (
          <div>
            {activeTab === "dashboard" && (
              <Dashboard
                summary={currentStats}
                m2m={m2mComparisonMatrix}
                y2y={y2yComparisonMatrix}
                weeklyTrend={weeklyTrend}
                insuranceStats={insuranceStats}
                activeWeek={activeWeek}
                setActiveWeek={setActiveWeek}
                activeMonthName={selectedMonth === 0 ? "Akumulatif" : getMonthName(selectedMonth)}
                activeYear={selectedYear}
              />
            )}

            {activeTab === "analysis" && (
              <AnalysisPanel
                filteredRecords={activeFilteredRecordsList}
                activeMonthName={selectedMonth === 0 ? "Akumulatif" : getMonthName(selectedMonth)}
                activeYear={selectedYear}
              />
            )}

            {activeTab === "upload" && (
              <UploadManager
                onDataLoaded={handleDataLoaded}
                onReset={handleResetToSeed}
                currentCount={records.length}
              />
            )}

            {activeTab === "settings" && <SettingsPanel onDatabaseChanged={fetchRecords} />}
          </div>
        )}

      </main>

      {/* Cyber footer info bar */}
      <footer className="mt-12 py-6 border-t border-[#262626] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-gray-500 text-[10px] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p>© 2026 PT Auto Repair Analitika Prima. All rights reserved.</p>
            <p className="text-gray-600 mt-0.5">Struktur database terstandar Supabase Client CLI & skema SQL migrasi terlampir.</p>
          </div>
          <div className="flex items-center gap-4 text-gray-400">
            <a href="mailto:hendrik.mazdatransyogi@gmail.com" className="hover:text-indigo-400 transition flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-500" /> hendrik.mazdatransyogi@gmail.com
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
