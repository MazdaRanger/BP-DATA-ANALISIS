import React, { useState, useEffect } from "react";
import { Settings, Save, Calendar as CalendarIcon, Users, Building, Info, AlertTriangle, RefreshCw } from "lucide-react";
import { AppSettings } from "../types.js";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>({ mechanicsCount: 15, sprayboothsCount: 4, holidays: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
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

    </div>
  )
}
