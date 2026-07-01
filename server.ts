/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { initializeFirestore, collection, getDocs, setDoc, deleteDoc, doc, writeBatch, setLogLevel } from "firebase/firestore";
setLogLevel("silent");
import { BodyRepairRecord, MetricSummary, ParetoItem, AlternativeSolution, QuantitativeMatrix, ProblemAnalysisResponse, LogicTreeNode } from "./src/types.js";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = 3000;

// Initialize Firebase Client
let firebaseDb: any = null;

// Suppress noisy Firestore idle warnings in Node
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (typeof args[0] === 'string' && args[0].includes("GrpcConnection RPC 'Listen' stream") && args[0].includes("CANCELLED")) {
    return;
  }
  originalConsoleError(...args);
};

try {
  let config;
  if (fs.existsSync("./firebase-applet-config.json")) {
    config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
  } else {
    config = {
      projectId: "gen-lang-client-0300801049",
      appId: "1:818963985156:web:e3641ec4a1e56b0167d651",
      apiKey: "AIzaSyBit3Kmc2OBoZoH1pguncUKpnkT9F3zhuk",
      authDomain: "gen-lang-client-0300801049.firebaseapp.com",
      firestoreDatabaseId: "ai-studio-3467babe-2776-4f26-a8fd-61fd0c77f54f",
      storageBucket: "gen-lang-client-0300801049.firebasestorage.app",
      messagingSenderId: "818963985156"
    };
    console.warn("firebase-applet-config.json not found. Using fallback config for Firebase.");
  }
  const firebaseApp = initializeApp(config);
  firebaseDb = initializeFirestore(firebaseApp, {}, config.firestoreDatabaseId);
  console.log("Firebase initialized successfully with project:", config.projectId);
} catch (error) {
  console.error("Failed to initialize Firebase:", error);
}

// Clean logger for Firebase errors
function logFirebaseError(context: string, error: any) {
  if (error) {
    if (error.code === "permission-denied" || (error.message && error.message.includes("Missing or insufficient permissions"))) {
      console.warn(`[Firebase Warning] Security rules not deployed or table access denied, falling back to local memory. (${context})`);
      return;
    }
    console.error(`[Firebase Error] ${context} failed:`, error.message);
  }
}

// Convert Firebase doc to frontend camelCase type
function toModel(docId: string, dbRow: any): BodyRepairRecord {
  return {
    id: dbRow.id || docId,
    tanggal: dbRow.tanggal,
    week: Number(dbRow.week),
    noSpk: dbRow.no_spk || dbRow.noSpk,
    asuransi: dbRow.asuransi,
    jasaNett: Number(dbRow.jasa_nett || dbRow.jasaNett),
    partMaterialNett: Number(dbRow.part_material_nett || dbRow.partMaterialNett),
    expensesBahan: Number(dbRow.expenses_bahan || dbRow.expensesBahan),
    hppPartMaterial: Number(dbRow.hpp_part_material || dbRow.hppPartMaterial),
    spkl: Number(dbRow.spkl),
    jumlahPanel: Number(dbRow.jumlah_panel || dbRow.jumlahPanel),
    wilayah: dbRow.wilayah
  };
}

// Convert frontend camelCase type to Firebase DB snake_case payload
function toDb(model: Partial<BodyRepairRecord>): any {
  const db: any = {};
  db.id = model.id;
  db.tanggal = model.tanggal;
  db.week = model.week;
  db.no_spk = model.noSpk;
  db.asuransi = model.asuransi;
  db.jasa_nett = model.jasaNett;
  db.part_material_nett = model.partMaterialNett;
  db.expenses_bahan = model.expensesBahan;
  db.hpp_part_material = model.hppPartMaterial;
  db.spkl = model.spkl;
  db.jumlah_panel = model.jumlahPanel;
  db.wilayah = model.wilayah;
  return db;
}

// Initialize Gemini API client if key exists
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6I3Zt5O1dRMyFtAGTCv1xi1HFoSzvDZIKO89FfeJ7z4HA";
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
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

// Initial seed starts empty for real-time usage (user can load simulation seed data manually)
recordsDatabase = [];

// API REST 
app.get("/api/database-status", async (req, res) => {
  if (!firebaseDb) {
    return res.json({
      connected: false,
      errorType: "NOT_INITIALIZED",
      message: "Firebase client not initialized. Check your environment variables."
    });
  }

  try {
    const snap = await getDocs(collection(firebaseDb, "body_repair_records"));
    return res.json({
      connected: true,
      errorType: null,
      message: "Koneksi live Firebase sinkron dan aktif!",
    });
  } catch (e: any) {
    if (e?.code === "permission-denied" || (e?.message && e.message.includes("Missing or insufficient permissions"))) {
        return res.json({
          connected: false,
          errorType: "TABLE_MISSING",
          message: "Tabel 'body_repair_records' kekurangan hak akses via Firebase Rules. Memory Sandbox fallback aktif.",
          details: e.message
        });
    }
    return res.json({
      connected: false,
      errorType: "SERVER_EXCEPTION",
      message: `Gagal memverifikasi status database: ${e.message || e}`,
    });
  }
});

app.get("/api/records", async (req, res) => {
  if (firebaseDb) {
    try {
      const snap = await getDocs(collection(firebaseDb, "body_repair_records"));
      const records = snap.docs.map(docSnap => toModel(docSnap.id, docSnap.data()));
      recordsDatabase = records;
      return res.json(records);
    } catch (e: any) {
      logFirebaseError("GET /api/records", e);
    }
  }
  res.json(recordsDatabase);
});

app.post("/api/records/bulk", async (req, res) => {
  await loadSettingsFromDb();
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
    let dateObj = new Date(tanggal);
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }
    
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
      asuransi: item.asuransi || "Personal (Umum)",
      jasaNett: Number(item.jasaNett) || 0,
      partMaterialNett: Number(item.partMaterialNett) || 0,
      expensesBahan: Number(item.expensesBahan) || 0,
      hppPartMaterial: Number(item.hppPartMaterial) || 0,
      spkl: Number(item.spkl) || 0,
      jumlahPanel: Number(item.jumlahPanel) || 1,
      wilayah: item.wilayah || "Jakarta Selatan"
    };

    validated.push(record);
  }

  if (firebaseDb) {
    try {
      // Clear Firebase completely first as specified by the standard overwrite context of the app
      const existingSnap = await getDocs(collection(firebaseDb, "body_repair_records"));
      const batchClear = writeBatch(firebaseDb);
      existingSnap.docs.forEach((docSnap) => batchClear.delete(docSnap.ref));
      await batchClear.commit().catch(e => logFirebaseError("Clear database", e));

      // Bulk insert
      const batchInsert = writeBatch(firebaseDb);
      validated.forEach(record => {
         const docRef = doc(firebaseDb, "body_repair_records", record.id);
         batchInsert.set(docRef, toDb(record));
      });
      await batchInsert.commit();

      recordsDatabase = validated;
      return res.json({ 
        message: `Successfully loaded ${validated.length} records into your live Firebase database!`, 
        recordCount: validated.length 
      });
    } catch (e: any) {
      logFirebaseError("Bulk upload", e);
    }
  }

  // Backup in-memory fallback
  recordsDatabase = validated;
  res.json({ message: `Successfully loaded ${validated.length} records into the memory analyzer!`, recordCount: recordsDatabase.length });
});

app.post("/api/records/reset", async (req, res) => {
  const seeds = generateSeedData();
  if (firebaseDb) {
    try {
      // Clear Firebase completely
      const existingSnap = await getDocs(collection(firebaseDb, "body_repair_records"));
      const batchClear = writeBatch(firebaseDb);
      existingSnap.docs.forEach((docSnap) => batchClear.delete(docSnap.ref));
      await batchClear.commit().catch(e => logFirebaseError("Clear database", e));

      // Insert new seed rows in chunks
      const batchInsert = writeBatch(firebaseDb);
      seeds.forEach(record => {
         const docRef = doc(firebaseDb, "body_repair_records", record.id);
         batchInsert.set(docRef, toDb(record));
      });
      await batchInsert.commit();

      recordsDatabase = seeds;
      return res.json({ message: "Database reset to professional seed data in Firebase & memory", recordCount: seeds.length, records: seeds });
    } catch (e: any) {
      logFirebaseError("Reset seed", e);
    }
  }
  recordsDatabase = seeds;
  res.json({ message: "Database reset to professional seed data in memory fallback", recordCount: recordsDatabase.length, records: recordsDatabase });
});

app.post("/api/records/clear", async (req, res) => {
  if (firebaseDb) {
    try {
      const existingSnap = await getDocs(collection(firebaseDb, "body_repair_records"));
      const batchClear = writeBatch(firebaseDb);
      existingSnap.docs.forEach((docSnap) => batchClear.delete(docSnap.ref));
      await batchClear.commit();
      
      recordsDatabase = [];
      return res.json({ message: "Firebase database cleared successfully", recordCount: 0, records: [] });
    } catch (e: any) {
      logFirebaseError("Clear database", e);
    }
  }
  recordsDatabase = [];
  res.json({ message: "Database cleared successfully", recordCount: 0, records: [] });
});


// Settings App Config State
let appSettings = {
  mechanicsCount: 15,
  sprayboothsCount: 4,
  holidays: [] as string[]
};

// Load settings from Firestore on startup if possible
async function loadSettingsFromDb() {
  if (firebaseDb) {
    try {
      const { getDoc, doc } = await import("firebase/firestore");
      const settingsDoc = await getDoc(doc(firebaseDb, "system_config", "settings"));
      if (settingsDoc.exists()) {
        appSettings = { ...appSettings, ...settingsDoc.data() };
      }
    } catch (e) {
      console.error("Failed to load settings from DB:", e);
    }
  }
}
loadSettingsFromDb();

app.get("/api/settings", async (req, res) => {
  if (firebaseDb) {
    try {
      const { getDoc, doc } = await import("firebase/firestore");
      const settingsDoc = await getDoc(doc(firebaseDb, "system_config", "settings"));
      if (settingsDoc.exists()) {
        appSettings = { ...appSettings, ...settingsDoc.data() };
      }
    } catch (e) {
      console.error("Failed to fetch settings from DB:", e);
    }
  }
  res.json(appSettings);
});

app.post("/api/settings", async (req, res) => {
  const { mechanicsCount, sprayboothsCount, holidays } = req.body;
  if (mechanicsCount !== undefined) appSettings.mechanicsCount = Number(mechanicsCount);
  if (sprayboothsCount !== undefined) appSettings.sprayboothsCount = Number(sprayboothsCount);
  if (Array.isArray(holidays)) appSettings.holidays = holidays;
  
  if (firebaseDb) {
    try {
      const { setDoc, doc } = await import("firebase/firestore");
      await setDoc(doc(firebaseDb, "system_config", "settings"), appSettings);
    } catch (e) {
      console.error("Failed to save settings to DB:", e);
    }
  }

  res.json({ message: "Settings updated", settings: appSettings });
});

// Semantic Heuristic Helper for Column Mapping fallback when AI is unavailable/fails
function fallbackMapper(sampleData: any[]): any {
  const result: any = {
    tanggalKey: "",
    noSpkKey: "",
    asuransiKey: "",
    jasaNettKey: "",
    partMaterialNettKey: "",
    expensesBahanKey: "",
    hppPartMaterialKey: "",
    spklKey: "",
    jumlahPanelKey: "",
    wilayahKey: "",
    dateFormat: "MM/DD/YYYY"
  };

  if (!Array.isArray(sampleData) || sampleData.length === 0) {
    return result;
  }

  const sampleObj = sampleData[0] || {};
  const keys = Object.keys(sampleObj);

  const findKey = (synonyms: string[]): string => {
    // 1. Exact match (case insensitive, trimmed)
    for (const key of keys) {
      const normalized = key.toLowerCase().trim();
      if (synonyms.some(s => normalized === s.toLowerCase())) {
        return key;
      }
    }
    // 2. Partial match
    for (const key of keys) {
      const normalized = key.toLowerCase().trim();
      if (synonyms.some(s => normalized.includes(s.toLowerCase()) || s.toLowerCase().includes(normalized))) {
        return key;
      }
    }
    return "";
  };

  result.tanggalKey = findKey(["tanggal", "tgl", "date", "hari", "period", "sejak", "waktu", "tgl_spk"]);
  result.noSpkKey = findKey(["no spk", "nospk", "no_spk", "spk", "no. spk", "nomor spk", "invoice", "no_invoice", "no. spk/surat jalan", "id"]);
  result.asuransiKey = findKey(["asuransi", "customer", "pelanggan", "insurance", "pembayar", "debtor", "nama asuransi", "premi", "penanggung", "asuransi/umum/personal"]);
  result.jasaNettKey = findKey(["jasa nett", "jasa_nett", "jasa nett", "jasa", "net jasa", "fee", "jasa net", "revenue jasa", "nilai jasa"]);
  result.partMaterialNettKey = findKey(["part material nett", "part_material_nett", "part material", "sparepart", "part", "suku cadang", "barang", "part nett", "spareparts value", "nilai part"]);
  result.expensesBahanKey = findKey(["expenses bahan", "expenses_bahan", "biaya bahan", "bahan", "material", "cat", "paint expenses", "pengeluaran bahan", "biaya cat"]);
  result.hppPartMaterialKey = findKey(["hpp part material", "hpp_part_material", "hpp part", "hpp sparepart", "hpp", "cogs part", "hpp suku cadang"]);
  result.spklKey = findKey(["spkl", "pekerjaan luar", "subcont", "subkontrak", "jasa luar", "pekerjaan subcont", "subkontraktor"]);
  result.jumlahPanelKey = findKey(["jumlah panel", "jumlah_panel", "panel", "qty panel", "jml panel", "banyak panel", "total panel", "panel count"]);
  result.wilayahKey = findKey(["wilayah", "cabang", "region", "area", "kota", "lokasi", "site", "outlet"]);

  // Detect basic Date pattern from samples
  for (const key of keys) {
    if (result.tanggalKey === key) {
      const val = sampleObj[key];
      if (typeof val === "number") {
        result.dateFormat = "Excel Serial";
      } else if (typeof val === "string") {
        if (val.includes("-")) {
          result.dateFormat = "YYYY-MM-DD";
        } else if (val.includes("/")) {
          result.dateFormat = "MM/DD/YYYY";
        }
      }
    }
  }

  // Fallback defaults for missing required keys to make sure valid mapping is populated
  if (!result.tanggalKey) result.tanggalKey = keys.find(k => k.toLowerCase().includes("tgl") || k.toLowerCase().includes("date")) || keys[0] || "";
  if (!result.noSpkKey) result.noSpkKey = keys.find(k => k.toLowerCase().includes("spk") || k.toLowerCase().includes("no") || k.toLowerCase().includes("inv")) || keys[1] || "";
  if (!result.asuransiKey) result.asuransiKey = keys.find(k => k.toLowerCase().includes("asuransi") || k.toLowerCase().includes("cust")) || keys[2] || "";

  return result;
}

// AI Mapper Endpoint for Excel imports
app.post("/api/ai-mapper", async (req, res) => {
  const { sampleData } = req.body; // array of up to 5 objects from Excel rows

  if (!ai) {
    console.warn("Gemini API not configured, running smart semantic heuristic mapper instead.");
    const mappingConfig = fallbackMapper(sampleData);
    return res.json(mappingConfig);
  }

  try {
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
    console.warn("AI Mapper Failed. Falling back to smart semantic heuristic column mapper due to error:", error.message || error);
    const mappingConfig = fallbackMapper(sampleData);
    res.json(mappingConfig);
  }
});

// PROBLEM SOLVER ENDPOINT
app.post("/api/analyze", async (req, res) => {
  await loadSettingsFromDb();
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
          
          Sebagai referensi tambahan:
          Bengkel saat ini memiliki kapasitas ${appSettings.mechanicsCount} mekanik aktif dan ${appSettings.sprayboothsCount} oven/spraybooth. Jika beban pekerjaan terlihat tinggi tetapi kapasitas terbatas, sarankan solusi optimasi kapasitas (bottleneck).

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
    const viteModule = "vite";
    const { createServer: createViteServer } = await import(viteModule);
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
