-- =====================================================================
-- EYE PLANNING SOFTWARE (DENIM CRAFTS - KARACHI)
-- COMPREHENSIVE PRODUCTION DATABASE SCHEMA & INITIALIZATION SCRIPT
-- RUN THIS IN SUPABASE SQL EDITOR (https://supabase.com/dashboard/project/ekesyoziuhkgozcjqztj/sql)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. STITCHING STATUS CONSTRAINT UPDATE (RUN THIS ON EXISTING DATABASE):
-- ---------------------------------------------------------------------
ALTER TABLE public.challans DROP CONSTRAINT IF EXISTS challans_status_check;
ALTER TABLE public.challans ADD CONSTRAINT challans_status_check 
  CHECK (status IN ('Process', 'Inline', 'Complete', 'OPEN', 'CLOSED', 'VOID'));

-- ---------------------------------------------------------------------
-- 2. EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 3. PROFILES TABLE (USER MANAGEMENT & ROLE-BASED ACCESS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'manager', 'operator')),
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- 4. DELIVERY CHALLANS (DC REGISTRATION & SPECS)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challans (
    id TEXT PRIMARY KEY,
    dc_no TEXT NOT NULL UNIQUE,
    party TEXT NOT NULL,
    article TEXT,
    item TEXT,
    opening_qty NUMERIC(12, 2) NOT NULL CHECK (opening_qty > 0),
    open_date DATE NOT NULL DEFAULT CURRENT_DATE,
    first_expected_date DATE,
    daily_expected_rate INTEGER,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'Process' CHECK (status IN ('Process', 'Inline', 'Complete', 'OPEN', 'CLOSED', 'VOID')),
    closed_date DATE,
    void_reason TEXT,
    created_by_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure columns exist if table was already created
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS item TEXT;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS first_expected_date DATE;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS daily_expected_rate INTEGER;

-- ---------------------------------------------------------------------
-- 5. ENTRIES TABLE (DAILY PRODUCTION INPUT & OUTPUT ENTRIES)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entries (
    id TEXT PRIMARY KEY,
    challan_id TEXT NOT NULL REFERENCES public.challans(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    qty NUMERIC(12, 2) NOT NULL,
    note TEXT,
    created_by_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- 6. AUDIT LOGS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ---------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_challans_dc_no ON public.challans(dc_no);
CREATE INDEX IF NOT EXISTS idx_challans_status ON public.challans(status);
CREATE INDEX IF NOT EXISTS idx_entries_lookup ON public.entries(challan_id, entry_date);

-- ---------------------------------------------------------------------
-- 8. AUTOMATIC UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_challans_updated_at ON public.challans;
CREATE TRIGGER set_challans_updated_at BEFORE UPDATE ON public.challans
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_entries_updated_at ON public.entries;
CREATE TRIGGER set_entries_updated_at BEFORE UPDATE ON public.entries
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------
ALTER TABLE public.challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and auth challans access" ON public.challans;
CREATE POLICY "Public and auth challans access" ON public.challans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public and auth entries access" ON public.entries;
CREATE POLICY "Public and auth entries access" ON public.entries FOR ALL USING (true) WITH CHECK (true);
