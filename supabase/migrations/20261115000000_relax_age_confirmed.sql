-- ========================================================================
-- MEDREMIND SUPABASE MIGRATION: 20261115000000_relax_age_confirmed.sql
-- Relax age_confirmed constraint on public.consents
-- ========================================================================

-- Allow inserts without explicit age_confirmed values and default to true
ALTER TABLE IF EXISTS public.consents 
  ALTER COLUMN age_confirmed DROP NOT NULL;

ALTER TABLE IF EXISTS public.consents 
  ALTER COLUMN age_confirmed SET DEFAULT TRUE;
