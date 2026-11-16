-- Migration: Add allergies and medical information to user profiles
-- Created: 2026-11-15
-- Reason: Item 6 - Patient medical profile, allergy warning checks, doctor export support

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allergies TEXT[] DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS medical_info JSONB DEFAULT '{}'::JSONB;

-- GIN index for efficient JSON queries if needed
CREATE INDEX IF NOT EXISTS idx_profiles_medical_info ON public.profiles USING GIN (medical_info);

COMMENT ON COLUMN public.profiles.allergies IS 'Array of recorded patient drug/food/environmental allergies';
COMMENT ON COLUMN public.profiles.medical_info IS 'Structured medical attributes: blood_type, conditions, primary_doctor, emergency_contact, height, weight, notes';
