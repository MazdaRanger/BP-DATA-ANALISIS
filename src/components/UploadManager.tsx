import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, File, RefreshCw, CheckCircle2, AlertTriangle, Play, Sparkles, Database, HelpCircle } from "lucide-react";
import { BodyRepairRecord, AiMappingConfig } from "../types.js";

interface UploadManagerProps {
  onDataLoaded: (records: BodyRepairRecord[], message: string) => void;
  onReset: () => Promise<void>;
  currentCount: number;
}

export default function UploadManager({ onDataLoaded, onReset, currentCount }: UploadManagerProps) {
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    errorType: string | null;
    message: string;
    details?: any;
  } | null>(null);

  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/database-status");
        if (res.ok) {
          const status = await res.json();
          setDbStatus(status);
        }
      } catch (e) {
        console.error("Gagal memeriksa status database", e);
      }
    };
    checkStatus();
  }, [currentCount]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");
    setFileData(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bser = evt.target?.result;
        const workbook = XLSX.read(bser, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read raw data from Excel sheet
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        if (jsonData.length === 0) {
          throw new Error("File Excel kosong atau format tidak didukung.");
        }

        setFileData(jsonData);
        setSuccessMsg(`Berhasil membaca file ${file.name} (${jsonData.length} baris data ditemukan). Silakan proses dengan AI Screening.`);
      } catch (err: any) {
        setErrorMsg(`Gagal memuat file: ${err.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const processWithAI = async () => {
    if (!fileData || fileData.length === 0) return;
    
    setIsProcessing(true);
    setErrorMsg("");
    setSuccessMsg("Menganalisis format dokumen dengan AI Studio Backend...");

    try {
      // 1. Send sample to AI
      const sample = fileData.slice(0, 3);
      const aiRes = await fetch("/api/ai-mapper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleData: sample })
      });

      if (!aiRes.ok) {
        const errJson = await aiRes.json();
        throw new Error(errJson.error || "Gagal menghubungi AI backend.");
      }

      const mapping: AiMappingConfig = await aiRes.json();
      setSuccessMsg("Pemetaan AI berhasil. Memformulasikan data...");

      // 2. Map local data to BodyRepairRecord using mapped keys
      const preparedRecords: Partial<BodyRepairRecord>[] = fileData.map((row) => {
        let dateStr = row[mapping.tanggalKey] || new Date().toISOString().split("T")[0];
        // Handle basic excel number dates
        if (typeof dateStr === "number") {
          const dt = XLSX.SSF.parse_date_code(dateStr);
          if (dt) {
            dateStr = `${dt.y}-${String(dt.m).padStart(2, "0")}-${String(dt.d).padStart(2, "0")}`;
          } else {
            dateStr = new Date().toISOString().split('T')[0];
          }
        }

        // Parse numerical values safely
        const safeNumber = (val: any) => {
           if (typeof val === "number") return val;
           if (typeof val === "string") return Number(val.replace(/[^0-9.-]+/g,"")) || 0;
           return 0;
        }

        return {
          id: `INV-AI-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          tanggal: dateStr,
          noSpk: String(mapping.noSpkKey && row[mapping.noSpkKey] ? row[mapping.noSpkKey] : `SPK-AI-${Math.floor(Math.random() * 10000)}`),
          asuransi: mapping.asuransiKey && row[mapping.asuransiKey] ? String(row[mapping.asuransiKey]) : "Personal",
          jasaNett: mapping.jasaNettKey ? safeNumber(row[mapping.jasaNettKey]) : 0,
          partMaterialNett: mapping.partMaterialNettKey ? safeNumber(row[mapping.partMaterialNettKey]) : 0,
          expensesBahan: mapping.expensesBahanKey ? safeNumber(row[mapping.expensesBahanKey]) : 0,
          hppPartMaterial: mapping.hppPartMaterialKey ? safeNumber(row[mapping.hppPartMaterialKey]) : 0,
          spkl: mapping.spklKey ? safeNumber(row[mapping.spklKey]) : 0,
          jumlahPanel: mapping.jumlahPanelKey ? Math.max(1, safeNumber(row[mapping.jumlahPanelKey])) : 1,
          wilayah: mapping.wilayahKey && row[mapping.wilayahKey] ? String(row[mapping.wilayahKey]) : "Tidak Diketahui"
        };
      });

      // 3. Save to backend to generate calculations and weeks
      const uploadRes = await fetch("/api/records/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preparedRecords)
      });
      
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Gagal menyimpan database");

      onDataLoaded(preparedRecords as BodyRepairRecord[], uploadData.message);
      setSuccessMsg(`Siklus AI Selesai. Ekstraksi ${preparedRecords.length} SPK berhasil diverifikasi dan disimpan!`);
      
    } catch (error: any) {
      console.error(error);
      setErrorMsg(`AI Screening Gagal: ${error.message}`);
      setSuccessMsg("");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="bg-gradient-to-br from-[#0c0f16] to-[#040609] p-4 rounded-xl border border-indigo-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">AI Screening Document (Excel)</h3>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed font-mono">
            Tinggalkan proses mapping kolom manual. Sistem AI akan melakukan deteksi otomatis berdasarkan isi kolom master Excel bengkel Anda.
          </p>
        </div>
      </div>

      {(errorMsg || successMsg) && (
        <div className={`p-4 rounded-xl border text-xs font-mono flex items-start gap-3 ${errorMsg ? "bg-red-950/40 border-red-500/30 text-red-300" : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"}`}>
          {errorMsg ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
          <div className="space-y-1 leading-relaxed">
            <p className="font-bold">{errorMsg ? "SYSTEM FAILURE" : "SYSTEM SUCCESS"}</p>
            <p>{errorMsg || successMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Dropzone Area */}
        <div className="bg-[#111111] border border-[#222] p-6 rounded-xl relative flex flex-col items-center justify-center h-64 border-dashed border-2 hover:border-indigo-500/50 transition">
          <Upload className="w-8 h-8 text-indigo-400 mb-4" />
          <h4 className="text-sm font-bold text-white mb-2">Pilih Master File Excel Anda</h4>
          <p className="text-[10px] text-gray-500 mb-6 font-mono text-center max-w-xs block leading-relaxed">
            AI akan mengekstraksi: No SPK, Asuransi, Jasa, Sparepart, Wilayah, SPKL, dan Jumlah Panel secara pintar.
          </p>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {fileName && (
            <div className="mt-4 px-3 py-1.5 bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 text-xs rounded-full flex items-center gap-2">
              <File className="w-3.5 h-3.5" />
              {fileName}
            </div>
          )}
        </div>

        <div className="bg-[#111111] border border-[#222] p-6 rounded-xl space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" /> Alur Eksekusi
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded bg-[#1a1a1a] border border-[#262626]">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${fileData ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-[#262626] text-gray-500"}`}>1</div>
                <span className={`text-xs ${fileData ? "text-emerald-400 font-bold" : "text-gray-400"}`}>File Excel terdeteksi ({fileData?.length || 0} baris)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded bg-[#1a1a1a] border border-[#262626]">
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${isProcessing ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30 animate-pulse" : "bg-[#262626] border-[#262626] text-gray-500"}`}>2</div>
                <span className={`text-xs ${isProcessing ? "text-indigo-400 font-bold" : "text-gray-400"}`}>Screening AI Backend API</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={processWithAI}
            disabled={!fileData || isProcessing}
            className={`w-full p-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition ${!fileData || isProcessing ? "bg-[#171717] border border-[#262626] text-gray-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]"}`}
          >
            {isProcessing ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /> Sedang Analisis...</>
            ) : (
              <><Play className="w-5 h-5" /> Mulai AI Screening</>
            )}
          </button>
        </div>
      </div>
      
      {/* Current DB Snapshot Banner / Connection Status */}
      <div className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-5 transition ${
        dbStatus?.connected 
          ? "bg-[#101410]/80 border-emerald-500/20" 
          : dbStatus?.errorType === "TABLE_MISSING"
          ? "bg-[#18110a]/80 border-amber-500/20"
          : "bg-[#160c0c]/80 border-red-500/20"
      }`}>
        <div className="space-y-1.5 max-w-xl">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            {dbStatus?.connected ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Database Live Firebase Aktif</>
            ) : dbStatus?.errorType === "TABLE_MISSING" ? (
              <><AlertTriangle className="w-4 h-4 text-amber-400" /> Sinkronisasi Firebase Tertunda</>
            ) : (
              <><AlertTriangle className="w-4 h-4 text-red-400" /> Mode Memori Lokal Aktif</>
            )}
          </h4>
          <p className="text-[10px] leading-relaxed text-gray-400 font-mono">
            {dbStatus?.connected
              ? "Sistem sinkronisasi dua arah dengan Firebase Cloud Firestore aktif. Semua data tersimpan aman secara durable."
              : dbStatus?.errorType === "TABLE_MISSING"
              ? "Tabel database atau Firebase Rules belum terdeteksi/aktif. Sementara, data akan disimpan di memori lokal secara otomatis."
              : "Firebase cloud sedang offline atau membutuhkan hak akses. Dashboard saat ini otomatis berjalan menggunakan penyimpanan memori terisolasi (Memory Sandbox)."}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded bg-[#111111]/90 border border-[#222] flex items-center gap-2">
            <span className="text-[10px] text-gray-500 font-mono">Records Terbaca:</span>
            <span className="text-xs font-bold text-indigo-400 font-mono">{currentCount} SPK</span>
          </div>
          
          <button
            onClick={onReset}
            type="button"
            className="px-3 py-1.5 rounded bg-amber-950/20 border border-amber-500/20 hover:bg-amber-950/40 text-amber-400 transition text-[11px] font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang Demo Seed
          </button>
        </div>
      </div>
    </div>
  );
}
