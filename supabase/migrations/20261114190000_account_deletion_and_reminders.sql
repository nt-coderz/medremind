-- =========================================================================
-- MedRemind Production Schema Update
-- Migration: 20261114190000_account_deletion_and_reminders.sql
-- Purpose: Support 24-hour grace period account deletion & reminder columns
-- =========================================================================

-- 1. Update profiles status check constraint to support 'Pending_Deletion'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
    CHECK (status IN ('Active', 'Suspended', 'Deactivated', 'Pending_Deletion'));

-- 2. Add scheduled deletion tracking columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 3. Index for efficient lookup of pending account deletions by worker
CREATE INDEX IF NOT EXISTS idx_profiles_scheduled_deletion 
    ON public.profiles(scheduled_deletion_at) 
    WHERE status = 'Pending_Deletion';

-- 4. Audit log event type check update (if constraint exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
    ) THEN
        ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
        ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
            CHECK (type IN ('DOSE_REMINDER', 'MISSED_DOSE_ALERT', 'PRESCRIPTION_VERIFIED', 'CAREGIVER_INVITE', 'SYSTEM', 'UNCONFIRMED_DOSE_ALERT', 'ACCOUNT_DELETION'));
    END IF;
END $$;
