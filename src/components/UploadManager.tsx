import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, File, RefreshCw, CheckCircle2, AlertTriangle, Play, Download, Database, HelpCircle } from "lucide-react";
import { BodyRepairRecord } from "../types.js";
import { collection, writeBatch, doc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebaseConfig.js";

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
    // Simple check to ensure Firebase is reachable
    const checkStatus = async () => {
      try {
        await getDocs(collection(db, "body_repair_records"));
        setDbStatus({
          connected: true,
          errorType: null,
          message: "Koneksi live Firebase sinkron dan aktif!"
        });
      } catch (e: any) {
        setDbStatus({
          connected: false,
          errorType: "AUTH_REQUIRED",
          message: e.message || "Tabel database membutuhkan hak akses. Memory Sandbox fallback aktif."
        });
      }
    };
    checkStatus();
  }, [currentCount]);

  const downloadGuide = () => {
    const wb = XLSX.utils.book_new();
    const columns = [
      "Tanggal (YYYY-MM-DD)", "NoSPK", "Asuransi", "JasaNett", "PartMaterialNett", 
      "ExpensesBahan", "HPPPartMaterial", "SPKL", "JumlahPanel", "Wilayah"
    ];
    
    // Create 5 sheets representing 5 weeks
    for (let w = 1; w <= 5; ++w) {
      const ws = XLSX.utils.aoa_to_sheet([columns]);
      XLSX.utils.book_append_sheet(wb, ws, `Minggu ${w}`);
    }

    XLSX.writeFile(wb, "Data_Master_Guide_Bengkel.xlsx");
    setSuccessMsg("Excel Guide berhasil diunduh. Silakan isi data berdasarkan template per minggu lalu unggah kembali.");
  };

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
        
        let allData: any[] = [];
        
        // Baca semua sheet
        workbook.SheetNames.forEach((sheetName) => {
          // Hanya proses sheet yang sekiranya bernama "Minggu X"
          if (sheetName.toLowerCase().includes("minggu")) {
            const weekNumberMatch = sheetName.match(/\d+/);
            const weekNumber = weekNumberMatch ? parseInt(weekNumberMatch[0], 10) : 1;
            
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            
            // Tambahkan kolom minggu dan gabungkan array
            const enrichedData = jsonData.map((row: any) => ({ ...row, _week: weekNumber }));
            allData = allData.concat(enrichedData);
          }
        });
        
        if (allData.length === 0) {
          // Fallback if sheets are not named 'Minggu'
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          allData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          allData = allData.map((row: any) => ({ ...row, _week: 1 }));
        }

        if (allData.length === 0) {
          throw new Error("File Excel kosong atau format tidak didukung.");
        }

        setFileData(allData);
        setSuccessMsg(`Berhasil membaca file ${file.name} (${allData.length} baris data ditemukan). Silakan Proses Sinkronisasi Data.`);
      } catch (err: any) {
        setErrorMsg(`Gagal memuat file: ${err.message || err}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const processData = async () => {
    if (!fileData || fileData.length === 0) return;
    
    setIsProcessing(true);
    setErrorMsg("");
    setSuccessMsg("Mengekstrak data dari berbagai lembar kerja Mingguan...");

    try {
      const preparedRecords: Partial<BodyRepairRecord>[] = fileData.map((row) => {
        // Find matching keys dynamically since users might tweak the column names slightly
        const getVal = (possibleKeys: string[], defaultValue: any) => {
          for (const key of possibleKeys) {
            const foundKey = Object.keys(row).find(k => k.toLowerCase().replace(/[^a-z]/g, '') === key.toLowerCase().replace(/[^a-z]/g, ''));
            if (foundKey && row[foundKey] !== "") return row[foundKey];
          }
          return defaultValue;
        };

        const rawDate = getVal(["Tanggal", "Date", "TanggalYYYYMMDD"], new Date().toISOString().split("T")[0]);
        let dateStr = String(rawDate);
        if (typeof rawDate === "number") {
          const dt = XLSX.SSF.parse_date_code(rawDate);
          if (dt) {
            dateStr = `${dt.y}-${String(dt.m).padStart(2, "0")}-${String(dt.d).padStart(2, "0")}`;
          }
        }

        const safeNumber = (val: any) => {
           if (typeof val === "number") return val;
           if (typeof val === "string") return Number(val.replace(/[^0-9.-]+/g,"")) || 0;
           return 0;
        }

        const weekNum = row._week || 1;

        return {
          id: `INV-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          tanggal: dateStr,
          noSpk: String(getVal(["NoSPK", "SPK"], `SPK-GUIDE-${Math.floor(Math.random() * 10000)}`)),
          asuransi: String(getVal(["Asuransi"], "Personal")),
          jasaNett: safeNumber(getVal(["JasaNett", "Jasa"], 0)),
          partMaterialNett: safeNumber(getVal(["PartMaterialNett", "PartMaterial"], 0)),
          expensesBahan: safeNumber(getVal(["ExpensesBahan", "Expenses"], 0)),
          hppPartMaterial: safeNumber(getVal(["HPPPartMaterial", "HPP"], 0)),
          spkl: safeNumber(getVal(["SPKL"], 0)),
          jumlahPanel: Math.max(1, safeNumber(getVal(["JumlahPanel", "Panel"], 1))),
          wilayah: String(getVal(["Wilayah", "Area"], "Tidak Diketahui")),
          week: weekNum,
        };
      });

      // Saving to Client Side Firebase
      const existingSnap = await getDocs(collection(db, "body_repair_records"));
      const batchClear = writeBatch(db);
      existingSnap.docs.forEach((docSnap) => batchClear.delete(docSnap.ref));
      await batchClear.commit().catch(e => console.warn("Clear database failed", e));

      // Batch insert logic using chunking
      const chunkSize = 400;
      for (let i = 0; i < preparedRecords.length; i += chunkSize) {
        const batchInsert = writeBatch(db);
        const chunk = preparedRecords.slice(i, i + chunkSize);
        chunk.forEach(record => {
           const docRef = doc(db, "body_repair_records", record.id as string);
           batchInsert.set(docRef, record);
        });
        await batchInsert.commit();
      }

      onDataLoaded(preparedRecords as BodyRepairRecord[], "Berhasil mengunggah data.");
      setSuccessMsg(`Proses Selesai. ${preparedRecords.length} SPK berhasil diverifikasi dan disimpan dari berbagai minggu!`);
      
    } catch (error: any) {
      console.error(error);
      setErrorMsg(`Proses Gagal: ${error.message}`);
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
              <Download className="w-5 h-5 text-indigo-400" />
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">Sistem Unggah Manual & Excel Guide</h3>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed font-mono">
            Sistem menggunakan format Excel baku yang dibagi per minggu untuk mencegah entri ganda. Unduh guide, isi data, dan unggah.
          </p>
        </div>
        <button 
          onClick={downloadGuide}
          className="shrink-0 px-4 py-2 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-bold text-xs rounded-lg flex items-center gap-2 transition"
        >
          <Download className="w-4 h-4" /> Unduh Excel Guide
        </button>
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
          <h4 className="text-sm font-bold text-white mb-2">Unggah File Excel yang Terisi</h4>
          <p className="text-[10px] text-gray-500 mb-6 font-mono text-center max-w-xs block leading-relaxed">
            Format harus sesuai dengan panduan. Pastikan tiap minggu berada di sheet terpisah untuk menghindari error.
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
              <Database className="w-4 h-4 text-indigo-400" /> Alur Pemrosesan
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded bg-[#1a1a1a] border border-[#262626]">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${fileData ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-[#262626] text-gray-500"}`}>1</div>
                <span className={`text-xs ${fileData ? "text-emerald-400 font-bold" : "text-gray-400"}`}>Validasi format ({fileData?.length || 0} SPK terbaca)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded bg-[#1a1a1a] border border-[#262626]">
                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${isProcessing ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30 animate-pulse" : "bg-[#262626] border-[#262626] text-gray-500"}`}>2</div>
                <span className={`text-xs ${isProcessing ? "text-indigo-400 font-bold" : "text-gray-400"}`}>Sinkronisasi ke Database Utama</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={processData}
            disabled={!fileData || isProcessing}
            className={`w-full p-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition ${!fileData || isProcessing ? "bg-[#171717] border border-[#262626] text-gray-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]"}`}
          >
            {isProcessing ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /> Sedang Diproses...</>
            ) : (
              <><Play className="w-5 h-5" /> Mulai Sinkronisasi Data</>
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
