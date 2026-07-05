import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, File, RefreshCw, CheckCircle2, AlertTriangle, Play, Database, Calendar, PlusCircle, BrainCircuit, Download } from "lucide-react";
import { collection, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

interface UploadManagerProps {
  onDatabaseChanged: () => Promise<void>;
  currentCount: number;
}

export default function UploadManager({ onDatabaseChanged, currentCount }: UploadManagerProps) {
  // Manual Input States
  const [manualWeek, setManualWeek] = useState<number>(1);
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [manualJasa, setManualJasa] = useState<number>(0);
  const [manualPart, setManualPart] = useState<number>(0);
  const [manualExpenses, setManualExpenses] = useState<number>(0);
  const [manualHpp, setManualHpp] = useState<number>(0);
  const [manualSpkl, setManualSpkl] = useState<number>(0);
  const [manualPanel, setManualPanel] = useState<number>(0);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualMsg, setManualMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // AI Upload States
  const [fileData, setFileData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingManual(true);
    setManualMsg(null);
    try {
      const id = `FIN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const docRef = doc(db, "body_repair_records", id);

      await setDoc(docRef, {
        id,
        tanggal: manualDate,
        week: manualWeek,
        no_spk: "MANUAL-FINANCIAL",
        asuransi: "",
        jasa_nett: manualJasa,
        part_material_nett: manualPart,
        expenses_bahan: manualExpenses,
        hpp_part_material: manualHpp,
        spkl: manualSpkl,
        jumlah_panel: manualPanel,
        wilayah: ""
      });

      await onDatabaseChanged();
      setManualMsg({ type: "success", text: "Data keuangan agregat berhasil disimpan!" });

      // Reset numerical fields
      setManualJasa(0); setManualPart(0); setManualExpenses(0); setManualHpp(0); setManualSpkl(0); setManualPanel(0);
    } catch (err: any) {
      console.error(err);
      setManualMsg({ type: "error", text: `Gagal menyimpan: ${err.message}` });
    } finally {
      setIsSavingManual(false);
    }
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const columns = ["Nopol", "Alamat", "Pelanggan atau Asuransi"];
    const sampleData = [
      ["B 1234 ROS", "Jl. Sudirman No 1", "Asuransi Garda Oto"],
      ["", "Jakarta Selatan", "Bapak Budi (Personal)"],
      ["D 5678 XX", "", "Adira"]
    ];
    const ws = XLSX.utils.aoa_to_sheet([columns, ...sampleData]);
    XLSX.utils.book_append_sheet(wb, ws, "Data_Mapping");
    XLSX.writeFile(wb, "Template_Mapping_AI.xlsx");
    setAiMsg({ type: "success", text: "Template Excel berhasil diunduh!" });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiMsg(null);
    setFileData(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bser = evt.target?.result;
        const workbook = XLSX.read(bser, { type: "binary" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonData.length === 0) {
          throw new Error("File Excel kosong.");
        }

        setFileData(jsonData);
        setAiMsg({ type: "success", text: `File terbaca (${jsonData.length} baris). Siap dikirim ke AI Backend.` });
      } catch (err: any) {
        setAiMsg({ type: "error", text: `Gagal memuat file: ${err.message}` });
      }
    };
    reader.readAsBinaryString(file);
  };

  const processAIExtraction = async () => {
    if (!fileData || fileData.length === 0) return;
    setIsProcessingAI(true);
    setAiMsg({ type: "success", text: "Mengirim data ke AI Backend untuk di-screening..." });

    try {
      const res = await fetch("/api/process-excel-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawRows: fileData })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Server error during AI screening");
      }

      const aiMappedData = await res.json();

      setAiMsg({ type: "success", text: "AI Selesai! Menyimpan hasil pemetaan ke database..." });

      const preparedRecords = aiMappedData.map((row: any, index: number) => ({
        id: `MAP-${Date.now()}-${index}`,
        tanggal: manualDate,
        week: manualWeek,
        no_spk: "AI-MAPPING-RECORD",
        asuransi: row.asuransi || "Personal",
        jasa_nett: 0,
        part_material_nett: 0,
        expenses_bahan: 0,
        hpp_part_material: 0,
        spkl: 0,
        jumlah_panel: 0, // 0 so it doesn't inflate total panel count!
        wilayah: row.wilayah || "Tidak Diketahui"
      }));

      const chunkSize = 400;
      for (let i = 0; i < preparedRecords.length; i += chunkSize) {
        const batchInsert = writeBatch(db);
        const chunk = preparedRecords.slice(i, i + chunkSize);
        chunk.forEach((record: any) => {
          const docRef = doc(db, "body_repair_records", record.id);
          batchInsert.set(docRef, record);
        });
        await batchInsert.commit();
      }

      await onDatabaseChanged();
      setAiMsg({ type: "success", text: `Berhasil memetakan dan menyimpan ${preparedRecords.length} record wilayah & asuransi!` });
      setFileData(null);
      setFileName("");
    } catch (err: any) {
      console.error(err);
      setAiMsg({ type: "error", text: `AI Screening Gagal: ${err.message}` });
    } finally {
      setIsProcessingAI(false);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="bg-gradient-to-br from-[#0c0f16] to-[#040609] p-4 rounded-xl border border-indigo-500/10 flex flex-col md:flex-row justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20">
              <Database className="w-5 h-5 text-indigo-400" />
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">Sistem Input Hybrid</h3>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed font-mono">
            Isi agregat keuangan secara manual, dan unggah daftar SPK untuk dipetakan secara otomatis oleh AI.
          </p>
        </div>
        <div className="flex items-center px-4 py-2 bg-indigo-900/20 border border-indigo-500/30 rounded-lg text-indigo-300 font-mono text-xs">
          Total Data di Sistem: {currentCount}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* MANUAL INPUT FORM */}
        <div className="bg-[#111111] border border-[#222] p-6 rounded-xl space-y-6 relative">
          <div className="flex items-center gap-2 border-b border-[#262626] pb-3">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">Input Total Keuangan Mingguan</h4>
          </div>

          {manualMsg && (
            <div className={`p-3 rounded-lg text-xs font-mono border ${manualMsg.type === "success" ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" : "bg-red-950/40 border-red-500/30 text-red-300"}`}>
              {manualMsg.text}
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Tanggal Input</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                  <input type="date" required value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Minggu Ke-</label>
                <select required value={manualWeek} onChange={e => setManualWeek(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none">
                  {[1,2,3,4,5].map(w => <option key={w} value={w}>Minggu {w}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Jasa Nett</label>
              <input type="number" required value={manualJasa.toString()} onChange={e => setManualJasa(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Part & Material Nett</label>
              <input type="number" required value={manualPart.toString()} onChange={e => setManualPart(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Expenses Bahan</label>
              <input type="number" required value={manualExpenses.toString()} onChange={e => setManualExpenses(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">HPP Part</label>
                <input type="number" required value={manualHpp.toString()} onChange={e => setManualHpp(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">SPKL</label>
                <input type="number" required value={manualSpkl.toString()} onChange={e => setManualSpkl(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Jumlah Total Panel</label>
              <input type="number" required value={manualPanel.toString()} onChange={e => setManualPanel(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
            </div>

            <button type="submit" disabled={isSavingManual} className="w-full mt-4 py-3 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50">
              {isSavingManual ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {isSavingManual ? "Menyimpan..." : "Simpan Data Keuangan"}
            </button>
          </form>
        </div>

        {/* AI UPLOAD ZONE */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#111111] border border-[#222] p-6 rounded-xl flex-1 flex flex-col justify-center relative border-dashed border-2 hover:border-indigo-500/50 transition">
            <div className="absolute top-4 left-4 flex items-center gap-2">
               <BrainCircuit className="w-4 h-4 text-indigo-400" />
               <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pemetaan Wilayah & Asuransi</h4>
            </div>

            <button 
              onClick={downloadTemplate}
              className="absolute top-3 right-3 px-3 py-1.5 bg-indigo-900/30 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition"
            >
              <Download className="w-3 h-3" /> Unduh Template
            </button>

            <div className="flex flex-col items-center text-center mt-6">
              <Upload className="w-8 h-8 text-indigo-400 mb-4" />
              <h4 className="text-sm font-bold text-white mb-2">Unggah Excel SPK (Nopol & Asuransi)</h4>
              <p className="text-[10px] text-gray-500 mb-6 font-mono max-w-[240px] leading-relaxed">
                AI akan mencari kolom Alamat, Nopol, dan Pelanggan untuk memetakan Wilayah dan Asuransi secara pintar.
              </p>
              
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              {fileName && (
                <div className="mt-2 px-3 py-1.5 bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 text-xs rounded-full flex items-center gap-2">
                  <File className="w-3.5 h-3.5" />
                  {fileName}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#111111] border border-[#222] p-6 rounded-xl space-y-4">
            {aiMsg && (
              <div className={`p-3 rounded-lg text-xs font-mono border flex items-start gap-2 ${aiMsg.type === "success" ? "bg-indigo-950/40 border-indigo-500/30 text-indigo-300" : "bg-red-950/40 border-red-500/30 text-red-300"}`}>
                {aiMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{aiMsg.text}</span>
              </div>
            )}
            
            <button
              onClick={processAIExtraction}
              disabled={!fileData || isProcessingAI}
              className={`w-full p-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition ${!fileData || isProcessingAI ? "bg-[#171717] border border-[#262626] text-gray-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]"}`}
            >
              {isProcessingAI ? (
                <><RefreshCw className="w-5 h-5 animate-spin" /> AI Sedang Menganalisis...</>
              ) : (
                <><Play className="w-5 h-5" /> Proses Pemetaan dengan AI</>
              )}
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
