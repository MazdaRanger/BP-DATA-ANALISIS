/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { BodyRepairRecord, MetricSummary, ParetoItem, AlternativeSolution, QuantitativeMatrix, ProblemAnalysisResponse, LogicTreeNode } from "./src/types.js";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = 3000;

// Initialize Gemini API client if key exists
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Memory database with realistic Indonesian body repair data (60 entries across 2025 and 2026 for rich statistical Y2Y/M2M comparison)
let recordsDatabase: BodyRepairRecord[] = [];

// Seed Data Generator Helper
function generateSeedData(): BodyRepairRecord[] {
  const years = [2025, 2026];
  const months = [4, 5, 6]; // April, May, June (M2M and Y2Y comparisons)
  const insurances = ["Astra Garda Oto", "ACA Asuransi", "Sinar Mas", "Adira Insurance", "Allianz", "Personal (Umum)"];
  const regions = ["Jakarta Selatan", "Jakarta Barat", "Tangerang Kota", "Bekasi Barat", "Depok Margonda", "Sleman (DIY)", "Surabaya Timur"];
  
  const seeds: BodyRepairRecord[] = [];
  let idCounter = 1;

  for (const year of years) {
    for (const month of months) {
      // In 2026, we introduce specific cost overruns to trigger realistic Pareto & Logic Tree analysis:
      // e.g. June 2026 has a massive spike in SPKL (Subcontractor) and HPP Spareparts, depressing Gross Profit.
      const isOverrunMonth = (year === 2026 && month === 6);
      const isHealthyMonth = (year === 2025 && month === 6);

      for (let week = 1; week <= 5; week++) {
        // Average 3-4 records per week
        const recordsInWeek = week === 5 ? 2 : 4; // Week 5 usually has fewer business days
        for (let i = 0; i < recordsInWeek; i++) {
          const day = Math.min(28, (week - 1) * 7 + Math.floor(Math.random() * 6) + 1);
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          
          const asuransi = insurances[Math.floor(Math.random() * insurances.length)];
          const wilayah = regions[Math.floor(Math.random() * regions.length)];
          
          // Generate typical body repair figures (in Rupiah IDR)
          // Average panel count per job: 1 - 10 panels
          const jumlahPanel = Math.floor(Math.random() * 6) + 1;
          
          let jasaNett = jumlahPanel * (750000 + Math.floor(Math.random() * 150000));
          let partMaterialNett = jumlahPanel * (400000 + Math.floor(Math.random() * 100000));
          
          // Cost allocations
          let expensesBahanMultiplier = 0.18; // 18% of jasa on average for paints/putty
          let hppPartMultiplier = 0.45; // 45% of part sales typical cost of parts
          let spklCost = 0; // Outsourced services (e.g. radiator repair/special alignment)

          if (isOverrunMonth) {
            // Introduce problems client requested to analyze:
            // 1. High HPP Parts & Materials
            // 2. High SPKL (Jasa Pekerjaan Luar)
            // 3. High Expenses Bahan
            expensesBahanMultiplier = 0.28; // paint wastage
            hppPartMultiplier = 0.62; // expensive vendor pricing
            if (Math.random() > 0.4) {
              spklCost = Math.floor(Math.random() * 1500000) + 500000; // Big SPKL spike
            }
          } else if (isHealthyMonth) {
            // Very low subcontracts, efficient parts
            expensesBahanMultiplier = 0.14;
            hppPartMultiplier = 0.38;
            if (Math.random() > 0.8) {
              spklCost = Math.floor(Math.random() * 300000);
            }
          } else {
            // Normal operation
            expensesBahanMultiplier = 0.17 + Math.random() * 0.04;
            hppPartMultiplier = 0.42 + Math.random() * 0.06;
            if (Math.random() > 0.6) {
              spklCost = Math.floor(Math.random() * 500000) + 150000;
            }
          }

          const expensesBahan = Math.round(jasaNett * expensesBahanMultiplier);
          const hppPartMaterial = Math.round(partMaterialNett * hppPartMultiplier);

          seeds.push({
            id: `INV-${year}-${month}-${String(idCounter++).padStart(4, "0")}`,
            tanggal: dateStr,
            week,
            noSpk: `SPK-${year}-${month}-${String(100 + idCounter).slice(1)}`,
            asuransi,
            jasaNett,
            partMaterialNett,
            expensesBahan,
            hppPartMaterial,
            spkl: spklCost,
            jumlahPanel,
            wilayah
          });
        }
      }
    }
  }

  return seeds;
}

// Initial seed
recordsDatabase = generateSeedData();

// API REST 
app.get("/api/records", (req, res) => {
  res.json(recordsDatabase);
});

app.post("/api/records/bulk", (req, res) => {
  const newRecords: Partial<BodyRepairRecord>[] = req.body;
  if (!Array.isArray(newRecords)) {
    return res.status(400).json({ error: "Input must be a JSON array of records" });
  }

  // Parse and validate each record
  const validated: BodyRepairRecord[] = [];
  for (let i = 0; i < newRecords.length; i++) {
    const item = newRecords[i];
    
    // Attempt standard fallbacks if some values are missing
    const tanggal = typeof item.tanggal === "string" ? item.tanggal : new Date().toISOString().split("T")[0];
    const dateObj = new Date(tanggal);
    
    // Calculate week based on working days (excluding Sundays and settings.holidays)
    let workingDaysCount = 0;
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    for (let day = 1; day <= dateObj.getDate(); day++) {
      const d = new Date(year, month, day);
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (d.getDay() !== 0 && !appSettings.holidays.includes(dateStr)) {
        workingDaysCount++;
      }
    }
    const calculatedWeek = Math.min(5, Math.max(1, Math.ceil(workingDaysCount / 6)));
    
    const resolvedWeek = typeof item.week === "number" && item.week > 0 ? item.week : calculatedWeek;

    const record: BodyRepairRecord = {
      id: item.id || `INV-UPL-${Date.now()}-${i}`,
      tanggal: tanggal,
      week: resolvedWeek,
      noSpk: item.noSpk || `SPK-UPL-${1000 + i}`,
      asuransi: item.asuransi || "Personal",
      jasaNett: Number(item.jasaNett) || 0,
      partMaterialNett: Number(item.partMaterialNett) || 0,
      expensesBahan: Number(item.expensesBahan) || 0,
      hppPartMaterial: Number(item.hppPartMaterial) || 0,
      spkl: Number(item.spkl) || 0,
      jumlahPanel: Number(item.jumlahPanel) || 1,
      wilayah: item.wilayah || "Jakarta"
    };

    validated.push(record);
  }

  // Replace database or prepend
  // In our case we overwrite existing to simulate an "Upload context", 
  // or we can append. Overwriting is better to start a clean analysis on uploaded data.
  recordsDatabase = validated;
  res.json({ message: `Successfully loaded ${validated.length} records into the analyzer!`, recordCount: recordsDatabase.length });
});

app.post("/api/records/reset", (req, res) => {
  recordsDatabase = generateSeedData();
  res.json({ message: "Database reset to professional seed data", recordCount: recordsDatabase.length });
});

// Settings App Config State
let appSettings = {
  mechanicsCount: 15,
  sprayboothsCount: 4,
  holidays: [] as string[]
};

app.get("/api/settings", (req, res) => {
  res.json(appSettings);
});

app.post("/api/settings", (req, res) => {
  const { mechanicsCount, sprayboothsCount, holidays } = req.body;
  if (mechanicsCount !== undefined) appSettings.mechanicsCount = Number(mechanicsCount);
  if (sprayboothsCount !== undefined) appSettings.sprayboothsCount = Number(sprayboothsCount);
  if (Array.isArray(holidays)) appSettings.holidays = holidays;
  res.json({ message: "Settings updated", settings: appSettings });
});

// AI Mapper Endpoint for Excel imports
app.post("/api/ai-mapper", async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: "Gemini API belum dikonfigurasi. Backend AI screening memerlukan API Key!" });
  }

  try {
    const { sampleData } = req.body; // array of up to 5 objects from Excel rows
    const gResult = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `
        Anda adalah asisten data backend pintar. Saya memiliki baris data (format JSON) dari file Excel yang diupload user.
        Anda harus melakukan screening kolom/header yang tersedia di data sample tersebut dan memetakannya ke kunci backend kami.
        
        Kunci yang WAJIB DARI BACKEND:
        - tanggalKey (untuk tanggal transaksi)
        - noSpkKey (untuk nomor SPK/Transaksi)
        - asuransiKey (untuk nama asuransi/pelanggan)
        - jasaNettKey (nominal jasa nett)
        - partMaterialNettKey (nominal nett sparepart & material)
        - expensesBahanKey (nominal expenses/pengeluaran bahan)
        - hppPartMaterialKey (nominal harga pokok penjualan part/material)
        - spklKey (nominal Jasa Pekerjaan Luar/Subkontrak)
        - jumlahPanelKey (jumlah panel / keping perbaikan)
        - wilayahKey (wilayah cabang / asal perbaikan)
        
        Anda juga harus mendeteksi 'dateFormat' dari kolom tanggal yang dipetakan (misalnya: "M/D/YY", "MM-DD-YYYY", "YYYY-MM-DD", "Excel Serial", dll).
        
        Data Sample (beberapa baris):
        ${JSON.stringify(sampleData, null, 2)}
        
        Tugas Anda:
        Amati keys/property names dari Data Sample di atas.
        Hasilkan JSON response berupa pemetaan untuk key yang tepat di setiap variabel backend. Jika tidak ada kolom yang cocok, isi dengan string kosong "".
        Format struktur balasan persis sebagai berikut:
        {
          "tanggalKey": "Nama_Kolom_Di_Sample",
          "noSpkKey": "...",
          "asuransiKey": "...",
          "jasaNettKey": "...",
          "partMaterialNettKey": "...",
          "expensesBahanKey": "...",
          "hppPartMaterialKey": "...",
          "spklKey": "...",
          "jumlahPanelKey": "...",
          "wilayahKey": "...",
          "dateFormat": "MM/DD/YYYY"
        }
        Jangan tambahkan markdown \`\`\`json. Output harus raw JSON object murni.
      `,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const responseText = gResult.text || "{}";
    const mappingConfig = JSON.parse(responseText.trim());
    res.json(mappingConfig);
  } catch (error: any) {
    console.error("AI Mapper Failed:", error);
    res.status(500).json({ error: "Gagal memproses data melalui backend AI AI Studio", message: error.message });
  }
});

// PROBLEM SOLVER ENDPOINT
app.post("/api/analyze", async (req, res) => {
  const { filteredRecords } = req.body;
  const analysisTarget: BodyRepairRecord[] = (filteredRecords && Array.isArray(filteredRecords) && filteredRecords.length > 0)
    ? filteredRecords 
    : recordsDatabase;

  // Let's conduct Algorithmic Backend Analysis:
  // 1. Calculations metrics
  let totalJasa = 0;
  let totalParts = 0;
  let totalBahan = 0; // expenses bahan
  let totalHppParts = 0; // hpp parts dan material
  let totalSpkl = 0;
  let totalPanels = 0;

  for (const r of analysisTarget) {
    totalJasa += r.jasaNett;
    totalParts += r.partMaterialNett;
    totalBahan += r.expensesBahan;
    totalHppParts += r.hppPartMaterial;
    totalSpkl += r.spkl;
    totalPanels += r.jumlahPanel;
  }

  const totalRevenue = totalJasa + totalParts;
  const totalCost = totalBahan + totalHppParts + totalSpkl;
  const totalGrossProfit = totalRevenue - totalCost;
  const grossProfitPercentage = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  // Cost drivers calculations (to feed Pareto)
  const costDrivers = [
    { category: "HPP Sparepart & Material (HPP Parts)", value: totalHppParts },
    { category: "Pengeluaran Bahan Cat & Dempul (Expenses Bahan)", value: totalBahan },
    { category: "Pekerjaan Luar / Subkontraktor Bengkel (SPKL)", value: totalSpkl },
  ].sort((a, b) => b.value - a.value);

  const totalCostDriversSum = costDrivers.reduce((sum, item) => sum + item.value, 0);

  // Formulate Pareto Items
  let cumulativeValue = 0;
  const paretoData: ParetoItem[] = costDrivers.map((item) => {
    const percentage = totalCostDriversSum > 0 ? (item.value / totalCostDriversSum) * 100 : 0;
    cumulativeValue += percentage;
    return {
      category: item.category,
      value: item.value,
      percentage: Number(percentage.toFixed(1)),
      cumulativePercentage: Number(Math.min(100, cumulativeValue).toFixed(1)),
      // Marks item if its presence falls within leading 80% boundary of costs
      isVital: (cumulativeValue - percentage) < 80
    };
  });

  // Calculate most significant cost category
  const topCostCategory = paretoData[0]?.category || "Biaya Direct";

  // Logical Tree Nodes Generation
  const logoTree: LogicTreeNode = {
    id: "gp-leak",
    label: "Optimasi Gross Profit Margin Body & Paint",
    value: `${grossProfitPercentage.toFixed(1)}% GP`,
    details: `Total Revenue: Rp ${totalRevenue.toLocaleString("id-ID")}`,
    children: [
      {
        id: "rev-stream",
        label: "Meningkatkan Arus Pendapatan (Revenue)",
        value: `Rp ${totalRevenue.toLocaleString("id-ID")}`,
        details: "Arus Kas Masuk",
        children: [
          {
            id: "rev-jasa",
            label: "Sektor Jasa Perbaikan (Pola Panel & Ketok)",
            value: `Rp ${totalJasa.toLocaleString("id-ID")}`,
            details: `Rata-rata panel: ${(totalPanels > 0 ? totalJasa / totalPanels : 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })} per panel`,
          },
          {
            id: "rev-part",
            label: "Sektor Sparepart & Konsinyasi Material",
            value: `Rp ${totalParts.toLocaleString("id-ID")}`,
            details: "Mark-up penjualan suku cadang",
          }
        ]
      },
      {
        id: "cost-stream",
        label: "Menekan Kebocoran Biaya Bengkel (Expenses)",
        value: `Rp ${totalCost.toLocaleString("id-ID")}`,
        details: `${(totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0).toFixed(1)}% Rasio Biaya`,
        children: [
          {
            id: "cost-part",
            label: `HPP Pembelian Suku Cadang`,
            value: `Rp ${totalHppParts.toLocaleString("id-ID")}`,
            details: `Mengambil ${(totalParts > 0 ? (totalHppParts / totalParts) * 100 : 0).toFixed(1)}% dari penjualan part`,
          },
          {
            id: "cost-bahan",
            label: "Biaya Bahan Baku Cat/Dempul",
            value: `Rp ${totalBahan.toLocaleString("id-ID")}`,
            details: `Mengambil ${(totalJasa > 0 ? (totalBahan / totalJasa) * 100 : 0).toFixed(1)}% dari omzet Jasa`,
          },
          {
            id: "cost-spkl",
            label: "Beban Jasa Pekerjaan Luar (SPKL)",
            value: `Rp ${totalSpkl.toLocaleString("id-ID")}`,
            details: "Biaya subkontraktor luar mandiri",
          }
        ]
      }
    ]
  };

  // Setup Solution Matrix
  // We formulate scoring weights based on user-driven variables or balanced defaults
  // Impact (35%), Cost (25%, lower is higher score), Feasibility (20%), Speed (20%)
  const defaultWeights = { impact: 0.35, cost: 0.25, feasibility: 0.2, speed: 0.2 };

  // Generate customized solutions dynamically mapped based on our math outcomes!
  const alternatives: AlternativeSolution[] = [
    {
      id: "sol-1",
      name: "SOP Digital Paint Mixing & Timbangan Akurat",
      description: "Standardisasi pencampuran cat & dempul menggunakan timbangan presisi terintegrasi aplikasi agar tidak ada sisa cat terbuang.",
      scores: {
        impact: totalBahan > (totalJasa * 0.18) ? 9 : 6, // High impact if paint costs are bengkak
        cost: 7, // Moderate cost to buy digital scale & tablet
        feasibility: 8,
        speed: 8
      },
      totalWeightedScore: 0,
      actionPlan: [
        "Pembelian timbangan digital gramasi presisi tinggi.",
        "Pelatihan painter (tukang cat) tentang SOP pencampuran cat komputerisasi.",
        "Pencatatan sisa cat tak terpakai mingguan.",
        "Evaluasi bonus cat hemat untuk painter berkinerja tinggi."
      ]
    },
    {
      id: "sol-2",
      name: "Negosiasi Kontrak & Konsinyasi Suku Cadang",
      description: "Melakukan merger supply chain ke 2-3 supplier utama dengan sistem konsinyasi guna memotong harga beli sparepart dan gratis ongkir.",
      scores: {
        impact: totalHppParts > (totalParts * 0.45) ? 9 : 7, // Critical if part cost ratio is high
        cost: 8, // Very low implementation cost, just negotiating contracts
        feasibility: 7,
        speed: 6
      },
      totalWeightedScore: 0,
      actionPlan: [
        "Audit vendor supplier part sasis, lampu, bemper existing.",
        "Drafting MoU diskon khusus tiering volume transaksi bulanan.",
        "Penerapan sistem konsinyasi material cat fast-moving.",
        "Sanksi keterlambatan delivery dari supplier."
      ]
    },
    {
      id: "sol-3",
      name: "Pelatihan las ketok mandiri & Upgrade Alat Bengkel",
      description: "Menghapuskan biaya SPKL dengan membeli alat khusus (welding/pneumatis) dan mengupgrade skill tukang ketok agar radiator & sasis diselesaikan intern.",
      scores: {
        impact: totalSpkl > 2000000 ? 8 : 4, // High impact if SPKL is huge
        cost: 5, // Requires capital expense (high cost means lower score, e.g. 5)
        feasibility: 7,
        speed: 5
      },
      totalWeightedScore: 0,
      actionPlan: [
        "Invetarisasi subkontrak SPKL yang paling sering dilempar keluar.",
        "Beli mesin welding spot dan alat puller hidrolik premium.",
        "Pelatih internal dari senior kepada junior.",
        "In sourcing pekerjaan radiator dan las tangki bensin."
      ]
    },
    {
      id: "sol-4",
      name: "Sistem Double-Check Estimator & Audit Premi Asuransi",
      description: "Mencegah Miss-Estimasi panel di depan dengan sistem double-check agar tidak ada sisa panel rontok yang dikerjakan gratis denda.",
      scores: {
        impact: 8,
        cost: 8, // Low cost, just management check
        feasibility: 8,
        speed: 9
      },
      totalWeightedScore: 0,
      actionPlan: [
        "Pembuatan form estimasi check digital menggunakan foto/video.",
        "Persetujuan verifikasi kepala bengkel sebelum SPK di-issue ke lini produksi.",
        "Audit berkala kesesuaian estimasi vs penggarapan aktual bengkel."
      ]
    }
  ];

  // Calculate weighted total scores
  for (const alt of alternatives) {
    alt.totalWeightedScore = Number((
      alt.scores.impact * defaultWeights.impact +
      alt.scores.cost * defaultWeights.cost +
      alt.scores.feasibility * defaultWeights.feasibility +
      alt.scores.speed * defaultWeights.speed
    ).toFixed(2));
  }

  // Sort by highest weighted score
  const sortedAlternatives = [...alternatives].sort((a, b) => b.totalWeightedScore - a.totalWeightedScore);
  const recommendedSolution = sortedAlternatives[0];

  // Basic Problem statement
  const problemStatement = `Rasio margin Gross Profit saat ini berada di ${grossProfitPercentage.toFixed(1)}%. Pengeluaran direct terbesar timbul dari komponen ${topCostCategory}.`;

  // Root causes
  const rootCauses: string[] = [];
  if (totalHppParts > (totalParts * 0.45)) {
    rootCauses.push("Harga beli spareparts kurang kompetitif dari supplier, minim kerjasama tiering.");
  }
  if (totalBahan > (totalJasa * 0.18)) {
    rootCauses.push("Adanya pemborosan (wastage) material paint/chemical di ruang aduk cat (tidak presisi).");
  }
  if (totalSpkl > (totalRevenue * 0.05)) {
    rootCauses.push("Beban SPKL membengkak akibat keterbatasan alat las ketok modern pendukung pengerjaan internal.");
  }
  if (rootCauses.length === 0) {
    rootCauses.push("Kerja panel tidak optimal karena waktu set-up pengelasan cukup lambat.");
    rootCauses.push("Ketergantungan asuransi premi rendah yang menekan Jasa Nett dibanding part.");
  }

  const baseResponse: ProblemAnalysisResponse = {
    problemStatement,
    logicTree: logoTree,
    paretoData,
    matrix: {
      weights: defaultWeights,
      alternatives: sortedAlternatives
    },
    rootCauses,
    recommendedSolution
  };

  // If Gemini API is available, we augment it with true AI intelligence!
  if (ai) {
    try {
      const gResult = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `
          Anda adalah Konsultan Bisnis Bengkel Body Repair profesional Indonesia.
          Analisis data bengkel berikut untuk merumuskan:
          1. Rumusan Masalah Utama (berdasar margin GP ${grossProfitPercentage.toFixed(1)}% dan pengeluaran Rp ${totalCost.toLocaleString("id-ID")})
          2. Rekomendasi Solusi Berdasarkan Pareto & Logika Matrix. (Kategori pengeluaran tertinggi: HPP=$${totalHppParts}, Bahan=$${totalBahan}, SPKL=$${totalSpkl}).
          3. Tiga Rencana Aksi Konkrit berdasar realitas bengkel body repair Indonesia (misal: pengerjaan panel, asuransi, estimasi).

          Format output: kembalikan JSON dengan format persis di bawah ini demi keamanan parsing:
          {
            "problemStatement": "...",
            "rootCauses": ["...", "...", "..."],
            "customAIEvaluation": "Diskusi evaluasi komprehensif dari AI...",
            "customActionPlan": ["...", "...", "..."]
          }

          Pastikan respons hanyalah berupa JSON mentah yang valid, tanpa melingkarinya dengan blok markdown \`\`\`json.
        `,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3
        }
      });

      const responseText = gResult.text || "{}";
      const parsedAI = JSON.parse(responseText.trim());

      if (parsedAI.problemStatement) {
        baseResponse.problemStatement = parsedAI.problemStatement;
      }
      if (parsedAI.rootCauses && Array.isArray(parsedAI.rootCauses)) {
        baseResponse.rootCauses = parsedAI.rootCauses;
      }
      if (parsedAI.customActionPlan && Array.isArray(parsedAI.customActionPlan)) {
        baseResponse.recommendedSolution.actionPlan = parsedAI.customActionPlan;
      }
      // Add custom AI discussion
      if (parsedAI.customAIEvaluation) {
        baseResponse.recommendedSolution.description = `${baseResponse.recommendedSolution.description}\n\n[Analisis AI Studio]: ${parsedAI.customAIEvaluation}`;
      }
    } catch (gErr) {
      console.error("Gemini enhancement failed, loading pure algorithmic analytical backend output.", gErr);
    }
  }

  res.json(baseResponse);
});

export default app;

// VITE MIDDLEWARE CONFIG FOR DEV & PROD
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Using Vite Development Middleware Mode");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Using compiled static server distribution on production");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
