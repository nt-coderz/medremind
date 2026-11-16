-- Migration: Add DOB, Gender, and Phone Number to user profiles
-- Created: 2026-11-15
-- Reason: OTP removal and direct profile attributes requirement (DOB, Gender, Email, Phone, Name)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create index for fast phone number lookups during login
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);

COMMENT ON COLUMN public.profiles.dob IS 'Patient date of birth';
COMMENT ON COLUMN public.profiles.gender IS 'Patient gender identity';
COMMENT ON COLUMN public.profiles.phone_number IS 'Patient primary contact phone number';
