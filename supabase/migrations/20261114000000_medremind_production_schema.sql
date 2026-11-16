-- ============================================================================
-- MedRemind Production Schema Update, Consents & Strict RLS Hardening
-- Migration: 20261114000000_medremind_production_schema.sql
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure public.profiles has password_hash and registered_at for Express PBKDF2 Auth
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS registered_at DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 2. Update medications table with brand/generic and daily dosage fields (idempotent)
ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS generic_ingredient TEXT,
  ADD COLUMN IF NOT EXISTS morning_dose INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS afternoon_dose INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_dose INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timing TEXT DEFAULT 'After meals',
  ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT 'Ongoing',
  ADD COLUMN IF NOT EXISTS source_document TEXT;

CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON public.medications(patient_id);

-- 3. Update dose_schedules table with human-readable string time and patient reference
ALTER TABLE public.dose_schedules
  ADD COLUMN IF NOT EXISTS patient_id TEXT REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS time_display TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_dose TEXT DEFAULT '1 Dose',
  ADD COLUMN IF NOT EXISTS overdue_alert_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dose_schedules_patient_id ON public.dose_schedules(patient_id);
CREATE INDEX IF NOT EXISTS idx_dose_schedules_medication_id ON public.dose_schedules(medication_id);

-- 4. Create Statutory DPDP Act, 2023 Consents Table
CREATE TABLE IF NOT EXISTS public.consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    terms_version TEXT NOT NULL,
    privacy_version TEXT NOT NULL,
    ai_disclosure_version TEXT NOT NULL,
    age_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    explicit_consent_given BOOLEAN NOT NULL DEFAULT FALSE,
    ai_processing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    statutory_notice_acknowledged BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'REVOKED')),
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT
);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_consents_user_id ON public.consents(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_status ON public.consents(status);

-- Ensure audit_logs has entity_name column and index
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS entity_name TEXT NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS entity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- ============================================================================
-- 5. Strict Row Level Security (RLS) & Least-Privilege Hardening
-- ============================================================================
-- The backend connects via private DATABASE_URL (service connection).
-- PostgREST / Data API is restricted: anon and authenticated roles have NO direct access.
-- Zero exposure of password hashes, patient profiles, medications, consents, or logs.

-- Revoke all direct privileges on schema public from public web clients
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

-- Ensure newly created tables in public do not grant privileges to anon/authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;

-- Drop legacy/un-scoped policies that may have defaulted to TO PUBLIC
DROP POLICY IF EXISTS "Allow service role all" ON public.profiles;
DROP POLICY IF EXISTS "Allow service role all" ON public.medications;
DROP POLICY IF EXISTS "Allow service role all" ON public.dose_schedules;
DROP POLICY IF EXISTS "Allow service role all" ON public.consents;
DROP POLICY IF EXISTS "Allow service role all" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow service role all" ON public.prescriptions;
DROP POLICY IF EXISTS "Allow service role all" ON public.prescription_extractions;
DROP POLICY IF EXISTS "Allow service role all" ON public.dose_occurrences;
DROP POLICY IF EXISTS "Allow service role all" ON public.caregiver_relationships;
DROP POLICY IF EXISTS "Allow service role all" ON public.notifications;

-- Create explicitly scoped TO service_role policies with both USING and WITH CHECK
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'profiles',
        'prescriptions',
        'prescription_extractions',
        'medications',
        'dose_schedules',
        'dose_occurrences',
        'caregiver_relationships',
        'notifications',
        'audit_logs',
        'consents'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Drop if already exists to ensure idempotent re-runs
        EXECUTE format('DROP POLICY IF EXISTS "service_role_all_%I" ON public.%I;', tbl, tbl);
        
        -- Create strict service_role policy
        EXECUTE format(
            'CREATE POLICY "service_role_all_%I" ON public.%I ' ||
            'TO service_role ' ||
            'FOR ALL ' ||
            'USING (true) ' ||
            'WITH CHECK (true);',
            tbl, tbl
        );
    END LOOP;
END $$;
