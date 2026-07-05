import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, setDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';
import { KanbanRecord, KanbanStatus } from '../types';
import { Plus, ChevronLeft, ChevronRight, LayoutDashboard, Truck, Trash2, Settings2 } from 'lucide-react';

const ADMIN_STATUSES: KanbanStatus[] = [
  "Penerimaan SPK",
  "Estimasi Biaya",
  "Banding Asuransi"
];

const PROD_STATUSES: KanbanStatus[] = [
  "Bongkar",
  "Las Ketok",
  "Dempul",
  "Antri Cat (Mixing)",
  "Cat",
  "Poles",
  "Pemasangan",
  "Finishing & QC",
  "Kendaraan Siap Di Ambil",
  "Kendaraan Keluar Rawat Jalan"
];

const ALL_STATUSES = [...ADMIN_STATUSES, ...PROD_STATUSES];

export default function KanbanBoard() {
  const [records, setRecords] = useState<KanbanRecord[]>([]);
  const [mode, setMode] = useState<"ADMIN" | "PROD">("ADMIN");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCard, setNewCard] = useState<Partial<KanbanRecord>>({
    noSpk: '',
    nopol: '',
    kendaraan: '',
    asuransi: 'Personal',
    status: 'Penerimaan SPK'
  });

  useEffect(() => {
    // Realtime listener for kanban records
    const unsub = onSnapshot(collection(db, 'kanban_records'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as KanbanRecord));
      // Sort by updatedAt descending
      data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setRecords(data);
    });
    return () => unsub();
  }, []);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = `KNB-${Date.now()}`;
      const record: KanbanRecord = {
        id,
        noSpk: newCard.noSpk || 'SPK-???',
        nopol: newCard.nopol || '-',
        kendaraan: newCard.kendaraan || '-',
        asuransi: newCard.asuransi || 'Personal',
        status: newCard.status as KanbanStatus || 'Penerimaan SPK',
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'kanban_records', id), record);
      setShowAddForm(false);
      setNewCard({ noSpk: '', nopol: '', kendaraan: '', asuransi: 'Personal', status: mode === 'ADMIN' ? 'Penerimaan SPK' : 'Bongkar' });
    } catch (err) {
      console.error(err);
      alert("Gagal menambah data!");
    }
  };

  const moveCard = async (id: string, currentStatus: KanbanStatus, direction: "LEFT" | "RIGHT") => {
    const currentIndex = ALL_STATUSES.indexOf(currentStatus);
    let newIndex = currentIndex;
    if (direction === "LEFT" && currentIndex > 0) newIndex--;
    if (direction === "RIGHT" && currentIndex < ALL_STATUSES.length - 1) newIndex++;

    if (newIndex !== currentIndex) {
      const nextStatus = ALL_STATUSES[newIndex];
      try {
        await updateDoc(doc(db, 'kanban_records', id), {
          status: nextStatus,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error(err);
        alert("Gagal memindahkan kartu!");
      }
    }
  };

  const deleteCard = async (id: string) => {
    if (!window.confirm("Hapus tiket kendaraan ini?")) return;
    try {
      await deleteDoc(doc(db, 'kanban_records', id));
    } catch (err) {
      console.error(err);
    }
  };

  const activeStatuses = mode === "ADMIN" ? ADMIN_STATUSES : PROD_STATUSES;

  return (
    <div className="space-y-6 h-[calc(100vh-160px)] flex flex-col">
      {/* HEADER & TOGGLE */}
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white font-sans">Papan Kanban</h2>
          <p className="text-xs text-gray-400 font-mono">Pantau progres outstanding SPK secara visual.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-[#111] p-1 rounded-lg border border-[#222]">
            <button
              onClick={() => setMode("ADMIN")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition ${mode === "ADMIN" ? "bg-indigo-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Administrasi
            </button>
            <button
              onClick={() => setMode("PROD")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition ${mode === "PROD" ? "bg-emerald-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
            >
              <Truck className="w-4 h-4" /> Produksi
            </button>
          </div>
          
          <button
            onClick={() => {
              setNewCard(prev => ({ ...prev, status: mode === "ADMIN" ? "Penerimaan SPK" : "Bongkar" }));
              setShowAddForm(true);
            }}
            className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-lg text-xs font-bold transition"
          >
            <Plus className="w-4 h-4" /> Tambah SPK
          </button>
        </div>
      </div>

      {/* BOARD CONTAINER */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[#0c0c0c] rounded-xl border border-[#222] p-4 flex gap-4 snap-x">
        {activeStatuses.map(status => {
          const colCards = records.filter(r => r.status === status);
          return (
            <div key={status} className="w-72 shrink-0 flex flex-col h-full bg-[#151515]/60 backdrop-blur-md rounded-xl border border-white/5 snap-start shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
              {/* Column Header */}
              <div className="p-3 border-b border-white/10 bg-gradient-to-r from-white/5 to-transparent rounded-t-xl flex justify-between items-center shrink-0">
                <h3 className="font-bold text-sm text-gray-200 drop-shadow-md">{status}</h3>
                <span className="text-[10px] font-mono bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded text-gray-300 border border-white/10 shadow-inner">{colCards.length}</span>
              </div>
              
              {/* Cards Container */}
              <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                {colCards.map(card => {
                  const currentIndex = ALL_STATUSES.indexOf(card.status);
                  const isFirst = currentIndex === 0;
                  const isLast = currentIndex === ALL_STATUSES.length - 1;

                  return (
                    <div key={card.id} className="bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_4px_16px_0_rgba(0,0,0,0.2)] rounded-xl p-3 group relative hover:border-indigo-500/50 hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_0_rgba(79,70,229,0.15)] transition-all duration-300">
                      <button onClick={() => deleteCard(card.id)} className="absolute top-2 right-2 p-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-md opacity-0 group-hover:opacity-100 transition shadow-sm backdrop-blur-sm border border-red-500/20">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      
                      <div className="text-[10px] font-bold text-indigo-400 tracking-wider mb-0.5 opacity-90">{card.noSpk}</div>
                      <div className="text-sm font-semibold text-gray-100 mb-2 drop-shadow-sm">{card.nopol} <span className="text-gray-500 font-normal mx-1">|</span> {card.kendaraan}</div>
                      <div className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 inline-block px-2 py-1 rounded border border-indigo-500/20 backdrop-blur-sm shadow-inner">
                        {card.asuransi}
                      </div>

                      <div className="mt-4 flex justify-between items-center border-t border-white/10 pt-3">
                        <button 
                          onClick={() => moveCard(card.id, card.status, "LEFT")}
                          disabled={isFirst}
                          className="p-1.5 text-gray-400 bg-black/20 rounded-md hover:text-white hover:bg-black/40 border border-white/5 disabled:opacity-30 transition"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-[9px] text-gray-400/70 font-mono tracking-wider">{new Date(card.updatedAt).toLocaleDateString('id-ID')}</span>
                        <button 
                          onClick={() => moveCard(card.id, card.status, "RIGHT")}
                          disabled={isLast}
                          className="p-1.5 text-gray-400 bg-black/20 rounded-md hover:text-white hover:bg-black/40 border border-white/5 disabled:opacity-30 transition"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD CARD MODAL */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-[#222] rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-white mb-4">Tambah Kendaraan Outstanding</h3>
            <form onSubmit={handleAddCard} className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">No SPK</label>
                <input required type="text" value={newCard.noSpk} onChange={e => setNewCard({...newCard, noSpk: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Nopol</label>
                  <input required type="text" value={newCard.nopol} onChange={e => setNewCard({...newCard, nopol: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Mobil</label>
                  <input required type="text" value={newCard.kendaraan} onChange={e => setNewCard({...newCard, kendaraan: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Asuransi / Pelanggan</label>
                <input required type="text" value={newCard.asuransi} onChange={e => setNewCard({...newCard, asuransi: e.target.value})} className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Status Awal</label>
                <select value={newCard.status} onChange={e => setNewCard({...newCard, status: e.target.value as KanbanStatus})} className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none">
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-2 bg-[#222] hover:bg-[#333] text-white rounded-lg text-xs font-bold transition">Batal</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
