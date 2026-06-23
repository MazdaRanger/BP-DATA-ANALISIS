import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Zap, Activity } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Background futuristic elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-[#222] backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-indigo-400" />
          <span className="font-bold text-xl tracking-tight italic">BodyRepair<span className="text-indigo-400">.AI</span></span>
        </div>
        <button 
          onClick={() => navigate('/login')}
          className="px-5 py-2 text-sm font-semibold rounded-full border border-[#333] hover:border-indigo-500 hover:text-indigo-400 transition-colors bg-[#111]"
        >
          System Access
        </button>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium tracking-wide">
            <Zap className="w-3.5 h-3.5" /> Next-Gen Analytics Core
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
            Master Your Workflow with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-500">Precision</span>.
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            The ultimate AI-driven dashboard for body repair metrics and Pareto problem analysis. Built for automotive enterprise.
          </p>
          <button 
            onClick={() => navigate('/login')}
            className="px-8 py-3.5 text-sm font-bold uppercase tracking-wider rounded bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)]"
          >
            Initialize Core
          </button>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto w-full">
          {[
            { title: "Real-Time Sync", desc: "Live memory sandbox & cloud synchronization.", icon: Zap },
            { title: "AI Diagnostics", desc: "Automated symptom trees and logic branching.", icon: Activity },
            { title: "Secure Vault", desc: "Enterprise-grade role access controls.", icon: Shield },
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: i * 0.2 }}
              className="p-6 rounded-xl border border-[#222] bg-[#111]/50 backdrop-blur-sm text-left"
            >
              <feature.icon className="w-8 h-8 text-indigo-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
