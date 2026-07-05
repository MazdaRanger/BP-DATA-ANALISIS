/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { BodyRepairRecord, MetricSummary, ComparativeMatrix } from "../types";
import { filterAndSummarize, generateComparativeMatrix, getMonthName } from "../lib/calculations";
import Dashboard from "../components/Dashboard";
import AnalysisPanel from "../components/AnalysisPanel";
import UploadManager from "../components/UploadManager";
import SettingsPanel from "../components/SettingsPanel";
import DataManager from "../components/DataManager";
import KanbanBoard from "../components/KanbanBoard";
import { Grid, BrainCircuit, UploadCloud, RefreshCw, BarChart4, Mail, LogOut, Settings, Calendar, DatabaseBackup, LayoutDashboard } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../lib/firebaseConfig.js";

export default function System() {
  const { user, role, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "analysis" | "upload" | "settings" | "data_manager" | "kanban">("dashboard");
  const [records, setRecords] = useState<BodyRepairRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorHeader, setErrorHeader] = useState("");

  // Filters State
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1); // 1-indexed
  const [activeWeek, setActiveWeek] = useState<number | "ALL">("ALL");

  // Fetch records from Client Side Firebase instead of Backend
  const fetchRecords = async () => {
    setLoading(true);
    setErrorHeader("");
    try {
      const snap = await getDocs(collection(db, "body_repair_records"));
      // Normalize data: handle both camelCase (frontend writes) and snake_case (server writes)
      const data = snap.docs.map(docSnap => {
        const raw = docSnap.data();
        return {
          id: raw.id || docSnap.id,
          tanggal: raw.tanggal,
          week: Number(raw.week),
          noSpk: raw.noSpk || raw.no_spk || '',
          asuransi: raw.asuransi || '',
          jasaNett: Number(raw.jasaNett ?? raw.jasa_nett ?? 0),
          partMaterialNett: Number(raw.partMaterialNett ?? raw.part_material_nett ?? 0),
          expensesBahan: Number(raw.expensesBahan ?? raw.expenses_bahan ?? 0),
          hppPartMaterial: Number(raw.hppPartMaterial ?? raw.hpp_part_material ?? 0),
          spkl: Number(raw.spkl ?? 0),
          jumlahPanel: Number(raw.jumlahPanel ?? raw.jumlah_panel ?? 1),
          wilayah: raw.wilayah || '',
        } as BodyRepairRecord;
      });
      // Sort desc by tanggal
      data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setRecords(data);
      if (data.length > 0) {
        const latestRecord = data[0];
        const rDate = new Date(latestRecord.tanggal);
        if (!isNaN(rDate.getTime())) {
          setSelectedYear(rDate.getFullYear());
          setSelectedMonth(rDate.getMonth() + 1);
        }
      }
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
      const seedRecords: Partial<BodyRepairRecord>[] = [];
      const asuransiList = ["Sinar Mas", "Garda Oto", "Adira", "Personal", "Tokio Marine"];
      const wilayahList = ["DKI Jakarta", "Jawa Barat", "Banten", "Jawa Tengah", "Jawa Timur"];
      
      for (let i = 0; i < 60; i++) {
         const mOffset = Math.floor(Math.random() * 3); // 0, 1, 2
         const day = Math.floor(Math.random() * 28) + 1;
         const d = new Date(2026, 6 - mOffset - 1, day); // 4-5-6 months
         
         let week = 1;
         if (day > 7) week = 2;
         if (day > 14) week = 3;
         if (day > 21) week = 4;
         if (day > 28) week = 5;
         
         const isPersonal = Math.random() > 0.8;
         const baseJasa = 500000 + (Math.random() * 1500000);
         const parts = baseJasa * 0.4;
         const expenses = baseJasa * 0.15;
         const hpp = parts * 0.8;

         seedRecords.push({
            id: `SEED-${Date.now()}-${i}`,
            tanggal: d.toISOString().split("T")[0],
            week,
            noSpk: `SPK-DEMO-${Math.floor(Math.random()*9000)+1000}`,
            asuransi: isPersonal ? "Personal" : asuransiList[Math.floor(Math.random() * asuransiList.length)],
            jasaNett: Math.round(baseJasa),
            partMaterialNett: Math.round(parts),
            expensesBahan: Math.round(expenses),
            hppPartMaterial: Math.round(hpp),
            spkl: Math.round(baseJasa * (Math.random() > 0.5 ? 0 : 0.05)),
            jumlahPanel: Math.floor(Math.random() * 5) + 1,
            wilayah: wilayahList[Math.floor(Math.random() * wilayahList.length)]
         });
      }

      // Overwrite db
      const existingSnap = await getDocs(collection(db, "body_repair_records"));
      const batchClear = writeBatch(db);
      existingSnap.docs.forEach((docSnap) => batchClear.delete(docSnap.ref));
      await batchClear.commit().catch(e => console.warn("Clear database failed", e));

      // Batch insert logic using chunking
      const chunkSize = 400;
      for (let i = 0; i < seedRecords.length; i += chunkSize) {
        const batchInsert = writeBatch(db);
         const chunk = seedRecords.slice(i, i + chunkSize);
        chunk.forEach(record => {
           const docRef = doc(db, "body_repair_records", record.id as string);
           // Write as snake_case to comply with Firestore Rules validation
           batchInsert.set(docRef, {
             id: record.id,
             tanggal: record.tanggal,
             week: record.week,
             no_spk: record.noSpk,
             asuransi: record.asuransi,
             jasa_nett: record.jasaNett,
             part_material_nett: record.partMaterialNett,
             expenses_bahan: record.expensesBahan,
             hpp_part_material: record.hppPartMaterial,
             spkl: record.spkl,
             jumlah_panel: record.jumlahPanel,
             wilayah: record.wilayah,
           });
        });
        await batchInsert.commit();
      }

      await fetchRecords();
      setSelectedYear(2026);
      setSelectedMonth(6);
      setActiveWeek("ALL");
    } catch (e: any) {
      console.error(e);
      setErrorHeader("Gagal mamuat ulang demo seed: " + e.message);
      await fetchRecords();
    } finally {
      setLoading(false);
    }
  };

  // Calculate distinct available Years & Months in the dataset to drive dropdowns dynamically
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();
    const startYear = 2020;
    // Provide a generous buffer of 20 years into the future
    const endYear = Math.max(currentYear + 20, 2045);
    for (let y = startYear; y <= endYear; y++) {
      years.add(y);
    }
    for (const r of records) {
      const d = new Date(r.tanggal);
      if (!isNaN(d.getTime())) {
        years.add(d.getFullYear());
      }
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [records]);

  const availableMonths = useMemo(() => {
    // Return all 12 months (Januari s.d. Desember) to support full year range selection
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }, []);

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
        share: totalPanels > 0 ? (panels / totalPanels) * 100 : 0
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

  const navTabs = [
    { id: "dashboard", label: "Dashboard", icon: Grid },
    { id: "kanban", label: "Kanban Outstanding", icon: LayoutDashboard },
    { id: "analysis", label: "Analisis Masalah", icon: BrainCircuit },
    { id: "upload", label: "Unggah Database", icon: UploadCloud },
    { id: "data_manager", label: "Manajemen Data", icon: DatabaseBackup }
  ];

  if (role === 'super_admin') {
    navTabs.push({ id: "settings", label: "Pengaturan", icon: Settings });
  }

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
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1 bg-[#111111] p-1 rounded-lg border border-[#222]">
            {navTabs.map((tab) => {
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

          <button 
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-md transition"
          >
             <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </nav>

      {/* Primary Container Wrap */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:px-8 space-y-6">
        
        {/* Mobile Nav Fallback */}
        <div className="md:hidden flex flex-wrap items-center gap-1 bg-[#111111] p-1 rounded-lg border border-[#222]">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  type="button"
                  id={`nav-tab-${tab.id}-mobile`}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] transition font-bold cursor-pointer flex-1 justify-center ${
                    active 
                      ? "bg-[#171717] text-white border border-[#262626]" 
                      : "text-gray-400 hover:text-white hover:bg-[#171717]"
                  }`}
                >
                  <Icon className={`w-3 h-3 ${active ? "text-indigo-400" : "text-gray-500"}`} />
                  {tab.label}
                </button>
              );
            })}
        </div>

        
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
                onDatabaseChanged={fetchRecords}
                currentCount={records.length}
              />
            )}

            {activeTab === "settings" && <SettingsPanel onDatabaseChanged={fetchRecords} />}

            {activeTab === "data_manager" && <DataManager />}

            {activeTab === "kanban" && <KanbanBoard />}
          </div>
        )}

      </main>

      {/* Cyber footer info bar */}
      <footer className="mt-12 py-6 border-t border-[#262626] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-gray-500 text-[10px] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p>© 2026 PT Auto Repair Analitika Prima. All rights reserved.</p>
            <p className="text-gray-600 mt-0.5">Struktur database menggunakan Firebase Cloud Firestore (NoSQL).</p>
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
