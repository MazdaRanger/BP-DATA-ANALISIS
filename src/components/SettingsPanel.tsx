import React, { useState, useEffect } from "react";
import { Settings, Save, Calendar as CalendarIcon, Users, Building, Info, AlertTriangle, RefreshCw, Database, Trash2, ShieldAlert } from "lucide-react";
import { AppSettings } from "../types.js";

interface SettingsPanelProps {
  onDatabaseChanged?: () => void;
}

export default function SettingsPanel({ onDatabaseChanged }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>({ mechanicsCount: 15, sprayboothsCount: 4, holidays: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Database control states
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbMessage, setDbMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Date picker state
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5)); // default to June 2026
  
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      alert("Pengaturan Berhasil Disimpan");
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const handleClearDatabase = async () => {
    setDbLoading(true);
    setDbMessage(null);
    try {
      const res = await fetch("/api/records/clear", { method: "POST" });
      if (res.ok) {
        setDbMessage({ type: "success", text: "Database berhasil dikosongkan secara permanen!" });
        if (onDatabaseChanged) onDatabaseChanged();
      } else {
        throw new Error("Gagal mengosongkan database");
      }
    } catch (e: any) {
      setDbMessage({ type: "error", text: e.message || "Gagal menghubungi server backend." });
    } finally {
      setDbLoading(false);
      setShowClearConfirm(false);
    }
  };

  const handleLoadSeedData = async () => {
    setDbLoading(true);
    setDbMessage(null);
    try {
      const res = await fetch("/api/records/reset", { method: "POST" });
      if (res.ok) {
        setDbMessage({ type: "success", text: "Data simulasi profesional berhasil dimuat!" });
        if (onDatabaseChanged) onDatabaseChanged();
      } else {
        throw new Error("Gagal memuat data simulasi");
      }
    } catch (e: any) {
      setDbMessage({ type: "error", text: e.message || "Gagal menghubungi server backend." });
    } finally {
      setDbLoading(false);
      setShowResetConfirm(false);
    }
  };

  const toggleHoliday = (dateStr: string) => {
    setSettings(prev => {
      const holidays = prev.holidays.includes(dateStr)
        ? prev.holidays.filter(d => d !== dateStr)
        : [...prev.holidays, dateStr];
      return { ...prev, holidays };
    });
  };

  // Calendar render logic
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const blanks = Array.from({ length: firstDay }).fill(null);
    const days = Array.from({ length: daysInMonth }).map((_, i) => i + 1);
    
    return (
      <div className="bg-[#111111] border border-[#222] p-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-indigo-400" /> Kalender Libur (Hari Non-Efektif)
          </h4>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentDate(new Date(year, month - 1))}
              className="px-3 py-1 bg-[#1a1a1a] border border-[#262626] rounded text-white text-xs hover:bg-[#262626]"
            >
              Prev
            </button>
            <span className="text-sm font-bold text-indigo-400 w-32 text-center">
              {currentDate.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
            <button 
              onClick={() => setCurrentDate(new Date(year, month + 1))}
              className="px-3 py-1 bg-[#1a1a1a] border border-[#262626] rounded text-white text-xs hover:bg-[#262626]"
            >
              Next
            </button>
          </div>
        </div>
        
        <p className="text-xs text-gray-400 mb-4 bg-indigo-500/10 p-3 rounded border border-indigo-500/20">
          <Info className="w-4 h-4 inline mr-1 text-indigo-400"/>
          Pilih tanggal untuk menandainya sebagai libur. Warna <span className="text-red-400 font-bold">MERAH</span> berarti hari libur. Hari Minggu otomatis dihitung non-efektif oleh sistem backend untuk kalkulasi kategori Week-1, Week-2 dst.
        </p>

        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          <div>Min</div><div>Sen</div><div>Sel</div><div>Rab</div><div>Kam</div><div>Jum</div><div>Sab</div>
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {blanks.map((_, i) => <div key={`blank-${i}`} className="p-2" />)}
          {days.map(day => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isHoliday = settings.holidays.includes(dateStr);
            const isSunday = new Date(year, month, day).getDay() === 0;
            
            return (
              <button
                key={day}
                onClick={() => toggleHoliday(dateStr)}
                className={`p-3 rounded-lg flex flex-col items-center justify-center border transition-colors ${
                  isHoliday 
                    ? "bg-red-500/20 border-red-500/50 text-red-200" 
                    : isSunday 
                      ? "bg-[#171717] border-[#333] text-gray-500 opacity-50 cursor-not-allowed" 
                      : "bg-[#1a1a1a] border-[#262626] text-white hover:border-indigo-500 hover:text-indigo-400 hover:bg-[#262626]"
                }`}
              >
                <span className="text-sm font-bold">{day}</span>
              </button>
            )
          })}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-8 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" /></div>;

  return (
    <div className="space-y-6">
      
      <div className="bg-gradient-to-br from-[#0c0f16] to-[#040609] p-4 rounded-xl border border-indigo-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center p-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20">
              <Settings className="w-5 h-5 text-indigo-400" />
            </span>
            <h3 className="text-sm font-semibold text-white font-sans">Pengaturan Operasional Bengkel</h3>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed font-mono">
            Konfigurasi kapasitas produksi dan kalender kerja untuk menunjang akurasi dekomposisi waktu dan AI Analisis.
          </p>
        </div>
        
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded flex items-center gap-2 transition"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Simpan Pengaturan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Detail Kapasitas */}
        <div className="bg-[#111111] border border-[#222] p-6 rounded-xl space-y-6 flex-1">
          <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#262626] pb-3">
            <Building className="w-4 h-4 text-indigo-400" /> Parameter Produksi
          </h4>
          
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-bold tracking-widest uppercase">
                 Jumlah Mekanik / Tukang Aktif
              </label>
              <div className="relative">
                <Users className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                <input 
                  type="number"
                  value={settings.mechanicsCount}
                  onChange={(e) => setSettings({...settings, mechanicsCount: Number(e.target.value)})}
                  className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg pl-10 pr-4 py-2 text-white focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-bold tracking-widest uppercase">
                 Jumlah Oven / Spraybooth
              </label>
              <div className="relative">
                <Building className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
                <input 
                  type="number"
                  value={settings.sprayboothsCount}
                  onChange={(e) => setSettings({...settings, sprayboothsCount: Number(e.target.value)})}
                  className="w-full bg-[#1a1a1a] border border-[#262626] rounded-lg pl-10 pr-4 py-2 text-white focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>
          </div>
          
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-200/80 text-xs rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p>Parameter ini akan digunakan oleh matriks Backend AI untuk menyarankan batasan kapasitas (bottlenecks) dalam analisis pareto.</p>
          </div>
        </div>

        {/* Kalender Libur */}
        <div className="flex-1">
          {renderCalendar()}
        </div>

      </div>

      {/* Zona Risiko Tinggi - Pengelolaan Database */}
      <div id="db-danger-zone" className="bg-[#111111]/90 border border-red-950/40 p-6 rounded-xl space-y-4">
        <h4 className="text-sm font-bold text-red-400 flex items-center gap-2 border-b border-red-950 pb-3">
          <Database className="w-4 h-4 text-red-500" /> Pengelolaan Database & Manajemen Data
        </h4>

        {dbMessage && (
          <div className={`p-3 rounded-lg text-xs font-mono border ${
            dbMessage.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
              : "bg-red-500/10 border-red-500/20 text-red-300"
          }`}>
            {dbMessage.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Kosongkan Database */}
          <div className="p-4 bg-red-950/5 border border-red-950/25 rounded-lg space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full font-mono font-bold tracking-wider uppercase">High Risk Zone</span>
              <h5 className="text-xs font-bold text-white uppercase tracking-wider font-sans mt-2">Kosongkan Seluruh Database</h5>
              <p className="text-xs text-gray-400 font-mono leading-relaxed">
                Tindakan ini akan menghapus semua record transaksi body repair yang ada di dalam server memori. Seluruh visualisasi dashboard dan model analisis AI akan menjadi kosong sampai data baru diunggah.
              </p>
            </div>
            
            {!showClearConfirm ? (
              <button
                onClick={() => {
                  setShowClearConfirm(true);
                  setShowResetConfirm(false);
                }}
                disabled={dbLoading}
                className="w-full text-center px-3 py-2 bg-red-950/40 border border-red-800/50 hover:bg-red-900 hover:text-white rounded text-red-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" /> Kosongkan Database
              </button>
            ) : (
              <div className="p-3 bg-red-500/10 border border-red-500/10 rounded-lg space-y-2.5">
                <p className="text-[11px] text-red-300 font-bold flex items-center gap-1 uppercase tracking-wider">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" /> Konfirmasi Tindakan Berisiko Tinggi!
                </p>
                <p className="text-[10px] text-gray-300 font-mono leading-relaxed">
                  Ketik <span className="font-bold underline text-red-400">HAPUS</span> untuk mengonfirmasi penghapusan permanen secara permanen.
                </p>
                <input 
                  type="text"
                  placeholder="Ketik HAPUS..."
                  id="confirm-delete-input"
                  className="w-full bg-[#1a1a1a] border border-red-850/40 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-red-500"
                  onChange={(e) => {
                    if (e.target.value === "HAPUS") {
                      handleClearDatabase();
                      e.target.value = "";
                    }
                  }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2.5 py-1 bg-[#222] hover:bg-[#333] border border-[#262626] rounded text-gray-400 text-[10px] hover:text-white"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Isi Ulang Data Simulasi */}
          <div className="p-4 bg-indigo-950/5 border border-indigo-950/20 rounded-lg space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-0.5 rounded-full font-mono font-bold tracking-wider uppercase">Exploration Tool</span>
              <h5 className="text-xs font-bold text-white uppercase tracking-wider font-sans mt-2">Muat Professional Seed Data</h5>
              <p className="text-xs text-gray-400 font-mono leading-relaxed">
                Tindakan ini akan mengisi ulang database memori dengan 60 record transaksi fiktif tetapi realistis (Tahun 2025 s.d 2026). Berguna untuk mendemonstrasikan kapabilitas analisis trend keuangan dan deteksi bottleneck AI.
              </p>
            </div>

            {!showResetConfirm ? (
              <button
                onClick={() => {
                  setShowResetConfirm(true);
                  setShowClearConfirm(false);
                }}
                disabled={dbLoading}
                className="w-full text-center px-4 py-2 bg-indigo-950/40 border border-indigo-800/40 hover:bg-indigo-900 hover:text-white rounded text-indigo-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${dbLoading ? "animate-spin" : ""}`} /> Muat Data Simulasi
              </button>
            ) : (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/10 rounded-lg space-y-2.5">
                <p className="text-[11px] text-indigo-300 font-bold flex items-center gap-1 uppercase tracking-wider text-glow-cyan">
                  <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Konfirmasi Muat Data Simulasi
                </p>
                <p className="text-[10px] text-gray-300 font-mono leading-relaxed">
                  Semua record yang terunggah saat ini akan diganti oleh seed data. Apakah Anda yakin ingin memuat ulang data simulasi?
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-2.5 py-1 bg-[#121212] hover:bg-[#1a1a1a] border border-[#262626] rounded text-gray-400 text-[10px] hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleLoadSeedData}
                    disabled={dbLoading}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold"
                  >
                    Ya, Muat Seed
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
