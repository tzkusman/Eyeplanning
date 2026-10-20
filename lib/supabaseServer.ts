import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ekesyoziuhkgozcjqztj.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrZXN5b3ppdWhrZ296Y2pxenRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzE4NjcsImV4cCI6MjA5NDMwNzg2N30.JUdbXIUpqsQsnaKR3N9hEKFPYLQiygVZvfBoB3sdPL8';

export const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrZXN5b3ppdWhrZ296Y2pxenRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODczMTg2NywiZXhwIjoyMDk0MzA3ODY3fQ.QgVqf85XCzeP0JzIC4aOtVlX3ASR2qH7nBTFDi0PU0A';

/**
 * Server-side Supabase client initialized with the SERVICE ROLE key.
 * This completely bypasses Row Level Security (RLS) and guarantees that
 * all queries, inserts, updates, and deletes persist directly to the PostgreSQL database.
 */
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
