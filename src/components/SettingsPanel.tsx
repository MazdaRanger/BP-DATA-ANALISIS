import React, { useState, useEffect } from "react";
import { Settings, Save, Calendar as CalendarIcon, Users, Building, Info, AlertTriangle, RefreshCw, Database, Trash2, ShieldAlert, UserPlus, Mail, Lock, Shield } from "lucide-react";
import { AppSettings, BodyRepairRecord } from "../types";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDocs, getDoc, collection, writeBatch } from "firebase/firestore";
import { db, firebaseConfig } from "../lib/firebaseConfig";

interface SettingsPanelProps {
  onDatabaseChanged?: () => void;
}

// Temporary Firebase app to create users without logging out the current super admin
const secondaryApp = getApps().find(app => app.name === "SecondaryApp") || initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

export default function SettingsPanel({ onDatabaseChanged }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AppSettings>({ mechanicsCount: 15, sprayboothsCount: 4, holidays: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Database control states
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbMessage, setDbMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Registration states
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user"|"super_admin">("user");
  const [regLoading, setRegLoading] = useState(false);
  const [regMessage, setRegMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Date picker state
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5)); // default to June 2026
  
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const settingsDoc = await getDoc(doc(db, "system_config", "settings"));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data() as AppSettings;
        setSettings(data);
        // Simpan ke localStorage sebagai cache lokal
        localStorage.setItem("bp_app_settings", JSON.stringify(data));
      } else {
        // Coba muat dari localStorage jika belum ada di Firestore
        const cached = localStorage.getItem("bp_app_settings");
        if (cached) setSettings(JSON.parse(cached));
      }
    } catch (e) {
      console.error("fetchSettings error:", e);
      // Fallback ke localStorage jika Firestore tidak bisa dijangkau
      const cached = localStorage.getItem("bp_app_settings");
      if (cached) {
        try { setSettings(JSON.parse(cached)); } catch {}
      }
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
      // Selalu simpan ke localStorage sebagai cache lokal (tidak pernah gagal)
      localStorage.setItem("bp_app_settings", JSON.stringify(settings));

      // Simpan ke Firestore sebagai operasi utama cloud
      await setDoc(doc(db, "system_config", "settings"), settings);

      // Sinkronisasi ke backend server (best-effort, tidak memblokir sukses utama)
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings)
        });
      } catch (syncErr) {
        console.warn("Sinkronisasi backend server gagal (non-kritis):", syncErr);
      }

      alert("Pengaturan Berhasil Disimpan");
    } catch (e: any) {
      console.error("saveSettings Firestore error:", e);
      // Meskipun Firestore gagal, settings sudah tersimpan di localStorage
      // Tampilkan error spesifik untuk diagnosa
      const errMsg = e?.message || e?.code || String(e);
      alert(`Gagal menyimpan ke cloud Firestore.\nError: ${errMsg}\n\nPengaturan telah disimpan sementara di perangkat ini (localStorage).`);
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegMessage(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail, newUserPassword);
      const uid = userCredential.user.uid;
      
      // Store the user role in firestore main app db
      await setDoc(doc(db, "users", uid), {
        email: newUserEmail,
        role: newUserRole,
        createdAt: new Date().toISOString()
      });

      // We sign out the secondary app purely to clean its internal state state
      await secondaryAuth.signOut();
      
      setRegMessage({ type: "success", text: `Pengguna ${newUserEmail} berhasil dibuat sebagai ${newUserRole}!` });
      setNewUserEmail("");
      setNewUserPassword("");
    } catch (err: any) {
      setRegMessage({ type: "error", text: err.message || "Gagal membuat pengguna baru." });
    } finally {
      setRegLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    setDbLoading(true);
    setDbMessage(null);
    try {
      const existingSnap = await getDocs(collection(db, "body_repair_records"));
      const batchClear = writeBatch(db);
      existingSnap.docs.forEach((docSnap) => batchClear.delete(docSnap.ref));
      await batchClear.commit();

      setDbMessage({ type: "success", text: "Database berhasil dikosongkan secara permanen!" });
      if (onDatabaseChanged) onDatabaseChanged();
    } catch (e: any) {
      setDbMessage({ type: "error", text: e.message || "Gagal mengosongkan database." });
    } finally {
      setDbLoading(false);
      setShowClearConfirm(false);
    }
  };

  const handleLoadSeedData = async () => {
    setDbLoading(true);
    setDbMessage(null);
    try {
      // Create some pseudo-random realistic records for last 3 months
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
           batchInsert.set(docRef, record);
        });
        await batchInsert.commit();
      }

      setDbMessage({ type: "success", text: "Data simulasi profesional berhasil dimuat!" });
      if (onDatabaseChanged) onDatabaseChanged();
    } catch (e: any) {
      setDbMessage({ type: "error", text: e.message || "Gagal menghubungi server database." });
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

      {/* Futuristic User Registration for Super Admin */}
      <div className="bg-[#111111]/90 border border-indigo-950/40 p-6 rounded-xl space-y-4">
        <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2 border-b border-indigo-950/60 pb-3">
          <UserPlus className="w-4 h-4" /> Manajemen Pengguna Sistem Baru
        </h4>
        
        {regMessage && (
          <div className={`p-3 rounded-lg text-xs font-mono border ${
            regMessage.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            {regMessage.text}
          </div>
        )}

        <form onSubmit={handleRegisterUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase pl-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="email"
                required
                value={newUserEmail}
                onChange={e => setNewUserEmail(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg py-2 pl-9 pr-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="ops@system.com"
              />
            </div>
          </div>
          
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase pl-1">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="password"
                required
                minLength={6}
                value={newUserPassword}
                onChange={e => setNewUserPassword(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg py-2 pl-9 pr-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-1">
            <label className="text-[10px] text-gray-400 font-bold tracking-widest uppercase pl-1">Akses Role</label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <select 
                value={newUserRole}
                onChange={e => setNewUserRole(e.target.value as "user"|"super_admin")}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg py-2 pl-9 pr-3 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="user">Standard User</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>

          <button 
            type="submit"
            disabled={regLoading}
            className="md:col-span-1 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {regLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Daftarkan User
          </button>
        </form>
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

