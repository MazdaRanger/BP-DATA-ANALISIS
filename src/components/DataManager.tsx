import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';
import { BodyRepairRecord } from '../types';
import { Trash2, Edit2, Search, X, Check } from 'lucide-react';

export default function DataManager() {
  const [records, setRecords] = useState<BodyRepairRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BodyRepairRecord>>({});

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'body_repair_records'));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BodyRepairRecord));
      // Sort by date descending
      data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setRecords(data);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus record ini?')) return;
    try {
      await deleteDoc(doc(db, 'body_repair_records', id));
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Gagal menghapus data.');
    }
  };

  const handleEdit = (record: BodyRepairRecord) => {
    setEditingId(record.id);
    setEditForm({ ...record });
  };

  const handleSave = async (id: string) => {
    try {
      await updateDoc(doc(db, 'body_repair_records', id), {
        tanggal: editForm.tanggal,
        week: Number(editForm.week),
        asuransi: editForm.asuransi,
        wilayah: editForm.wilayah,
        jasa_nett: Number(editForm.jasaNett),
        part_material_nett: Number(editForm.partMaterialNett),
        expenses_bahan: Number(editForm.expensesBahan),
        hpp_part_material: Number(editForm.hppPartMaterial),
        spkl: Number(editForm.spkl),
        jumlah_panel: Number(editForm.jumlahPanel)
      });
      
      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...editForm } as BodyRepairRecord : r));
      setEditingId(null);
    } catch (error) {
      console.error('Error updating record:', error);
      alert('Gagal menyimpan data.');
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.asuransi && r.asuransi.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.wilayah && r.wilayah.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [records, searchTerm]);

  if (loading) {
    return <div className="p-8 text-center text-gray-400 font-mono">Memuat data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
        <div>
          <h2 className="text-xl font-bold text-white font-sans">Manajemen Data</h2>
          <p className="text-xs text-gray-400 font-mono">Edit atau hapus record keuangan dan pemetaan AI.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
          <input 
            type="text" 
            placeholder="Cari ID, Asuransi, Wilayah..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded-lg pl-9 pr-3 py-2 text-white text-xs focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#1a1a1a] text-gray-400 border-b border-[#222]">
            <tr>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Tipe / ID</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Tanggal</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Minggu</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Asuransi / Wilayah</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Jasa / Part</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {filteredRecords.map(record => {
              const isEditing = editingId === record.id;
              const isMapping = record.id.startsWith('MAP-');

              return (
                <tr key={record.id} className="hover:bg-[#151515] transition-colors">
                  <td className="px-4 py-3">
                    {isMapping ? (
                      <span className="px-2 py-1 bg-indigo-900/30 text-indigo-400 rounded text-[10px]">MAPPING AI</span>
                    ) : (
                      <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-[10px]">FINANCIAL</span>
                    )}
                    <div className="text-[9px] text-gray-600 mt-1 truncate max-w-[100px]" title={record.id}>{record.id}</div>
                  </td>
                  
                  <td className="px-4 py-3 text-gray-300">
                    {isEditing ? (
                      <input type="date" value={editForm.tanggal || ''} onChange={e => setEditForm({...editForm, tanggal: e.target.value})} className="bg-[#222] border border-[#444] rounded px-2 py-1 w-28 text-white" />
                    ) : (
                      record.tanggal
                    )}
                  </td>
                  
                  <td className="px-4 py-3 text-gray-300">
                    {isEditing ? (
                      <input type="number" min="1" max="5" value={editForm.week || 1} onChange={e => setEditForm({...editForm, week: Number(e.target.value)})} className="bg-[#222] border border-[#444] rounded px-2 py-1 w-12 text-white" />
                    ) : (
                      `W${record.week}`
                    )}
                  </td>
                  
                  <td className="px-4 py-3 text-gray-300 space-y-1">
                    {isEditing ? (
                      <>
                        <input type="text" value={editForm.asuransi || ''} onChange={e => setEditForm({...editForm, asuransi: e.target.value})} className="bg-[#222] border border-[#444] rounded px-2 py-1 w-full text-[10px] mb-1 block text-white" placeholder="Asuransi" />
                        <input type="text" value={editForm.wilayah || ''} onChange={e => setEditForm({...editForm, wilayah: e.target.value})} className="bg-[#222] border border-[#444] rounded px-2 py-1 w-full text-[10px] block text-white" placeholder="Wilayah" />
                      </>
                    ) : (
                      <>
                        <div className="font-semibold text-white">{record.asuransi || '-'}</div>
                        <div className="text-[10px] text-gray-500">{record.wilayah || '-'}</div>
                      </>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 text-right text-gray-300">
                    {isEditing ? (
                      <>
                        <input type="number" value={editForm.jasaNett !== undefined ? editForm.jasaNett : ''} onChange={e => setEditForm({...editForm, jasaNett: Number(e.target.value)})} className="bg-[#222] border border-[#444] rounded px-2 py-1 w-20 text-[10px] mb-1 ml-auto block text-white" placeholder="Jasa" />
                        <input type="number" value={editForm.partMaterialNett !== undefined ? editForm.partMaterialNett : ''} onChange={e => setEditForm({...editForm, partMaterialNett: Number(e.target.value)})} className="bg-[#222] border border-[#444] rounded px-2 py-1 w-20 text-[10px] ml-auto block text-white" placeholder="Part" />
                      </>
                    ) : (
                      <>
                        <div>{record.jasaNett?.toLocaleString('id-ID')}</div>
                        <div className="text-[10px] text-gray-500">{record.partMaterialNett?.toLocaleString('id-ID')}</div>
                      </>
                    )}
                  </td>
                  
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => handleSave(record.id)} className="p-1.5 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/60 rounded transition" title="Simpan">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-800 text-gray-400 hover:bg-gray-700 rounded transition" title="Batal">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(record)} className="p-1.5 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/60 rounded transition" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(record.id)} className="p-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/60 rounded transition" title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Tidak ada data ditemukan.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
