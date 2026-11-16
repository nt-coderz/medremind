-- MedRemind Core Database Schema
-- Level 2 Prescription Verification & Medication Management
-- Standardized on Application String Identifiers (TEXT) with Strict Referential Integrity

-- Enable UUID extension for internal system tokens if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID DEFAULT uuid_generate_v4(),
    user_id TEXT PRIMARY KEY, -- Canonical Application User ID (e.g. USR-...)
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'caregiver', 'admin')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Deactivated')),
    password_hash TEXT,
    registered_at DATE DEFAULT CURRENT_DATE,
    blood_type TEXT,
    allergies TEXT[] DEFAULT '{}',
    emergency_contact JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Prescriptions Table (Uploaded Documents)
CREATE TABLE IF NOT EXISTS public.prescriptions (
    id TEXT PRIMARY KEY, -- rx-..., batch-...
    patient_id TEXT NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    sha256_hash TEXT NOT NULL,
    document_classification TEXT NOT NULL CHECK (document_classification IN (
        'MEDICATION_PRESCRIPTION',
        'CLINICAL_CONSULTATION_NOTE',
        'LAB_REPORT',
        'DISCHARGE_SUMMARY',
        'MEDICAL_REPORT',
        'MEDICAL_BILL',
        'MEDICINE_PACKAGING',
        'NON_MEDICAL_DOCUMENT',
        'BLANK_OR_UNREADABLE',
        'UNKNOWN'
    )),
    document_format TEXT NOT NULL DEFAULT 'MIXED' CHECK (document_format IN ('HANDWRITTEN', 'TYPED', 'MIXED', 'UNKNOWN')),
    quality_status TEXT NOT NULL DEFAULT 'OPTIMAL' CHECK (quality_status IN ('OPTIMAL', 'ACCEPTABLE', 'BLURRY', 'DARK', 'CROPPED', 'UNREADABLE')),
    processing_decision TEXT NOT NULL DEFAULT 'CANDIDATE' CHECK (processing_decision IN ('CANDIDATE', 'REVIEW', 'RETAKE', 'REJECT', 'PROCESSING_FAILED')),
    status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'DISCARDED')),
    doctor_name TEXT,
    clinic_hospital TEXT,
    rx_date DATE,
    raw_ocr_text TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Prescription Extractions Table (Extracted Medicine Entities)
CREATE TABLE IF NOT EXISTS public.prescription_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prescription_id TEXT NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
    raw_recognized_name TEXT NOT NULL,
    interpreted_name TEXT NOT NULL,
    strength TEXT,
    dosage TEXT,
    route TEXT DEFAULT 'Oral',
    frequency TEXT,
    timing TEXT,
    duration TEXT,
    quantity TEXT,
    instructions TEXT,
    field_confidence JSONB NOT NULL DEFAULT '{}',
    is_uncertain BOOLEAN NOT NULL DEFAULT FALSE,
    uncertain_reasons TEXT[] DEFAULT '{}',
    source_line TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Medications Table (Approved Active Prescriptions)
CREATE TABLE IF NOT EXISTS public.medications (
    id TEXT PRIMARY KEY, -- med-...
    patient_id TEXT NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    prescription_id TEXT REFERENCES public.prescriptions(id) ON DELETE SET NULL,
    originally_prescribed_name TEXT NOT NULL,
    standardized_name TEXT NOT NULL,
    brand_name TEXT,
    generic_ingredient TEXT,
    strength TEXT DEFAULT 'As Prescribed',
    dosage TEXT NOT NULL DEFAULT '1 Tablet',
    form TEXT NOT NULL DEFAULT 'Tablet',
    route TEXT DEFAULT 'Oral',
    morning_dose INTEGER DEFAULT 1,
    afternoon_dose INTEGER DEFAULT 0,
    night_dose INTEGER DEFAULT 0,
    frequency TEXT NOT NULL DEFAULT 'Once daily',
    timing TEXT DEFAULT 'After meals',
    duration TEXT DEFAULT 'Ongoing',
    instructions TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'ACTIVE', 'Completed', 'Discontinued', 'Paused')),
    refills_remaining INTEGER DEFAULT 0,
    pill_count INTEGER DEFAULT 30,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    color TEXT DEFAULT '#238B78',
    source_document TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Dose Schedules Table
CREATE TABLE IF NOT EXISTS public.dose_schedules (
    id TEXT PRIMARY KEY, -- sch-...
    medication_id TEXT NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    time_slot_label TEXT NOT NULL, -- e.g. "Morning (8:00 AM)"
    scheduled_time TIME NOT NULL,  -- e.g. "08:00:00"
    time_display TEXT,             -- e.g. "08:00 AM"
    scheduled_dose TEXT DEFAULT '1 Dose',
    overdue_alert_sent BOOLEAN DEFAULT FALSE,
    last_confirmed_at TIMESTAMPTZ,
    days_of_week INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Dose Occurrences Table (Individual Daily Instances)
CREATE TABLE IF NOT EXISTS public.dose_occurrences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id TEXT NOT NULL REFERENCES public.dose_schedules(id) ON DELETE CASCADE,
    medication_id TEXT NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    scheduled_timestamp TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'TAKEN', 'SKIPPED', 'MISSED')),
    recorded_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_patient_schedule_date UNIQUE (schedule_id, scheduled_date)
);

-- 7. Caregiver Relationships Table
CREATE TABLE IF NOT EXISTS public.caregiver_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id TEXT NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    caregiver_id TEXT NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{"can_view_routine": true, "can_receive_alerts": true}',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_patient_caregiver UNIQUE (patient_id, caregiver_id)
);

-- 8. Notifications & Alerts Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY, -- notif-...
    recipient_id TEXT NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    sender_id TEXT REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('DOSE_REMINDER', 'MISSED_DOSE_ALERT', 'PRESCRIPTION_VERIFIED', 'CAREGIVER_INVITE', 'SYSTEM', 'UNCONFIRMED_DOSE_ALERT')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY, -- log-...
    user_id TEXT REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    entity_name TEXT NOT NULL DEFAULT 'SYSTEM',
    entity_id TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security (RLS) Enablement
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dose_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dose_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caregiver_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Indexes for Foreign Keys and Query Performance
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_sha256 ON public.prescriptions(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON public.medications(patient_id);
CREATE INDEX IF NOT EXISTS idx_dose_schedules_medication_id ON public.dose_schedules(medication_id);
CREATE INDEX IF NOT EXISTS idx_dose_schedules_patient_id ON public.dose_schedules(patient_id);
CREATE INDEX IF NOT EXISTS idx_dose_occurrences_patient_date ON public.dose_occurrences(patient_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_caregivers_patient_id ON public.caregiver_relationships(patient_id);
CREATE INDEX IF NOT EXISTS idx_caregivers_caregiver_id ON public.caregiver_relationships(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
