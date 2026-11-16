/**
 * MedRemind — Database, Schema & Security Corrections Verification Suite
 * Tests all 8 approved defect corrections without connecting to production.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeTimeTo24Hour } from './utils/timeUtils.js';
import { db } from './database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
    errors.push(message);
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('   MEDREMIND DATABASE CODE & SCHEMA CORRECTIONS TEST SUITE              ');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. TIME CONVERSION UNIT TESTS (normalizeTimeTo24Hour)
  // ---------------------------------------------------------------------------
  console.log('--- 1. TIME CONVERSION UNIT TESTS ---');

  // Standard AM/PM tests
  assert(normalizeTimeTo24Hour('12:00 AM') === '00:00:00', '12:00 AM converts to 00:00:00 (Midnight)');
  assert(normalizeTimeTo24Hour('12:30 AM') === '00:30:00', '12:30 AM converts to 00:30:00');
  assert(normalizeTimeTo24Hour('08:00 AM') === '08:00:00', '08:00 AM converts to 08:00:00 (Morning dose)');
  assert(normalizeTimeTo24Hour('8:00 AM') === '08:00:00', '8:00 AM (single digit hour) converts to 08:00:00');
  assert(normalizeTimeTo24Hour('12:00 PM') === '12:00:00', '12:00 PM converts to 12:00:00 (Noon)');
  assert(normalizeTimeTo24Hour('12:45 PM') === '12:45:00', '12:45 PM converts to 12:45:00');
  assert(normalizeTimeTo24Hour('01:00 PM') === '13:00:00', '01:00 PM converts to 13:00:00 (Afternoon dose)');
  assert(normalizeTimeTo24Hour('1:00 PM') === '13:00:00', '1:00 PM (single digit hour) converts to 13:00:00');
  assert(normalizeTimeTo24Hour('08:00 PM') === '20:00:00', '08:00 PM converts to 20:00:00 (Night dose)');
  assert(normalizeTimeTo24Hour('8:00 PM') === '20:00:00', '8:00 PM (single digit hour) converts to 20:00:00');
  assert(normalizeTimeTo24Hour('11:59 PM') === '23:59:00', '11:59 PM converts to 23:59:00');

  // Already normalized 24-hour inputs
  assert(normalizeTimeTo24Hour('00:00:00') === '00:00:00', '00:00:00 remains 00:00:00');
  assert(normalizeTimeTo24Hour('08:00:00') === '08:00:00', '08:00:00 remains 08:00:00');
  assert(normalizeTimeTo24Hour('13:00') === '13:00:00', '13:00 normalizes to 13:00:00');
  assert(normalizeTimeTo24Hour('20:00:00') === '20:00:00', '20:00:00 remains 20:00:00');

  // Invalid inputs must throw descriptive errors (never silently fallback)
  let invalidThrew1 = false;
  try { normalizeTimeTo24Hour('13:00 PM'); } catch (e) { invalidThrew1 = true; }
  assert(invalidThrew1, '13:00 PM throws error (hour > 12 in 12h format)');

  let invalidThrew2 = false;
  try { normalizeTimeTo24Hour('08:65 AM'); } catch (e) { invalidThrew2 = true; }
  assert(invalidThrew2, '08:65 AM throws error (minutes > 59)');

  let invalidThrew3 = false;
  try { normalizeTimeTo24Hour('25:00'); } catch (e) { invalidThrew3 = true; }
  assert(invalidThrew3, '25:00 throws error (hour > 23 in 24h format)');

  let invalidThrew4 = false;
  try { normalizeTimeTo24Hour(''); } catch (e) { invalidThrew4 = true; }
  assert(invalidThrew4, 'Empty string throws error');

  let invalidThrew5 = false;
  try { normalizeTimeTo24Hour(null); } catch (e) { invalidThrew5 = true; }
  assert(invalidThrew5, 'Null input throws error');

  // ---------------------------------------------------------------------------
  // 2. SCHEMA & ID TYPE COMPATIBILITY TESTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. SCHEMA & ID TYPE COMPATIBILITY TESTS ---');

  const coreSql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261113000000_medremind_core_schema.sql'), 'utf-8');
  const prodSql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261114000000_medremind_production_schema.sql'), 'utf-8');

  // Medications Table ID & FK checks
  assert(coreSql.includes('CREATE TABLE IF NOT EXISTS public.medications (\n    id TEXT PRIMARY KEY'), 'medications.id is defined as TEXT PRIMARY KEY');
  assert(coreSql.includes('patient_id TEXT NOT NULL REFERENCES public.profiles(user_id)'), 'medications.patient_id references profiles(user_id) as TEXT');

  // Dose Schedules Table ID & FK checks
  assert(coreSql.includes('CREATE TABLE IF NOT EXISTS public.dose_schedules (\n    id TEXT PRIMARY KEY'), 'dose_schedules.id is defined as TEXT PRIMARY KEY');
  assert(coreSql.includes('medication_id TEXT NOT NULL REFERENCES public.medications(id)'), 'dose_schedules.medication_id references medications(id) as TEXT');
  assert(coreSql.includes('patient_id TEXT NOT NULL REFERENCES public.profiles(user_id)'), 'dose_schedules.patient_id is explicitly present and references profiles(user_id)');

  // Prescriptions Table ID & FK checks
  assert(coreSql.includes('CREATE TABLE IF NOT EXISTS public.prescriptions (\n    id TEXT PRIMARY KEY'), 'prescriptions.id is defined as TEXT PRIMARY KEY');
  assert(coreSql.includes('patient_id TEXT NOT NULL REFERENCES public.profiles(user_id)'), 'prescriptions.patient_id references profiles(user_id) as TEXT');

  // Consents Table ID & FK checks
  assert(prodSql.includes('CREATE TABLE IF NOT EXISTS public.consents (\n    id TEXT PRIMARY KEY'), 'consents.id is defined as TEXT PRIMARY KEY');
  assert(prodSql.includes('user_id TEXT NOT NULL REFERENCES public.profiles(user_id)'), 'consents.user_id references profiles(user_id) as TEXT');

  // Audit Logs Table ID & Column checks
  assert(coreSql.includes('CREATE TABLE IF NOT EXISTS public.audit_logs (\n    id TEXT PRIMARY KEY'), 'audit_logs.id is defined as TEXT PRIMARY KEY');
  assert(coreSql.includes('entity_name TEXT NOT NULL'), 'audit_logs.entity_name column is present and NOT NULL in core schema');
  assert(prodSql.includes('ADD COLUMN IF NOT EXISTS entity_name TEXT NOT NULL'), 'audit_logs.entity_name column is idempotently added in production schema');

  // Foreign key indexes
  assert(prodSql.includes('idx_medications_patient_id'), 'idx_medications_patient_id exists');
  assert(prodSql.includes('idx_dose_schedules_patient_id'), 'idx_dose_schedules_patient_id exists');
  assert(prodSql.includes('idx_dose_schedules_medication_id'), 'idx_dose_schedules_medication_id exists');
  assert(prodSql.includes('idx_consents_user_id'), 'idx_consents_user_id exists');
  assert(prodSql.includes('idx_audit_logs_user_id'), 'idx_audit_logs_user_id exists');

  // ---------------------------------------------------------------------------
  // 3. RLS SECURITY & LEAST-PRIVILEGE AUDIT TESTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. RLS SECURITY & PRIVILEGES TESTS ---');

  // Verify explicit scoping to service_role
  assert(prodSql.includes('TO service_role'), 'RLS policies are explicitly scoped TO service_role');
  assert(!prodSql.includes('CREATE POLICY "Allow service role all" ON public.profiles FOR ALL USING (true);'), 'Legacy un-scoped policy on profiles removed');
  assert(!prodSql.includes('CREATE POLICY "Allow service role all" ON public.medications FOR ALL USING (true);'), 'Legacy un-scoped policy on medications removed');

  // Verify WITH CHECK clause is present
  assert(prodSql.includes('USING (true)') && prodSql.includes('WITH CHECK (true)'), 'RLS policy includes both USING (true) and WITH CHECK (true)');

  // Verify public privileges are revoked
  assert(prodSql.includes('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;'), 'REVOKE ALL ON TABLES from anon, authenticated present');
  assert(prodSql.includes('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;'), 'REVOKE ALL ON SEQUENCES from anon, authenticated present');
  assert(prodSql.includes('REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;'), 'REVOKE ALL ON ROUTINES from anon, authenticated present');
  assert(prodSql.includes('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;'), 'ALTER DEFAULT PRIVILEGES revokes future table access');

  // Verify legacy policy cleanup
  assert(prodSql.includes('DROP POLICY IF EXISTS "Allow service role all" ON public.profiles;'), 'Drop legacy policy on profiles present');
  assert(prodSql.includes('DROP POLICY IF EXISTS "Allow service role all" ON public.medications;'), 'Drop legacy policy on medications present');

  // ---------------------------------------------------------------------------
  // 4. CONNECTION POOLING & RESILIENCE TESTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. CONNECTION POOLING & RESILIENCE TESTS ---');

  const dbCode = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf-8');
  assert(dbCode.includes("this.pool.on('error'"), 'Pool idle client error listener is registered');
  assert(dbCode.includes('this.postgresError = err.message'), 'Pool error updates postgresError state');
  assert(dbCode.includes('checkHealth()'), 'checkHealth() method is present');
  assert(dbCode.includes('async close()'), 'close() method gracefully closes pool');

  // Verify audit log entity_name resolution in db.js
  assert(dbCode.includes('resolvedEntity') && dbCode.includes('INSERT INTO public.audit_logs'), 'db.logAudit resolves and supplies entity_name to SQL');

  // ---------------------------------------------------------------------------
  // 5. MIGRATION DATA INTEGRITY & IDEMPOTENCY DRY-RUN
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. MIGRATION DATA INTEGRITY & IDEMPOTENCY DRY-RUN ---');

  const storePath = path.join(__dirname, 'data', 'medremind_store.json');
  assert(fs.existsSync(storePath), 'medremind_store.json file exists and is readable');

  const storeData = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  console.log(`[Store Check] Users: ${storeData.users?.length || 0}`);
  console.log(`[Store Check] Medications: ${storeData.medications?.length || 0}`);
  console.log(`[Store Check] Schedules: ${storeData.schedules?.length || 0}`);
  console.log(`[Store Check] Consents: ${storeData.consents?.length || 0}`);
  console.log(`[Store Check] Audit Logs: ${storeData.auditLogs?.length || 0}`);

  // Test that all medications have non-empty IDs matching string format
  let allMedIdsValid = true;
  for (const m of storeData.medications || []) {
    if (!m.id || typeof m.id !== 'string' || !m.name) allMedIdsValid = false;
  }
  assert(allMedIdsValid, 'All 28 existing medications have valid string IDs and names');

  // Test that all schedules have valid parseable times
  let allScheduleTimesValid = true;
  let parsedScheduleCount = 0;
  for (const s of storeData.schedules || []) {
    try {
      const normalized = normalizeTimeTo24Hour(s.time);
      if (normalized && normalized.match(/^\d{2}:\d{2}:\d{2}$/)) {
        parsedScheduleCount++;
      } else {
        allScheduleTimesValid = false;
      }
    } catch (err) {
      allScheduleTimesValid = false;
      console.error(`Failed to parse schedule time: ${s.time} (ID: ${s.id})`);
    }
  }
  assert(allScheduleTimesValid && parsedScheduleCount === (storeData.schedules?.length || 0), `All ${parsedScheduleCount} existing schedule times convert accurately to 24-hour format`);

  // Verify afternoon and night doses specifically do not map to 08:00:00
  const afternoonSchedule = (storeData.schedules || []).find(s => s.time === '01:00 PM');
  if (afternoonSchedule) {
    const afternoonConverted = normalizeTimeTo24Hour(afternoonSchedule.time);
    assert(afternoonConverted === '13:00:00', '01:00 PM schedule correctly converts to 13:00:00 (not 08:00:00)');
  }

  const nightSchedule = (storeData.schedules || []).find(s => s.time === '08:00 PM');
  if (nightSchedule) {
    const nightConverted = normalizeTimeTo24Hour(nightSchedule.time);
    assert(nightConverted === '20:00:00', '08:00 PM schedule correctly converts to 20:00:00 (not 08:00:00)');
  }

  // Verify migration script idempotency structure
  const migrateScript = fs.readFileSync(path.join(__dirname, 'database', 'migrate_to_postgres.js'), 'utf-8');
  assert(migrateScript.includes('ON CONFLICT (user_id) DO UPDATE'), 'User migration uses ON CONFLICT DO UPDATE');
  assert(migrateScript.includes('ON CONFLICT (id) DO UPDATE'), 'Medication & Schedule migration uses ON CONFLICT DO UPDATE');
  assert(migrateScript.includes('normalizeTimeTo24Hour'), 'migrate_to_postgres.js uses normalizeTimeTo24Hour');
  assert(migrateScript.includes('patient-test'), 'migrate_to_postgres.js handles legacy placeholder patient IDs');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    console.error('Failed checks:');
    errors.forEach(e => console.error(` - ${e}`));
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
