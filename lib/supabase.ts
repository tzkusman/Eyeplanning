import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ekesyoziuhkgozcjqztj.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrZXN5b3ppdWhrZ296Y2pxenRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzE4NjcsImV4cCI6MjA5NDMwNzg2N30.JUdbXIUpqsQsnaKR3N9hEKFPYLQiygVZvfBoB3sdPL8';

export const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrZXN5b3ppdWhrZ296Y2pxenRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODczMTg2NywiZXhwIjoyMDk0MzA3ODY3fQ.QgVqf85XCzeP0JzIC4aOtVlX3ASR2qH7nBTFDi0PU0A';

// Client-side Supabase client with anon key
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Connection test helper
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  hasTables: boolean;
  message: string;
}> {
  try {
    const res = await fetch('/api/setup', { cache: 'no-store' });
    const data = await res.json();
    return {
      connected: Boolean(data.connected),
      hasTables: Boolean(data.hasTables),
      message:
        data.message ||
        (data.connected
          ? 'Connected to Supabase Cloud!'
          : 'Could not reach Supabase'),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      hasTables: false,
      message: `Connection test failed: ${errorMsg}`,
    };
  }
}

export const STITCHING_STATUS_SQL = `-- RUN THIS IN SUPABASE SQL EDITOR TO UPDATE STITCHING STATUS:
ALTER TABLE public.challans DROP CONSTRAINT IF EXISTS challans_status_check;
ALTER TABLE public.challans ADD CONSTRAINT challans_status_check 
  CHECK (status IN ('Process', 'Inline', 'Complete', 'OPEN', 'CLOSED', 'VOID'));`;

/**
 * Clean, production-ready SQL migration script for Supabase
 */
export const SUPABASE_IN_DEPTH_SQL = `-- =====================================================================
-- EYE PLANNING SOFTWARE (DENIM CRAFTS - KARACHI)
-- PRODUCTION DATABASE SCHEMA & STITCHING STATUS UPGRADE
-- RUN THIS IN SUPABASE SQL EDITOR (https://supabase.com/dashboard/project/ekesyoziuhkgozcjqztj/sql)
-- =====================================================================

-- 1. STITCHING STATUS CONSTRAINT UPDATE:
ALTER TABLE public.challans DROP CONSTRAINT IF EXISTS challans_status_check;
ALTER TABLE public.challans ADD CONSTRAINT challans_status_check 
  CHECK (status IN ('Process', 'Inline', 'Complete', 'OPEN', 'CLOSED', 'VOID'));

-- 2. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. PROFILES TABLE (USER MANAGEMENT & ROLE-BASED ACCESS)
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

-- 4. DELIVERY CHALLANS (DC REGISTRATION & SPECS)
CREATE TABLE IF NOT EXISTS public.challans (
    id TEXT PRIMARY KEY,
    dc_no TEXT NOT NULL UNIQUE,
    party TEXT NOT NULL,
    article TEXT,
    opening_qty NUMERIC(12, 2) NOT NULL CHECK (opening_qty > 0),
    open_date DATE NOT NULL DEFAULT CURRENT_DATE,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'Process' CHECK (status IN ('Process', 'Inline', 'Complete', 'OPEN', 'CLOSED', 'VOID')),
    closed_date DATE,
    void_reason TEXT,
    created_by_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. ENTRIES TABLE (DAILY PRODUCTION INPUT & OUTPUT ENTRIES)
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

-- 6. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_challans_dc_no ON public.challans(dc_no);
CREATE INDEX IF NOT EXISTS idx_challans_status ON public.challans(status);
CREATE INDEX IF NOT EXISTS idx_entries_lookup ON public.entries(challan_id, entry_date);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and auth challans access" ON public.challans;
CREATE POLICY "Public and auth challans access" ON public.challans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public and auth entries access" ON public.entries;
CREATE POLICY "Public and auth entries access" ON public.entries FOR ALL USING (true) WITH CHECK (true);
`;
