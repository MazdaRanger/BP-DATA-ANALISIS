/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppSettings {
  mechanicsCount: number;
  sprayboothsCount: number;
  holidays: string[]; // YYYY-MM-DD
}

export type KanbanStatus = 
  | "Penerimaan SPK"
  | "Estimasi Biaya"
  | "Banding Asuransi"
  | "Bongkar"
  | "Las Ketok"
  | "Dempul"
  | "Antri Cat (Mixing)"
  | "Cat"
  | "Poles"
  | "Pemasangan"
  | "Finishing & QC"
  | "Kendaraan Siap Di Ambil"
  | "Kendaraan Keluar Rawat Jalan";

export interface KanbanRecord {
  id: string;
  noSpk: string;
  nopol: string;
  kendaraan: string;
  asuransi: string;
  status: KanbanStatus;
  updatedAt: string;
}

export interface AiMappingConfig {
  tanggalKey: string;
  noSpkKey: string;
  asuransiKey: string;
  jasaNettKey: string;
  partMaterialNettKey: string;
  expensesBahanKey: string;
  hppPartMaterialKey: string;
  spklKey: string;
  jumlahPanelKey: string;
  wilayahKey: string;
  dateFormat: string; // e.g. "YYYY-MM-DD" or "DD/MM/YYYY"
}

export interface BodyRepairRecord {
  id: string;
  tanggal: string; // Format: YYYY-MM-DD
  week: number;    // Week index: 1, 2, 3, 4, 5
  noSpk: string;   // SPK/Invoice Number
  asuransi: string; // Insurance name or "Personal"
  jasaNett: number; // Jasa Nett
  partMaterialNett: number; // Part + Material Nett
  expensesBahan: number; // Expenses Bahan
  hppPartMaterial: number; // HPP Part Dan Material
  spkl: number; // Jasa Pekerjaan Luar (SPKL)
  jumlahPanel: number; // Jumlah Panel
  wilayah: string; // Customer region/province
}

export interface MetricSummary {
  jasaNett: number;
  partMaterialNett: number;
  expensesBahan: number;
  hppPartMaterial: number;
  spkl: number;
  revenue: number;
  expenses: number;
  grossProfit: number;
  asuransiCount: number;
  panelCount: number;
  regionCounts: { region: string; count: number }[];
}

export interface LogicTreeNode {
  id: string;
  label: string;
  value?: string | number;
  details?: string;
  children?: LogicTreeNode[];
}

export interface ParetoItem {
  category: string;
  value: number;
  percentage: number;
  cumulativePercentage: number;
  isVital: boolean;
}

export interface AlternativeSolution {
  id: string;
  name: string;
  description: string;
  scores: {
    impact: number;      // 1-10
    cost: number;        // 1-10 (high is better, i.e., cost is lower)
    feasibility: number; // 1-10
    speed: number;       // 1-10
  };
  totalWeightedScore: number;
  actionPlan: string[];
}

export interface QuantitativeMatrix {
  weights: {
    impact: number;
    cost: number;
    feasibility: number;
    speed: number;
  };
  alternatives: AlternativeSolution[];
}

export interface ProblemAnalysisResponse {
  problemStatement: string;
  logicTree: LogicTreeNode;
  paretoData: ParetoItem[];
  matrix: QuantitativeMatrix;
  rootCauses: string[];
  recommendedSolution: AlternativeSolution;
}

export interface ComparisonResult {
  currentValue: number;
  previousValue: number;
  percentageChange: number; // e.g. +15.5 or -3.2
}

export interface ComparativeMatrix {
  jasaNett: ComparisonResult;
  partMaterialNett: ComparisonResult;
  expensesBahan: ComparisonResult;
  hppPartMaterial: ComparisonResult;
  spkl: ComparisonResult;
  revenue: ComparisonResult;
  expenses: ComparisonResult;
  grossProfit: ComparisonResult;
  panelCount: ComparisonResult;
}

export interface CrcRecord {
  id: string;
  tanggal: string; // YYYY-MM-DD
  week: number;
  jumlahSpkAsuransi: number;
  outbondCall: number;
  unitBooking: number;
  unitWalkIn: number;
  outbondAfterService: number;
  numberPhoneInvalid: number;
  costumerComplain: number;
  outbondProspekAsuransi: number;
}
