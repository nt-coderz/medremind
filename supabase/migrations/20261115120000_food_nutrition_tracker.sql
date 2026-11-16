-- ============================================================================
-- MedRemind Nutrition Tracker & Food Logs Schema
-- Migration: 20261115120000_food_nutrition_tracker.sql
-- ============================================================================

-- 1. Create public.food_logs table
CREATE TABLE IF NOT EXISTS public.food_logs (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    food_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'serving',
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    log_time TEXT,
    calories NUMERIC NOT NULL DEFAULT 0,
    protein_g NUMERIC NOT NULL DEFAULT 0,
    carbs_g NUMERIC NOT NULL DEFAULT 0,
    fat_g NUMERIC NOT NULL DEFAULT 0,
    fibre_g NUMERIC NOT NULL DEFAULT 0,
    is_estimated BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT DEFAULT 'local',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_food_logs_patient_date ON public.food_logs(patient_id, log_date);
CREATE INDEX IF NOT EXISTS idx_food_logs_meal_type ON public.food_logs(meal_type);

-- 2. Create public.nutrition_targets table
CREATE TABLE IF NOT EXISTS public.nutrition_targets (
    patient_id TEXT PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    calories_target NUMERIC NOT NULL DEFAULT 2000,
    protein_target_g NUMERIC NOT NULL DEFAULT 60,
    carbs_target_g NUMERIC NOT NULL DEFAULT 250,
    fat_target_g NUMERIC NOT NULL DEFAULT 65,
    fibre_target_g NUMERIC NOT NULL DEFAULT 30,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.nutrition_targets ENABLE ROW LEVEL SECURITY;

-- 3. Apply Least-Privilege & Service Role policies matching MedRemind conventions
REVOKE ALL ON public.food_logs FROM anon, authenticated;
REVOKE ALL ON public.nutrition_targets FROM anon, authenticated;

DROP POLICY IF EXISTS "Service role access on food_logs" ON public.food_logs;
CREATE POLICY "Service role access on food_logs"
  ON public.food_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role access on nutrition_targets" ON public.nutrition_targets;
CREATE POLICY "Service role access on nutrition_targets"
  ON public.nutrition_targets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
