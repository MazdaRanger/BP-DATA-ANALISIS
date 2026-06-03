-- DATABASE MIGRATION SCRIPT FOR PT AUTO REPAIR ANALITIKA
-- Copy and paste this script directly into the "SQL Editor" within your Supabase Workspace Dashboard (https://supabase.com)
-- This creates the complete body repair analytics table, sets up indices for lightning-fast queries, and defines sample columns.

-- 1. Create the primary table
CREATE TABLE IF NOT EXISTS public.body_repair_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    week INT NOT NULL CHECK (week BETWEEN 1 AND 5),
    no_spk VARCHAR(100) NOT NULL UNIQUE,
    asuransi VARCHAR(150) NOT NULL DEFAULT 'Personal (Umum)',
    jasa_nett NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    part_material_nett NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    expenses_bahan NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    hpp_part_material NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    spkl NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    jumlah_panel INT NOT NULL DEFAULT 1 CHECK (jumlah_panel >= 0),
    wilayah VARCHAR(150) NOT NULL DEFAULT 'Jakarta Selatan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add performance indexing to speed up multi-dimensional filter aggregates
CREATE INDEX IF NOT EXISTS idx_records_tanggal ON public.body_repair_records(tanggal);
CREATE INDEX IF NOT EXISTS idx_records_week ON public.body_repair_records(week);
CREATE INDEX IF NOT EXISTS idx_records_asuransi ON public.body_repair_records(asuransi);
CREATE INDEX IF NOT EXISTS idx_records_wilayah ON public.body_repair_records(wilayah);

-- 3. Row-Level Security (RLS) Configuration (Optional / Recommended for Vercel clients)
ALTER TABLE public.body_repair_records ENABLE ROW LEVEL SECURITY;

-- Create an open policy giving select/insert rules for simplicity, adjust for security demands
CREATE POLICY "Allow open select to authenticated and public" 
ON public.body_repair_records FOR SELECT USING (true);

CREATE POLICY "Allow open insert to authenticated and public" 
ON public.body_repair_records FOR INSERT WITH CHECK (true);

-- 4. Sample row verification payload
-- INSERT INTO public.body_repair_records (tanggal, week, no_spk, asuransi, jasa_nett, part_material_nett, expenses_bahan, hpp_part_material, spkl, jumlah_panel, wilayah) VALUES
-- ('2026-06-01', 1, 'SPK-2026-06-001', 'Astra Garda Oto', 3750000.00, 1800000.00, 675000.00, 720000.00, 150000.00, 5, 'Jakarta Selatan');

COMMENT ON TABLE public.body_repair_records IS 'Table record transaksi operasional bengkel body repair untuk komparasi M2M, Y2Y, Pareto, dan analisa Pohon Logika.';
