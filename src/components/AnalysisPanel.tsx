/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { BodyRepairRecord, ProblemAnalysisResponse, LogicTreeNode, AlternativeSolution } from "../types";
import { BrainCircuit, GitFork, BarChart3, Grid3X3, ArrowRight, CheckSquare, Sparkles, RefreshCw, Layers, ShieldCheck, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AnalysisPanelProps {
  filteredRecords: BodyRepairRecord[];
  activeMonthName: string;
  activeYear: number;
}

export default function AnalysisPanel({ filteredRecords, activeMonthName, activeYear }: AnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<ProblemAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"tree" | "pareto" | "matrix">("tree");
  const [errorMsg, setErrorMsg] = useState("");

  const triggerAnalysis = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filteredRecords })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membangun analisis");
      
      setAnalysis(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membangun solver analisis bertenaga backend.");
    } finally {
      setLoading(false);
    }
  };

  // Run analysis when filteredRecords change
  useEffect(() => {
    triggerAnalysis();
  }, [filteredRecords]);

  if (loading && !analysis) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-3 bg-[#111111] border border-[#222] rounded-xl p-8">
        <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        <p className="text-sm font-mono text-gray-300">Menjalankan Algoritma Pohon Logika, Pareto, & Matriks Solusi secara Backend...</p>
        <p className="text-xs text-gray-500">Mengkonsolidasikan data {filteredRecords.length} SPK yang terpilih...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-6 bg-[#111111] border border-[#222] border border-red-500/20 rounded-xl space-y-4">
        <p className="text-xs font-mono text-red-400">Error: {errorMsg}</p>
        <button
          onClick={triggerAnalysis}
          className="px-4 py-2 bg-gray-900 border border-gray-700 hover:bg-gray-800 rounded-lg text-xs font-mono cursor-pointer"
        >
          Coba Muat Ulang Analisis
        </button>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-6">
      
      {/* Overview Header */}
      <div className="bg-gradient-to-br from-[#0c0f16] to-[#040609] p-4 rounded-xl border border-indigo-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20">
              <BrainCircuit className="w-5 h-5 text-indigo-400 animate-pulse" />
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">Solver Analisis Masalah Body Repair</h3>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed font-mono">
            Memecah kontribusi keuangan dan operasional SPK ({activeMonthName} {activeYear}) menggunakan tiga kerangka kerja matematika backend.
          </p>
        </div>

        <button
          onClick={triggerAnalysis}
          type="button"
          disabled={loading}
          id="btn-recalculate-analysis"
          className="px-4 py-1.5 rounded bg-gray-900 border border-gray-700 hover:bg-gray-800 text-gray-200 hover:text-white transition text-xs font-mono flex items-center gap-1.5 cursor-pointer"
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
          Lakukan AI Recache & Hitung Ulang
        </button>
      </div>

      {/* Main Problem Statement and Root Causes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Masalah Utama */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  md:col-span-1">
          <span className="px-2 py-0.5 rounded bg-red-950/60 border border-red-600/30 text-red-400 text-[10px] font-mono leading-none font-bold uppercase">
            Identifikasi Masalah Utama
          </span>
          <h4 className="text-sm font-semibold text-gray-200 font-sans mt-3">Rangkuman Profitabilitas & Margin</h4>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            {analysis.problemStatement}
          </p>
        </div>

        {/* Card 2: Akar Masalah (Root Causes) */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  md:col-span-2 space-y-1">
          <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-600/30 text-amber-400 text-[10px] font-mono leading-none font-semibold uppercase">
            Akar Masalah (Root-Causes) Terdeteksi
          </span>
          <h4 className="text-sm font-semibold text-gray-200 font-sans mt-2">Penyebab kebocoran profit / hambatan:</h4>
          <ul className="text-xs text-gray-400 mt-1.5 space-y-2">
            {analysis.rootCauses.map((rc, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                <span>{rc}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Tiga Tab Matrik Analisis */}
      <div className="space-y-4">
        
        <div className="flex border-b border-gray-850">
          {[
            { id: "tree", label: "Diagram Pohon Logika", icon: GitFork },
            { id: "pareto", label: "Analisis Pareto 80/20", icon: BarChart3 },
            { id: "matrix", label: "Matriks Kuantitatif Alternatif", icon: Grid3X3 },
          ].map((tab) => {
            const IconComp = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                type="button"
                id={`tab-btn-${tab.id}`}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold border-b-2 cursor-pointer transition ${
                  active 
                    ? "border-indigo-500 text-white bg-gray-900/30" 
                    : "border-transparent text-gray-500 hover:text-white"
                }`}
              >
                <IconComp className={`w-4 h-4 ${active ? "text-indigo-400" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6 bg-[#07080a] rounded-xl relative">
          
          {/* Sub TAB: Pohon Logika */}
          {activeTab === "tree" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-300 font-mono flex items-center gap-1.5 uppercase">
                  Pohon Logika Dekomposisi Profitabilitas & Beban Operasional
                </h4>
                <span className="text-[10px] text-gray-500 font-mono">Pola Dekomposisi Sistematis (MECE)</span>
              </div>

              {/* Graphical Logical Tree Layout directly calculated */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative font-sans">
                
                {/* Level 1: Root Problem */}
                <div className="flex flex-col justify-center">
                  <div className="p-3 bg-gray-950 rounded-lg space-y-1 z-10 relative shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                    <p className="text-[10px] text-gray-500 font-mono font-bold uppercase tracking-wider">Root Objective</p>
                    <h5 className="text-xs font-semibold text-white">{analysis.logicTree.label}</h5>
                    <p className="text-indigo-400 font-bold text-xs font-mono">{analysis.logicTree.value}</p>
                    <p className="text-[9px] text-gray-500 font-mono leading-relaxed">{analysis.logicTree.details}</p>
                  </div>
                </div>

                {/* Level 2 & 3: Children Branches mapped dynamically */}
                <div className="md:col-span-2 space-y-4">
                  {analysis.logicTree.children?.map((child, cIdx) => (
                    <div key={child.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-gray-950/30 p-2.5 rounded-lg border border-gray-900">
                      
                      {/* Intermediate Node */}
                      <div className="p-3 bg-gray-950 border border-indigo-500/10 rounded-md space-y-1 relative">
                        <p className="text-[9px] text-gray-500 font-mono font-bold uppercase tracking-wider">Fungsi Strategis</p>
                        <h5 className="text-[11px] font-semibold text-gray-200">{child.label}</h5>
                        <p className="text-gray-300 font-bold text-xs font-mono">{child.value}</p>
                        <p className="text-[9px] text-gray-500 font-mono">{child.details}</p>
                      </div>

                      {/* Leaf Nodes */}
                      <div className="space-y-1.5 sm:border-l sm:border-gray-900 sm:pl-4">
                        {child.children?.map((leaf) => (
                          <div key={leaf.id} className="p-2 bg-gray-950/70 border border-gray-900 rounded font-mono text-[9px] space-y-0.5">
                            <p className="text-[10px] text-gray-400 truncate" title={leaf.label}>{leaf.label}</p>
                            <p className="text-gray-300 font-semibold">{leaf.value || "Dynamic Value"}</p>
                            {leaf.details && <p className="text-gray-600 text-[8px] leading-tight">{leaf.details}</p>}
                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            </motion.div>
          )}

          {/* Sub TAB: Pareto */}
          {activeTab === "pareto" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-300 font-mono uppercase tracking-wide">
                    Grafik Pareto 80/20 Distribusi Beban Sektor Bengkel
                  </h4>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">Menemukan "Vital Few" (Sektor 80% biaya terbanyak)</p>
                </div>
              </div>

              {/* Custom SVG Pareto Graph */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                
                {/* Visual SVG Chart */}
                <div className="md:col-span-3 h-52 relative flex flex-col justify-end pt-4">
                  <svg className="w-full h-40 overflow-visible" preserveAspectRatio="none">
                    {/* Gridlines */}
                    <line x1="0" y1="20%" x2="100%" y2="20%" stroke="#1f1f2e" strokeDasharray="3" />
                    <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#1f1f2e" strokeDasharray="3" />
                    <line x1="0" y1="80%" x2="100%" y2="80%" stroke="#1f1f2e" strokeDasharray="3" />
                    
                    {/* Pareto Bars & Cumulative Line calculations */}
                    {(() => {
                      const maxVal = Math.max(...analysis.paretoData.map(p => p.value)) || 1;
                      const count = analysis.paretoData.length || 1;
                      const stepX = 100 / count;
                      const barWidth = Math.max(10, stepX * 0.5);

                      // Path points for cumulative line
                      const linePoints = analysis.paretoData.map((p, idx) => {
                        const x = (idx * stepX) + (stepX * 0.5);
                        // scale 0-100% directly to 0-100% of height (invert)
                        const y = 100 - p.cumulativePercentage;
                        return `${x}%,${y}%`;
                      }).join(" ");

                      return (
                        <>
                          {/* Cumulative Line */}
                          <polyline points={linePoints} fill="none" stroke="#eab308" strokeWidth="2" />
                          
                          {/* Render Bars */}
                          {analysis.paretoData.map((p, idx) => {
                            const barHeight = (p.value / maxVal) * 85; // cap at 85% peak height
                            const x = (idx * stepX) + (stepX * 0.5);
                            const isVitalVal = p.isVital;

                            return (
                              <g key={idx}>
                                {/* Bar */}
                                <rect
                                  x={`${x - barWidth / 2}%`}
                                  y={`${100 - barHeight}%`}
                                  width={`${barWidth}%`}
                                  height={`${barHeight}%`}
                                  fill={isVitalVal ? "#ef4444" : "#3f3f46"}
                                  opacity={isVitalVal ? "0.8" : "0.5"}
                                  rx="2"
                                />

                                {/* Vertex bubble on line */}
                                <circle
                                  cx={`${x}%`}
                                  cy={`${100 - p.cumulativePercentage}%`}
                                  r="4"
                                  fill="#eab308"
                                  stroke="#020205"
                                  strokeWidth="1.5"
                                />
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>

                  {/* Labels Bottom */}
                  <div className="flex items-center justify-between border-t border-gray-900 pt-2 font-mono text-[9px] text-gray-500">
                    {analysis.paretoData.map((p, idx) => (
                      <span key={idx} className="truncate select-none text-center" style={{ width: `${100 / analysis.paretoData.length}%` }}>
                        {p.category.split(" ")[0]}
                        <span className="block text-[8px] text-yellow-500 mt-0.5">{p.cumulativePercentage}%</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Legend Context */}
                <div className="md:col-span-1 space-y-3 font-mono text-[10px]">
                  <div className="p-3 rounded-lg bg-gray-950 border border-gray-900">
                    <p className="text-gray-400 font-bold mb-2">Pemberitahuan Pareto:</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 rounded-full h-4 bg-red-500" />
                        <div>
                          <p className="text-red-400 font-bold">Vital Few (80%):</p>
                          <p className="text-[9px] text-gray-500">20% faktor yang menyebabkan 80% kebocoran dana.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 rounded-full h-4 bg-gray-600" />
                        <div>
                          <p className="text-gray-400">Useful Many (20%):</p>
                          <p className="text-[9px] text-gray-500">Faktor minor yang tidak bernilai prioritas tinggi.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* Sub TAB: Matriks Perbandingan */}
          {activeTab === "matrix" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-300 font-mono uppercase">
                  Matriks Perbandingan Kuantitatif & Pembobotan Alternatif Kombinasi Solusi Terbaik
                </h4>
                <div className="flex gap-1.5 text-[8px] font-mono text-gray-500">
                  <span>Bobot Kriteria:</span>
                  <span className="text-indigo-400">Impact (35%)</span>
                  <span>•</span>
                  <span className="text-indigo-400">Cost (25%)</span>
                  <span>•</span>
                  <span className="text-indigo-400">Feas. (20%)</span>
                  <span>•</span>
                  <span className="text-indigo-400">Speed (20%)</span>
                </div>
              </div>

              {/* Table Matrix */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 font-semibold text-[10px]">
                      <th className="py-2.5 px-3">Alternatif Formulasi Solusi</th>
                      <th className="py-2.5 px-3 text-center">Impact (35%)</th>
                      <th className="py-2.5 px-3 text-center">Cost (25%)</th>
                      <th className="py-2.5 px-3 text-center">Feas. (20%)</th>
                      <th className="py-2.5 px-3 text-center">Speed (20%)</th>
                      <th className="py-2.5 px-3 text-right text-indigo-400 font-bold">Weighted Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.matrix.alternatives.map((alt) => {
                      const isBestVal = alt.id === analysis.recommendedSolution.id;
                      return (
                        <tr
                          key={alt.id}
                          className={`border-b border-gray-900/60 hover:bg-gray-900/10 transition ${
                            isBestVal ? "bg-indigo-500/5 text-white" : "text-gray-400"
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              {isBestVal && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                              <div>
                                <p className="font-sans font-semibold text-gray-200">{alt.name}</p>
                                <p className="text-[10px] text-gray-500 font-sans mt-0.5 leading-relaxed">{alt.description}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center text-gray-300">{alt.scores.impact}/10</td>
                          <td className="py-3 px-3 text-center text-gray-300">{alt.scores.cost}/10</td>
                          <td className="py-3 px-3 text-center text-gray-300">{alt.scores.feasibility}/10</td>
                          <td className="py-3 px-3 text-center text-gray-300">{alt.scores.speed}/10</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              isBestVal ? "bg-indigo-950/80 border border-indigo-500/30 text-indigo-400" : "text-gray-400"
                            }`}>
                              {alt.totalWeightedScore.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* Recommended Solution and Action Steps */}
      <div className="bg-[#0b0c10] p-6 rounded-xl relative  overflow-hidden">
        
        {/* Background highlight pattern */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative font-sans">
          
          {/* Solution Body */}
          <div className="space-y-4 md:w-3/5">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center p-1.5 rounded bg-indigo-950/60 border border-indigo-600/30 text-indigo-400 font-mono text-[10px] uppercase font-bold tracking-widest">
                Rekomendasi Solusi Terbaik (Skor Tertinggi)
              </span>
            </div>
            
            <h4 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              {analysis.recommendedSolution.name}
            </h4>
            
            <p className="text-gray-450 text-xs leading-relaxed">
              {analysis.recommendedSolution.description}
            </p>
          </div>

          {/* Action List Section */}
          <div className="md:w-2/5 p-4 rounded-xl bg-gray-950 border border-gray-900 space-y-3 font-mono text-xs">
            <h5 className="font-bold text-gray-200 uppercase tracking-wide flex items-center gap-1 text-[11px]">
              <CheckSquare className="w-4 h-4 text-indigo-400" /> Aksi Yang Harus Dilakukan (Action Plan)
            </h5>
            <div className="space-y-2 pt-2">
              {analysis.recommendedSolution.actionPlan.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 text-gray-400 leading-relaxed text-[11px]">
                  <span className="p-0.5 rounded bg-indigo-950 border border-indigo-500/20 text-indigo-400 text-[10px] w-5 h-5 flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-sans text-xs text-gray-300 mt-0.5">{step}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
