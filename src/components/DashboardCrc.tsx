import React, { useMemo } from 'react';
import { CrcRecord } from '../types';
import { PhoneCall, DoorOpen, Users, PhoneOff, AlertCircle, TrendingUp, Headset } from 'lucide-react';

interface DashboardCrcProps {
  crcRecords: CrcRecord[];
  activeMonthName: string;
  activeYear: number;
  activeWeek: number | "ALL";
}

export default function DashboardCrc({ crcRecords, activeMonthName, activeYear, activeWeek }: DashboardCrcProps) {
  
  const stats = useMemo(() => {
    let totalOutbondCall = 0;
    let totalUnitEntry = 0;

    let detailSpk = 0;
    let detailOutbond = 0;
    let detailAfterService = 0;
    let detailInvalid = 0;
    let detailComplain = 0;
    let detailProspek = 0;

    let detailBooking = 0;
    let detailWalkIn = 0;

    for (const r of crcRecords) {
      const outbondSum = 
        r.jumlahSpkAsuransi + 
        r.outbondCall + 
        r.outbondAfterService + 
        r.numberPhoneInvalid + 
        r.costumerComplain + 
        r.outbondProspekAsuransi;
        
      const entrySum = r.unitBooking + r.unitWalkIn;

      totalOutbondCall += outbondSum;
      totalUnitEntry += entrySum;

      detailSpk += r.jumlahSpkAsuransi;
      detailOutbond += r.outbondCall;
      detailAfterService += r.outbondAfterService;
      detailInvalid += r.numberPhoneInvalid;
      detailComplain += r.costumerComplain;
      detailProspek += r.outbondProspekAsuransi;

      detailBooking += r.unitBooking;
      detailWalkIn += r.unitWalkIn;
    }

    return {
      totalOutbondCall,
      totalUnitEntry,
      detailSpk,
      detailOutbond,
      detailAfterService,
      detailInvalid,
      detailComplain,
      detailProspek,
      detailBooking,
      detailWalkIn
    };
  }, [crcRecords]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white font-sans tracking-tight">Dashboard KPI CRC</h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Periode: {activeMonthName} {activeYear} {activeWeek !== "ALL" ? `(Minggu ${activeWeek})` : "(Seluruh Minggu)"}
          </p>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* TOTAL OUTBOND CALL CARD */}
        <div className="relative overflow-hidden bg-[#111]/80 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(79,70,229,0.15)] group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition duration-500">
            <PhoneCall className="w-32 h-32 text-indigo-500" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 mb-2">
                <Headset className="w-5 h-5" />
                <h3 className="font-bold tracking-widest text-xs uppercase">Total Outbond Call</h3>
              </div>
              <div className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">
                {stats.totalOutbondCall.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-indigo-500/20 grid grid-cols-3 gap-2">
              <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                <div className="text-[9px] text-gray-500 uppercase">SPK</div>
                <div className="text-sm font-bold text-indigo-300">{stats.detailSpk}</div>
              </div>
              <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                <div className="text-[9px] text-gray-500 uppercase">Reguler</div>
                <div className="text-sm font-bold text-indigo-300">{stats.detailOutbond}</div>
              </div>
              <div className="bg-black/20 p-2 rounded-lg border border-white/5">
                <div className="text-[9px] text-gray-500 uppercase">After Svc</div>
                <div className="text-sm font-bold text-indigo-300">{stats.detailAfterService}</div>
              </div>
            </div>
          </div>
        </div>

        {/* TOTAL UNIT ENTRY CARD */}
        <div className="relative overflow-hidden bg-[#111]/80 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 shadow-[0_8px_32px_0_rgba(16,185,129,0.15)] group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition duration-500">
            <DoorOpen className="w-32 h-32 text-emerald-500" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Users className="w-5 h-5" />
                <h3 className="font-bold tracking-widest text-xs uppercase">Unit Entry</h3>
              </div>
              <div className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">
                {stats.totalUnitEntry.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-emerald-500/20 grid grid-cols-2 gap-4">
              <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Booking</div>
                <div className="text-lg font-black text-emerald-300">{stats.detailBooking}</div>
              </div>
              <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex justify-between items-center">
                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Walk-in</div>
                <div className="text-lg font-black text-emerald-300">{stats.detailWalkIn}</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* SECONDARY METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-[#151515] p-4 rounded-xl border border-[#2a2a2a] flex items-center gap-4 hover:bg-[#1a1a1a] transition">
          <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <PhoneOff className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Phone Invalid</div>
            <div className="text-xl font-bold text-red-100">{stats.detailInvalid.toLocaleString('id-ID')}</div>
          </div>
        </div>

        <div className="bg-[#151515] p-4 rounded-xl border border-[#2a2a2a] flex items-center gap-4 hover:bg-[#1a1a1a] transition">
          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <AlertCircle className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Customer Complain</div>
            <div className="text-xl font-bold text-orange-100">{stats.detailComplain.toLocaleString('id-ID')}</div>
          </div>
        </div>

        <div className="bg-[#151515] p-4 rounded-xl border border-[#2a2a2a] flex items-center gap-4 hover:bg-[#1a1a1a] transition">
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Prospek Asuransi</div>
            <div className="text-xl font-bold text-blue-100">{stats.detailProspek.toLocaleString('id-ID')}</div>
          </div>
        </div>

      </div>

    </div>
  );
}
