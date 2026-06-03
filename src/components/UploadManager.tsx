/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, File, RefreshCw, CheckCircle2, FileText, AlertTriangle, Play, HelpCircle } from "lucide-react";
import { BodyRepairRecord } from "../types.js";
import { motion } from "motion/react";

interface UploadManagerProps {
  onDataLoaded: (records: BodyRepairRecord[], message: string) => void;
  onReset: () => Promise<void>;
  currentCount: number;
}

interface ParsedFile {
  name: string;
  type: "gross-profit" | "panels-insurance" | "regions";
  rowsCount: number;
  data: any[];
}

export default function UploadManager({ onDataLoaded, onReset, currentCount }: UploadManagerProps) {
  const [parsedFiles, setParsedFiles] = useState<Record<string, ParsedFile>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "gross-profit" | "panels-insurance" | "regions") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bser = evt.target?.result;
        const workbook = XLSX.read(bser, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        setParsedFiles((prev) => ({
          ...prev,
          [type]: {
            name: file.name,
            type,
            rowsCount: jsonData.length,
            data: jsonData,
          },
        }));

        setSuccessMsg(`Berhasil membaca file ${file.name} (${jsonData.length} baris data ditemukan).`);
      } catch (err: any) {
        setErrorMsg(`Gagal memuat file Excel: ${err.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Merge the sheets by No SPK to form clean BodyRepairRecord list
  const handleMergeAndSave = async () => {
    setIsProcessing(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const gpFile = parsedFiles["gross-profit"];
      const piFile = parsedFiles["panels-insurance"];
      const regFile = parsedFiles["regions"];

      if (!gpFile) {
        throw new Error("Anda wajib mengunggah minimal data Perhitungan Gross Profit.");
      }

      // Merge records
      const mergedList: BodyRepairRecord[] = gpFile.data.map((gpRow: any, idx: number) => {
        // Attempt to find SPK
        const spkKey = Object.keys(gpRow).find(k => k.toLowerCase().replace(/[\s._-]/g, "") === "nospk") || "No SPK";
        const noSpk = String(gpRow[spkKey] || `SPK-UPL-${1000 + idx}`).trim();

        // Find insurance details in panels sheet (if provided)
        let asuransi = "Personal (Umum)";
        let jumlahPanel = 1;
        if (piFile) {
          const match = piFile.data.find((piRow: any) => {
            const piSpkKey = Object.keys(piRow).find(k => k.toLowerCase().replace(/[\s._-]/g, "") === "nospk") || "No SPK";
            return String(piRow[piSpkKey]).trim() === noSpk;
          });
          if (match) {
            const insKey = Object.keys(match).find(k => k.toLowerCase().includes("asuransi")) || "Asuransi";
            const panelKey = Object.keys(match).find(k => k.toLowerCase().includes("panel")) || "Jumlah Panel";
            asuransi = match[insKey] || "Personal (Umum)";
            jumlahPanel = Math.max(1, Number(match[panelKey]) || 1);
          }
        }

        // Find region details (if provided)
        let wilayah = "Jakarta Selatan";
        if (regFile) {
          const match = regFile.data.find((regRow: any) => {
            const regSpkKey = Object.keys(regRow).find(k => k.toLowerCase().replace(/[\s._-]/g, "") === "nospk") || "No SPK";
            return String(regRow[regSpkKey]).trim() === noSpk;
          });
          if (match) {
            const regKey = Object.keys(match).find(k => k.toLowerCase().includes("wilayah") || k.toLowerCase().includes("daerah")) || "Wilayah";
            wilayah = match[regKey] || "Jakarta Selatan";
          }
        }

        // Numerical extractions
        const jasaNettKey = Object.keys(gpRow).find(k => k.toLowerCase().includes("jasa")) || "Jasa Nett";
        const partNettKey = Object.keys(gpRow).find(k => k.toLowerCase().includes("part") || k.toLowerCase().includes("material")) || "Part Material Nett";
        const expBahanKey = Object.keys(gpRow).find(k => k.toLowerCase().includes("bahan") || k.toLowerCase().includes("expenses")) || "Expenses Bahan";
        const hppKey = Object.keys(gpRow).find(k => k.toLowerCase().includes("hpp")) || "HPP Part Material";
        const spklKey = Object.keys(gpRow).find(k => k.toLowerCase().includes("spkl") || k.toLowerCase().includes("luar")) || "SPKL";
        const tglKey = Object.keys(gpRow).find(k => k.toLowerCase().includes("tanggal") || k.toLowerCase().includes("date")) || "Tanggal";

        // Handle date
        let rawDate = gpRow[tglKey] || new Date().toISOString().split("T")[0];
        let dateStr = rawDate;
        if (typeof rawDate === "number") {
          // excel serial date
          const date = XLSX.SSF.parse_date_code(rawDate);
          dateStr = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
        } else if (rawDate.includes("/")) {
          const parts = rawDate.split("/");
          if (parts[2]?.length === 4) {
            dateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }

        const dateObj = new Date(dateStr);
        const autoWeek = Math.min(5, Math.floor((dateObj.getDate() - 1) / 7) + 1);

        return {
          id: `INV-${Date.now()}-${idx}`,
          tanggal: isNaN(dateObj.getTime()) ? new Date().toISOString().split("T")[0] : dateStr,
          week: Number(gpRow.Week || gpRow.week) || autoWeek,
          noSpk,
          asuransi: gpRow.Asuransi || gpRow.asuransi || asuransi,
          jasaNett: Number(gpRow[jasaNettKey]) || 0,
          partMaterialNett: Number(gpRow[partNettKey]) || 0,
          expensesBahan: Number(gpRow[expBahanKey]) || 0,
          hppPartMaterial: Number(gpRow[hppKey]) || 0,
          spkl: Number(gpRow[spklKey]) || 0,
          jumlahPanel: Number(gpRow.Panel || gpRow.panel || gpRow.jumlahPanel) || jumlahPanel,
          wilayah: gpRow.Wilayah || gpRow.wilayah || wilayah
        };
      });

      // Submit to server
      const res = await fetch("/api/records/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mergedList)
      });
      const resData = await res.json();
      
      if (!res.ok) throw new Error(resData.error || "Gagal menyimpan ke server");

      onDataLoaded(mergedList, `Berhasil memproses & mengimpor ${mergedList.length} baris SPK Body Repair!`);
      setSuccessMsg(`Integrasi Sukses! ${mergedList.length} data SPK tersambung ke Database. Dashboard Utama telah diperbarui.`);
      setParsedFiles({}); // clear
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan integrasi data.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetToSeed = async () => {
    setIsProcessing(true);
    try {
      await onReset();
      setSuccessMsg("Database bengkel berhasil di-reset ke Mode Simulasi Profesional (Seed Data berisi record April-Juni 2025/2026).");
    } catch (err) {
      setErrorMsg("Gagal melakukan reset database.");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentFilesArr = Object.values(parsedFiles) as ParsedFile[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div>
          <h2 className="text-xl font-semibold text-white font-sans flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" /> Pengelola Sumber Data Manual
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Database Aktif: <span className="text-emerald-400 font-bold">{currentCount} records</span> terintegrasi
          </p>
        </div>

        <button
          onClick={handleResetToSeed}
          disabled={isProcessing}
          type="button"
          id="btn-reset-db"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-300 hover:text-white transition duration-200 text-xs font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
          Reset ke Data Simulasi Bengkel
        </button>
      </div>

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 rounded-lg text-xs flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </motion.div>
      )}

      {/* Grid of Files Upload */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Upload 1: Gross Profit Perhitungan */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-600/30 text-amber-400 text-[10px] font-mono">Wajib Ada</span>
              <File className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-200 font-sans">1. Data Gross Profit Bengkel</h3>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Memuat data inti keuangan: Tanggal, No SPK, Jasa Nett, Part & Material Nett, Expenses Bahan Cat, dan HPP Part.
            </p>

            <div className="bg-gray-950/60 p-2.5 rounded border border-gray-900 font-mono text-[10px] text-gray-500 my-4 space-y-1">
              <p className="text-gray-400 font-bold">Kolom Template Contoh:</p>
              <p>• Tanggal (YYYY-MM-DD)</p>
              <p>• No SPK (SPK-X)</p>
              <p>• Jasa Nett, Part Material Nett</p>
              <p>• Expenses Bahan, HPP Part Material</p>
              <p>• SPKL</p>
            </div>
          </div>

          <div className="mt-4">
            {parsedFiles["gross-profit"] ? (
              <div className="p-2.5 bg-gray-900 rounded flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <p className="text-gray-200 font-bold truncate">{parsedFiles["gross-profit"].name}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{parsedFiles["gross-profit"].rowsCount} baris SPK</p>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center bg-indigo-600/5 border border-dashed border-indigo-500/30 hover:border-indigo-500/50 rounded-2xl p-6 cursor-pointer group transition duration-150 text-center">
                <Upload className="w-6 h-6 text-indigo-400 mb-2 transition duration-150" />
                <span className="text-xs font-bold text-white mb-1">Pilih / Drag File Excel</span>
                <span className="text-[10px] text-gray-500">Format: .xlsx / .csv</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => handleFileUpload(e, "gross-profit")}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Upload 2: Panels and Insurance */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-600/30 text-indigo-400 text-[10px] font-mono">Opsional (Join SPK)</span>
              <File className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-200 font-sans">2. Data Panel & Asuransi</h3>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Memuat pemetaan jumlah panel pengerjaan fisik serta mitra asuransi pembayar untuk masing-masing SPK.
            </p>

            <div className="bg-gray-950/60 p-2.5 rounded border border-gray-900 font-mono text-[10px] text-gray-500 my-4 space-y-1">
              <p className="text-gray-400 font-bold">Kolom Template Contoh:</p>
              <p>• No SPK</p>
              <p>• Jumlah Panel (Angka)</p>
              <p>• Asuransi (Nama Asuransi / Umum)</p>
            </div>
          </div>

          <div className="mt-4">
            {parsedFiles["panels-insurance"] ? (
              <div className="p-2.5 bg-gray-900 rounded flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <p className="text-gray-200 font-bold truncate">{parsedFiles["panels-insurance"].name}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{parsedFiles["panels-insurance"].rowsCount} baris data</p>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center bg-indigo-600/5 border border-dashed border-indigo-500/30 hover:border-indigo-500/50 rounded-2xl p-6 cursor-pointer group transition duration-150 text-center">
                <Upload className="w-6 h-6 text-indigo-400 mb-2 transition duration-150" />
                <span className="text-xs font-bold text-white mb-1">Pilih / Drag File Excel</span>
                <span className="text-[10px] text-gray-500">Format: .xlsx / .csv</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => handleFileUpload(e, "panels-insurance")}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Upload 3: Demographics / Region Mapping */}
        <div className="bg-[#111111] border border-[#222] p-4 rounded-xl relative  flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-600/30 text-purple-400 text-[10px] font-mono">Opsional (Join SPK)</span>
              <File className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-200 font-sans">3. Data Wilayah Pelanggan</h3>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Memetakan lokasi domisili geografis pelanggan per nomor SPK untuk memetakan konsentrasi pangsa pasar wilayah.
            </p>

            <div className="bg-gray-950/60 p-2.5 rounded border border-gray-900 font-mono text-[10px] text-gray-500 my-4 space-y-1">
              <p className="text-gray-400 font-bold">Kolom Template Contoh:</p>
              <p>• No SPK</p>
              <p>• Wilayah (Contoh: Surabaya, Sleman)</p>
            </div>
          </div>

          <div className="mt-4">
            {parsedFiles["regions"] ? (
              <div className="p-2.5 bg-gray-900 rounded flex items-center gap-2 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <p className="text-gray-200 font-bold truncate">{parsedFiles["regions"].name}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{parsedFiles["regions"].rowsCount} baris data</p>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center bg-indigo-600/5 border border-dashed border-indigo-500/30 hover:border-indigo-500/50 rounded-2xl p-6 cursor-pointer group transition duration-150 text-center">
                <Upload className="w-6 h-6 text-indigo-400 mb-2 transition duration-150" />
                <span className="text-xs font-bold text-white mb-1">Pilih / Drag File Excel</span>
                <span className="text-[10px] text-gray-500">Format: .xlsx / .csv</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => handleFileUpload(e, "regions")}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Action panel if files uploaded */}
      {currentFilesArr.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-900 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h4 className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-400" /> SIAP KONSOLIDASI & SYNCHRONIZE
            </h4>
            <p className="text-[11px] text-gray-400 mt-1">
              File terunggah: {currentFilesArr.map(f => `${f.name} (${f.rowsCount} r)`).join(", ")}. Merge otomatis berbasis korelasi SPK.
            </p>
          </div>
          <button
            onClick={handleMergeAndSave}
            disabled={isProcessing}
            type="button"
            className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-black font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)] transition"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            Proses & Jalankan Analisis Data Seketika!
          </button>
        </motion.div>
      )}

      {/* Guide Cards */}
      <div className="bg-gray-900/30 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5 font-sans">
          <HelpCircle className="w-4 h-4 text-indigo-400" /> Panduan Standardisasi Pengolahan Data
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
          <div className="bg-gray-950/40 p-3 rounded-lg border border-gray-900">
            <h5 className="font-semibold text-gray-200">Bagaimana Cara Penggabungan (Merging)?</h5>
            <p className="mt-1 leading-relaxed text-[11px]">
              Sistem backend kami membaca <span className="text-gray-200 font-mono">No SPK</span> dari seluruh sheet untuk dikorelasikan secara cerdas. Jika data panel/wilayah diunggah terpisah, asalkan berpasangan dengan nomor SPK yang sama dalam file Perhitungan Gross Profit, sistem akan menggabungkannya ke baris analisis secara otomatis.
            </p>
          </div>
          <div className="bg-gray-950/40 p-3 rounded-lg border border-gray-900">
            <h5 className="font-semibold text-gray-200">Supabase & Ekspor GitHub Mandiri</h5>
            <p className="mt-1 leading-relaxed text-[11px]">
              Platform ini dipersiapkan dengan folder database Supabase. File <span className="text-gray-200 font-mono">schema.sql</span> dilampirkan guna memudahkan pembuatan tabel secara instan di Supabase Client Dashboard milik Anda ketika melakukan deployment ke Vercel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
