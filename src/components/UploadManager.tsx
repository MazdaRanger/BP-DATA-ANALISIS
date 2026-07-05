import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, File, RefreshCw, CheckCircle2, AlertTriangle, Play, Database, Calendar, PlusCircle, BrainCircuit, Download, PhoneCall } from "lucide-react";
import { collection, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

interface UploadManagerProps {
  onDatabaseChanged: () => Promise<void>;
  currentCount: number;
}

export default function UploadManager({ onDatabaseChanged, currentCount }: UploadManagerProps) {
  const [uploadTab, setUploadTab] = useState<"MAIN" | "CRC">("MAIN");

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

  // CRC Form States
  const [crcSpkAsuransi, setCrcSpkAsuransi] = useState(0);
  const [crcOutbondCall, setCrcOutbondCall] = useState(0);
  const [crcUnitBooking, setCrcUnitBooking] = useState(0);
  const [crcUnitWalkIn, setCrcUnitWalkIn] = useState(0);
  const [crcOutbondAfterService, setCrcOutbondAfterService] = useState(0);
  const [crcNumberPhoneInvalid, setCrcNumberPhoneInvalid] = useState(0);
  const [crcCostumerComplain, setCrcCostumerComplain] = useState(0);
  const [crcOutbondProspekAsuransi, setCrcOutbondProspekAsuransi] = useState(0);
  const [isSavingCrc, setIsSavingCrc] = useState(false);
  const [crcMsg, setCrcMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setManualMsg({ type: "error", text: `Terjadi kesalahan: ${err.message}` });
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleCrcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCrc(true);
    setCrcMsg(null);
    try {
      const id = `CRC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const docRef = doc(db, "crc_records", id);

      await setDoc(docRef, {
        id,
        tanggal: manualDate,
        week: manualWeek,
        jumlahSpkAsuransi: crcSpkAsuransi,
        outbondCall: crcOutbondCall,
        unitBooking: crcUnitBooking,
        unitWalkIn: crcUnitWalkIn,
        outbondAfterService: crcOutbondAfterService,
        numberPhoneInvalid: crcNumberPhoneInvalid,
        costumerComplain: crcCostumerComplain,
        outbondProspekAsuransi: crcOutbondProspekAsuransi
      });

      await onDatabaseChanged();
      setCrcMsg({ type: "success", text: "Data CRC berhasil disimpan!" });

      // Reset numerical fields
      setCrcSpkAsuransi(0); setCrcOutbondCall(0); setCrcUnitBooking(0); setCrcUnitWalkIn(0);
      setCrcOutbondAfterService(0); setCrcNumberPhoneInvalid(0); setCrcCostumerComplain(0); setCrcOutbondProspekAsuransi(0);
    } catch (err: any) {
      console.error(err);
      setCrcMsg({ type: "error", text: `Terjadi kesalahan: ${err.message}` });
    } finally {
      setIsSavingCrc(false);
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white font-sans tracking-tight">Manajemen Database Pusat</h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            {currentCount} record aktif tersedia. Sinkronisasi via Cloud Firestore.
          </p>
        </div>
        <div className="flex bg-[#111] p-1 rounded-lg border border-[#222]">
          <button
            onClick={() => setUploadTab("MAIN")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition ${uploadTab === "MAIN" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
          >
            <Database className="w-4 h-4" /> Data Keuangan & AI
          </button>
          <button
            onClick={() => setUploadTab("CRC")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition ${uploadTab === "CRC" ? "bg-emerald-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
          >
            <PhoneCall className="w-4 h-4" /> Database CRC
          </button>
        </div>
      </div>

      {uploadTab === "MAIN" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
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
      )}

      {uploadTab === "CRC" && (
        <div className="bg-[#111111] border border-[#222] p-6 rounded-xl space-y-6 max-w-3xl">
          <div className="flex items-center gap-2 border-b border-[#262626] pb-3">
            <PhoneCall className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">Input Manual Data CRC Mingguan</h4>
          </div>

          {crcMsg && (
            <div className={`p-3 rounded-lg text-xs font-mono border ${crcMsg.type === "success" ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300" : "bg-red-950/40 border-red-500/30 text-red-300"}`}>
              {crcMsg.text}
            </div>
          )}

          <form onSubmit={handleCrcSubmit} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-6 mt-4">
              {/* KOLOM KIRI */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Jumlah SPK Asuransi</label>
                  <input type="number" required value={crcSpkAsuransi.toString()} onChange={e => setCrcSpkAsuransi(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Outbond Call</label>
                  <input type="number" required value={crcOutbondCall.toString()} onChange={e => setCrcOutbondCall(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Unit Booking</label>
                  <input type="number" required value={crcUnitBooking.toString()} onChange={e => setCrcUnitBooking(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Unit Walk-in</label>
                  <input type="number" required value={crcUnitWalkIn.toString()} onChange={e => setCrcUnitWalkIn(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
                </div>
              </div>

              {/* KOLOM KANAN */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Outbond After Service</label>
                  <input type="number" required value={crcOutbondAfterService.toString()} onChange={e => setCrcOutbondAfterService(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Number Phone Invalid</label>
                  <input type="number" required value={crcNumberPhoneInvalid.toString()} onChange={e => setCrcNumberPhoneInvalid(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Costumer Complain</label>
                  <input type="number" required value={crcCostumerComplain.toString()} onChange={e => setCrcCostumerComplain(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Outbond Prospek Asuransi</label>
                  <input type="number" required value={crcOutbondProspekAsuransi.toString()} onChange={e => setCrcOutbondProspekAsuransi(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingCrc}
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-bold py-2.5 rounded-lg flex justify-center items-center gap-2 transition text-xs"
            >
              {isSavingCrc ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {isSavingCrc ? "Menyimpan Data..." : "Simpan Data CRC ke Database"}
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
