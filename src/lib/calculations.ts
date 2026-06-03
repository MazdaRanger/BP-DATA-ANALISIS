/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BodyRepairRecord, MetricSummary, ComparativeMatrix, ComparisonResult } from "../types.js";

export function getMonthName(monthNumber: number): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return months[monthNumber - 1] || "Semua Bulan";
}

export function filterAndSummarize(
  records: BodyRepairRecord[],
  year: number,
  month: number, // 1 - 12, or 0 for All Months
  week: number | "ALL" // 1-5, or "ALL"
): MetricSummary {
  // Filter active records
  const filtered = records.filter((r) => {
    const rDate = new Date(r.tanggal);
    const rYear = rDate.getFullYear();
    const rMonth = rDate.getMonth() + 1; // 1-indexed

    const matchYear = rYear === year;
    const matchMonth = month === 0 ? true : rMonth === month;
    const matchWeek = week === "ALL" ? true : r.week === week;

    return matchYear && matchMonth && matchWeek;
  });

  return summarizeRecords(filtered);
}

export function summarizeRecords(filtered: BodyRepairRecord[]): MetricSummary {
  let jasaNett = 0;
  let partMaterialNett = 0;
  let expensesBahan = 0;
  let hppPartMaterial = 0;
  let spkl = 0;
  let panelCount = 0;

  const insuranceSet = new Set<string>();
  const regionTable: Record<string, number> = {};

  for (const r of filtered) {
    jasaNett += r.jasaNett;
    partMaterialNett += r.partMaterialNett;
    expensesBahan += r.expensesBahan;
    hppPartMaterial += r.hppPartMaterial;
    spkl += r.spkl;
    panelCount += r.jumlahPanel;

    if (r.asuransi) insuranceSet.add(r.asuransi);
    if (r.wilayah) {
      regionTable[r.wilayah] = (regionTable[r.wilayah] || 0) + r.jumlahPanel;
    }
  }

  // Top 5 regions aggregated by panel count descending
  const regionCounts = Object.entries(regionTable)
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);

  const revenue = jasaNett + partMaterialNett;
  const expenses = expensesBahan + hppPartMaterial + spkl;
  const grossProfit = revenue - expenses;

  return {
    jasaNett,
    partMaterialNett,
    expensesBahan,
    hppPartMaterial,
    spkl,
    revenue,
    expenses,
    grossProfit,
    asuransiCount: insuranceSet.size,
    panelCount,
    regionCounts
  };
}

export function computeComparison(
  current: number,
  previous: number
): ComparisonResult {
  let percentageChange = 0;
  if (previous > 0) {
    percentageChange = ((current - previous) / previous) * 100;
  } else if (current > 0) {
    percentageChange = 100; // 100% gain from zero base
  }

  return {
    currentValue: current,
    previousValue: previous,
    percentageChange: Number(percentageChange.toFixed(1))
  };
}

export function generateComparativeMatrix(
  current: MetricSummary,
  previous: MetricSummary
): ComparativeMatrix {
  return {
    jasaNett: computeComparison(current.jasaNett, previous.jasaNett),
    partMaterialNett: computeComparison(current.partMaterialNett, previous.partMaterialNett),
    expensesBahan: computeComparison(current.expensesBahan, previous.expensesBahan),
    hppPartMaterial: computeComparison(current.hppPartMaterial, previous.hppPartMaterial),
    spkl: computeComparison(current.spkl, previous.spkl),
    revenue: computeComparison(current.revenue, previous.revenue),
    expenses: computeComparison(current.expenses, previous.expenses),
    grossProfit: computeComparison(current.grossProfit, previous.grossProfit),
    panelCount: computeComparison(current.panelCount, previous.panelCount),
  };
}
