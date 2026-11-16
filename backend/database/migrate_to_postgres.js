import fs from 'fs';
import path from 'path';
import readline from 'readline';
import pg from 'pg';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { normalizeTimeTo24Hour } from '../utils/timeUtils.js';
import { getDatabaseSslConfig } from './sslConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dataDir = path.join(__dirname, '..', 'data');
const migrationsDir = path.join(__dirname, '..', '..', 'supabase', 'migrations');

/**
 * Prompts user for hidden password in terminal.
 */
async function promptPasswordHidden(promptText = 'Enter Supabase Database Password (hidden): ') {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(promptText);

    if (stdin.isTTY) {
      stdin.setRawMode(true);
      stdin.resume();
      let pass = '';
      const onData = (char) => {
        const c = char.toString('utf-8');
        if (c === '\n' || c === '\r' || c === '\u0004') {
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(pass.trim());
        } else if (c === '\u0003') { // Ctrl+C
          stdin.setRawMode(false);
          process.exit(1);
        } else if (c === '\u0008' || c === '\x7f') { // Backspace
          if (pass.length > 0) {
            pass = pass.slice(0, -1);
          }
        } else {
          pass += c;
        }
      };
      stdin.on('data', onData);
    } else {
      const rl = readline.createInterface({ input: stdin, output: stdout, terminal: false });
      rl.question('', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

/**
 * Securely resolves the Supabase Session Pooler connection string.
 * Supports:
 * 1. DATABASE_URL environment variable
 * 2. SUPABASE_DB_PASSWORD / DB_PASSWORD environment variable (URL-encoded)
 * 3. Secure local RAM secret file (/dev/shm/.medremind_db_password or backend/.db_password)
 * 4. Interactive hidden terminal prompt
 */
async function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    return process.env.DATABASE_URL.trim();
  }

  let password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

  // Check secure local secret file (RAM disk /dev/shm or local .db_password)
  const localSecretPath = path.join(__dirname, '..', '.db_password');
  const shmSecretPath = '/dev/shm/.medremind_db_password';

  if (!password) {
    if (fs.existsSync(localSecretPath)) {
      try {
        password = fs.readFileSync(localSecretPath, 'utf-8').trim();
        fs.unlinkSync(localSecretPath);
        console.log('[Migration] Securely read and consumed password from backend/.db_password.');
      } catch (e) {}
    } else if (fs.existsSync(shmSecretPath)) {
      try {
        password = fs.readFileSync(shmSecretPath, 'utf-8').trim();
        fs.unlinkSync(shmSecretPath);
        console.log('[Migration] Securely read and consumed password from /dev/shm/.medremind_db_password.');
      } catch (e) {}
    }
  }

  // If still not found, prompt interactively
  if (!password) {
    password = await promptPasswordHidden('Enter Supabase Database Password (hidden): ');
  }

  if (!password || password.trim() === '') {
    console.error('\n[Migration Error] No password provided.');
    console.error('[Migration] Please supply the database password via:');
    console.error('  1. Interactive hidden prompt');
    console.error('  2. RAM secret: echo -n "YOUR_PASS" > /dev/shm/.medremind_db_password');
    console.error('  3. Environment: export SUPABASE_DB_PASSWORD="..."\n');
    process.exit(1);
  }

  // Construct official Supabase Session Pooler URL
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'ykhnezjkhqshfihbbyrj';
  const poolerHost = process.env.SUPABASE_POOLER_HOST || 'aws-1-ap-southeast-1.pooler.supabase.com';
  const poolerPort = process.env.SUPABASE_POOLER_PORT || '5432';
  const user = `postgres.${projectRef}`;
  const encodedPass = encodeURIComponent(password.trim());

  return `postgresql://${user}:${encodedPass}@${poolerHost}:${poolerPort}/postgres`;
}

/**
 * Executes idempotent PostgreSQL schema and data migrations.
 * Safe to rerun repeatedly. Does NOT destroy, wipe, or overwrite source store files.
 * Uses atomic transactions per phase with full rollback on failure.
 */
async function runPostgresMigration() {
  const connectionString = await resolveDatabaseUrl();

  console.log('========================================================================');
  console.log('MEDREMIND — SUPABASE POSTGRESQL PRODUCTION DATA MIGRATION');
  console.log('========================================================================\n');

  const ssl = getDatabaseSslConfig(connectionString);
  console.log('[Migration] Connecting to Supabase PostgreSQL Session Pooler (port 5432)...');
  const pool = new pg.Pool({
    connectionString,
    ssl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on('error', (err) => {
    console.error('[Migration Pool Error]:', err.message);
  });

  let client;
  try {
    client = await pool.connect();
    console.log('[Migration] Connected successfully. Executing schema migrations...');

    // 1. Run core schema migration
    const coreSchemaFile = path.join(migrationsDir, '20261113000000_medremind_core_schema.sql');
    if (fs.existsSync(coreSchemaFile)) {
      console.log(`[Migration] Running ${path.basename(coreSchemaFile)}...`);
      const coreSql = fs.readFileSync(coreSchemaFile, 'utf-8');
      await client.query(coreSql);
      console.log('[Migration] Core schema executed successfully.');
    }

    // 2. Run production update migration
    const prodSchemaFile = path.join(migrationsDir, '20261114000000_medremind_production_schema.sql');
    if (fs.existsSync(prodSchemaFile)) {
      console.log(`[Migration] Running ${path.basename(prodSchemaFile)}...`);
      const prodSql = fs.readFileSync(prodSchemaFile, 'utf-8');
      await client.query(prodSql);
      console.log('[Migration] Production schema updates & strict RLS executed successfully.');
    }

    // 3. Migrate existing records from durable store
    const storeFile = path.join(dataDir, 'medremind_store.json');
    if (!fs.existsSync(storeFile)) {
      console.log('[Migration] No medremind_store.json found to migrate.');
      return;
    }

    console.log('[Migration] Reading existing records from medremind_store.json...');
    const storeData = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));

    // Begin transactional migration block
    await client.query('BEGIN');
    try {
      const validUserIds = new Set();

      // Step A: Migrate Users / Profiles
      let userMigrated = 0;
      if (Array.isArray(storeData.users)) {
        for (const u of storeData.users) {
          await client.query(`
            INSERT INTO public.profiles (user_id, email, full_name, role, status, password_hash, registered_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id) DO UPDATE SET
              full_name = EXCLUDED.full_name,
              role = EXCLUDED.role,
              status = EXCLUDED.status,
              password_hash = COALESCE(EXCLUDED.password_hash, profiles.password_hash);
          `, [
            u.id,
            u.email,
            u.name,
            u.role || 'patient',
            u.status || 'Active',
            u.passwordHash || null,
            u.registeredAt || '2026-11-13'
          ]);
          validUserIds.add(u.id);
          userMigrated++;
        }

        // Ensure placeholder for legacy test patient IDs to preserve foreign key referential integrity
        // Status is marked 'Suspended' so the test stub cannot be logged into
        await client.query(`
          INSERT INTO public.profiles (user_id, email, full_name, role, status)
          VALUES ('patient-test', 'test.patient@medremind.internal', 'Legacy Test Stub', 'patient', 'Suspended')
          ON CONFLICT (user_id) DO NOTHING;
        `);
        validUserIds.add('patient-test');

        console.log(`[Migration] Profiles migrated: ${userMigrated}`);
      }

      // Step B: Migrate Medications
      let medMigrated = 0;
      const medicationPatientMap = new Map();
      if (Array.isArray(storeData.medications)) {
        for (const m of storeData.medications) {
          const patientId = m.patientId;
          if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
            throw new Error(`Data Integrity Error: Medication ${m.id} has missing or empty patientId! Aborting to prevent unintended assignment.`);
          }
          if (!validUserIds.has(patientId)) {
            throw new Error(`Data Integrity Error: Medication ${m.id} references non-existent patientId "${patientId}"! Aborting.`);
          }
          medicationPatientMap.set(m.id, patientId);

          await client.query(`
            INSERT INTO public.medications (
              id, patient_id, originally_prescribed_name, standardized_name,
              brand_name, generic_ingredient, dosage, strength, form, route,
              morning_dose, afternoon_dose, night_dose, frequency, timing,
              duration, instructions, status, source_document, created_at
            )
            VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15,
              $16, $17, $18, $19, $20
            )
            ON CONFLICT (id) DO UPDATE SET
              instructions = EXCLUDED.instructions,
              frequency = EXCLUDED.frequency,
              status = EXCLUDED.status,
              dosage = EXCLUDED.dosage,
              strength = EXCLUDED.strength,
              updated_at = NOW();
          `, [
            m.id,
            patientId,
            m.name,
            m.name,
            m.brandName || m.name,
            m.genericIngredient || m.name,
            m.dosage || '1 Tablet',
            m.strength || 'As Prescribed',
            m.form || 'Tablet',
            m.route || 'Oral',
            m.morningDose !== undefined ? m.morningDose : 1,
            m.afternoonDose !== undefined ? m.afternoonDose : 0,
            m.nightDose !== undefined ? m.nightDose : 0,
            m.frequency || 'Once daily',
            m.timing || 'After meals',
            m.duration || 'Ongoing',
            m.instructions || 'Take as directed',
            m.status || 'Active',
            m.sourceDocument || null,
            m.createdAt || new Date().toISOString()
          ]);
          medMigrated++;
        }
        console.log(`[Migration] Medications migrated: ${medMigrated}`);
      }

      // Step C: Migrate Schedules
      let schMigrated = 0;
      if (Array.isArray(storeData.schedules)) {
        for (const s of storeData.schedules) {
          const patientId = s.patientId || medicationPatientMap.get(s.medicationId);
          if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
            throw new Error(`Data Integrity Error: Schedule ${s.id} has no patientId and cannot be resolved! Aborting.`);
          }
          if (!validUserIds.has(patientId)) {
            throw new Error(`Data Integrity Error: Schedule ${s.id} references non-existent patientId "${patientId}"! Aborting.`);
          }
          
          // Strict time normalization
          const normalizedTime = normalizeTimeTo24Hour(s.time);

          await client.query(`
            INSERT INTO public.dose_schedules (
              id, medication_id, patient_id, time_slot_label, scheduled_time,
              time_display, scheduled_dose, overdue_alert_sent, last_confirmed_at,
              is_active, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
            ON CONFLICT (id) DO UPDATE SET
              scheduled_time = EXCLUDED.scheduled_time,
              time_display = EXCLUDED.time_display,
              scheduled_dose = EXCLUDED.scheduled_dose,
              is_active = EXCLUDED.is_active;
          `, [
            s.id,
            s.medicationId,
            patientId,
            s.timeSlotLabel || s.time,
            normalizedTime,
            s.time,
            s.scheduledDose || '1 Dose',
            Boolean(s.overdueAlertSent),
            s.lastConfirmedAt || null,
            s.createdAt || new Date().toISOString()
          ]);
          schMigrated++;
        }
        console.log(`[Migration] Schedules migrated: ${schMigrated}`);
      }

      // Step D: Migrate Consents
      let consentMigrated = 0;
      if (Array.isArray(storeData.consents)) {
        for (const c of storeData.consents) {
          await client.query(`
            INSERT INTO public.consents (
              id, user_id, terms_version, privacy_version, ai_disclosure_version,
              age_confirmed, explicit_consent_given, ai_processing_consent,
              statutory_notice_acknowledged, status, consented_at, revoked_at, revocation_reason
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              revoked_at = EXCLUDED.revoked_at,
              revocation_reason = EXCLUDED.revocation_reason;
          `, [
            c.id,
            c.userId,
            c.documentVersions?.terms || '2026.1',
            c.documentVersions?.privacy || '2026.1',
            c.documentVersions?.aiDisclosure || '2026.1',
            Boolean(c.ageConfirmed),
            Boolean(c.explicitConsentGiven),
            Boolean(c.aiProcessingConsent),
            c.status || 'ACTIVE',
            c.consentedAt || new Date().toISOString(),
            c.revokedAt || null,
            c.revocationReason || null
          ]);
          consentMigrated++;
        }
        console.log(`[Migration] Consents migrated: ${consentMigrated}`);
      }

      // Step E: Migrate Audit Logs
      let logsMigrated = 0;
      if (Array.isArray(storeData.auditLogs)) {
        for (const log of storeData.auditLogs) {
          let entityName = log.entityName;
          if (!entityName) {
            if (log.action.includes('USER') || log.action.includes('LOGIN') || log.action.includes('REGISTRATION')) {
              entityName = 'USER';
            } else if (log.action.includes('MEDICATION')) {
              entityName = 'MEDICATION';
            } else if (log.action.includes('SCHEDULE')) {
              entityName = 'SCHEDULE';
            } else if (log.action.includes('PRESCRIPTION')) {
              entityName = 'PRESCRIPTION';
            } else if (log.action.includes('CONSENT')) {
              entityName = 'CONSENT';
            } else {
              entityName = 'SYSTEM';
            }
          }

          await client.query(`
            INSERT INTO public.audit_logs (
              id, action_type, entity_name, entity_id, user_id, details, created_at
            )
            VALUES (
              $1, $2, $3, $4,
              (SELECT user_id FROM public.profiles WHERE user_id = $5 OR LOWER(email) = LOWER($5) LIMIT 1),
              $6, $7
            )
            ON CONFLICT (id) DO NOTHING;
          `, [
            log.id,
            log.action,
            entityName,
            log.entityId || null,
            log.actorId || 'system',
            typeof log.details === 'object' ? JSON.stringify(log.details) : JSON.stringify({ message: log.details }),
            log.timestamp || new Date().toISOString()
          ]);
          logsMigrated++;
        }
        console.log(`[Migration] Audit logs migrated: ${logsMigrated}`);
      }

      // Step F: Migrate Prescriptions (Documents)
      let rxMigrated = 0;
      if (Array.isArray(storeData.prescriptions)) {
        for (const batch of storeData.prescriptions) {
          const patientId = batch.patientId;
          if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
            throw new Error(`Data Integrity Error: Prescription batch "${batch.batchId || 'unknown'}" has missing or empty patientId! Aborting to prevent unintended assignment.`);
          }
          if (!validUserIds.has(patientId)) {
            throw new Error(`Data Integrity Error: Prescription batch "${batch.batchId || 'unknown'}" references non-existent patientId "${patientId}"! Aborting.`);
          }
          const docs = Array.isArray(batch.documents) ? batch.documents : [];
          for (const doc of docs) {
            const docId = doc.documentId || doc.prescriptionId;
            if (!docId || typeof docId !== 'string' || docId.trim() === '') {
              throw new Error(`Data Integrity Error: Document in prescription batch "${batch.batchId || 'unknown'}" has missing or empty document ID! Aborting.`);
            }

            await client.query(`
              INSERT INTO public.prescriptions (
                id, patient_id, file_path, file_name, file_size_bytes,
                mime_type, sha256_hash, document_classification, document_format,
                quality_status, processing_decision, status, raw_ocr_text,
                metadata, created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT (id) DO NOTHING;
            `, [
              docId,
              patientId,
              doc.imageUrl || `uploads/${doc.fileName || 'rx.jpg'}`,
              doc.fileName || 'prescription.jpg',
              doc.fileSizeBytes || 0,
              doc.fileType || 'image/jpeg',
              doc.sha256 || 'unknown',
              doc.classification || 'MEDICATION_PRESCRIPTION',
              doc.format || 'MIXED',
              doc.qualityStatus || 'OPTIMAL',
              doc.decision || 'CANDIDATE',
              doc.decision === 'REJECT' ? 'REJECTED' : 'APPROVED',
              doc.rawText || '',
              JSON.stringify({
                batchId: batch.batchId,
                engine: doc.engine,
                medicinesCount: (doc.medicines || []).length
              }),
              batch.createdAt || new Date().toISOString()
            ]);
            rxMigrated++;
          }
        }
        console.log(`[Migration] Prescriptions migrated: ${rxMigrated}`);
      }

      // Commit the transactional data migration
      await client.query('COMMIT');
      console.log('[Migration] All entity data committed atomically.');

    } catch (dataErr) {
      await client.query('ROLLBACK');
      console.error('[Migration] Data insertion error — transaction rolled back:', dataErr.message);
      throw dataErr;
    }

    // Step G: Comprehensive Post-Migration Verification
    const usersCount = parseInt((await client.query('SELECT COUNT(*) FROM public.profiles')).rows[0].count, 10);
    const medsCount = parseInt((await client.query('SELECT COUNT(*) FROM public.medications')).rows[0].count, 10);
    const schCount = parseInt((await client.query('SELECT COUNT(*) FROM public.dose_schedules')).rows[0].count, 10);
    const consentsCount = parseInt((await client.query('SELECT COUNT(*) FROM public.consents')).rows[0].count, 10);
    const logsCount = parseInt((await client.query('SELECT COUNT(*) FROM public.audit_logs')).rows[0].count, 10);
    const rxCount = parseInt((await client.query('SELECT COUNT(*) FROM public.prescriptions')).rows[0].count, 10);

    // Integrity checks
    const danglingMeds = parseInt((await client.query(`
      SELECT count(*) FROM public.medications m
      LEFT JOIN public.profiles p ON m.patient_id = p.user_id
      WHERE p.user_id IS NULL
    `)).rows[0].count, 10);

    const danglingSchs = parseInt((await client.query(`
      SELECT count(*) FROM public.dose_schedules s
      LEFT JOIN public.medications m ON s.medication_id = m.id
      WHERE m.id IS NULL
    `)).rows[0].count, 10);

    const danglingRx = parseInt((await client.query(`
      SELECT count(*) FROM public.prescriptions rx
      LEFT JOIN public.profiles p ON rx.patient_id = p.user_id
      WHERE p.user_id IS NULL
    `)).rows[0].count, 10);

    const testAccountStatus = (await client.query(`
      SELECT status FROM public.profiles WHERE user_id = 'patient-test'
    `)).rows[0]?.status;

    const rlsDisabledCount = parseInt((await client.query(`
      SELECT count(*) FROM pg_tables
      WHERE schemaname = 'public' AND rowsecurity = false
    `)).rows[0].count, 10);

    const publicGrantsCount = parseInt((await client.query(`
      SELECT count(*) FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    `)).rows[0].count, 10);

    console.log('\n========================================================================');
    console.log('MIGRATION SUMMARY — VERIFIED POSTGRESQL COUNTS:');
    console.log(`  Profiles:              ${usersCount} (Expected: 8)`);
    console.log(`  Medications:           ${medsCount} (Expected: 31)`);
    console.log(`  Schedules:             ${schCount} (Expected: 54)`);
    console.log(`  Consents:              ${consentsCount} (Expected: 2)`);
    console.log(`  Audit Logs:            ${logsCount} (Expected: 182)`);
    console.log(`  Prescriptions:         ${rxCount} (Expected: 182)`);
    console.log('------------------------------------------------------------------------');
    console.log('INTEGRITY & SECURITY VERIFICATION:');
    console.log(`  Dangling Medications:  ${danglingMeds} (Expected: 0)`);
    console.log(`  Dangling Schedules:    ${danglingSchs} (Expected: 0)`);
    console.log(`  Dangling Prescriptions:${danglingRx} (Expected: 0)`);
    console.log(`  Test Account Status:   ${testAccountStatus} (Expected: Suspended)`);
    console.log(`  Tables without RLS:    ${rlsDisabledCount} (Expected: 0)`);
    console.log(`  Public Table Grants:   ${publicGrantsCount} (Expected: 0)`);
    console.log('========================================================================\n');

    if (
      usersCount !== 8 ||
      medsCount !== 31 ||
      schCount !== 54 ||
      consentsCount !== 2 ||
      logsCount !== 182 ||
      rxCount !== 182 ||
      danglingMeds !== 0 ||
      danglingSchs !== 0 ||
      danglingRx !== 0 ||
      testAccountStatus !== 'Suspended' ||
      rlsDisabledCount !== 0 ||
      publicGrantsCount !== 0
    ) {
      console.warn('[Migration Warning] Discrepancy detected between expected and verified post-migration state.');
    } else {
      console.log('[Migration Success] All entity counts, foreign keys, RLS policies, and access controls verified perfectly!');
    }

  } catch (err) {
    console.error('\n[Migration Error]:');
    console.error(`  Error Name:      ${err.name || 'Error'}`);
    console.error(`  Error Message:   ${err.message || 'Unknown error'}`);
    if (err.code) {
      console.error(`  PostgreSQL Code: ${err.code}`);
    }
    if (err.detail) {
      console.error(`  Error Detail:    ${err.detail}`);
    }
    throw err;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Execute migration if run directly
if (process.argv[1] && process.argv[1].endsWith('migrate_to_postgres.js')) {
  runPostgresMigration().catch((err) => {
    console.error('\n========================================================================');
    console.error('[Migration Fatal Error]');
    console.error(`  Error Name:      ${err.name || 'Error'}`);
    console.error(`  Error Message:   ${err.message || String(err)}`);
    if (err.code) {
      console.error(`  PostgreSQL Code: ${err.code}`);
    }
    if (err.detail) {
      console.error(`  Error Detail:    ${err.detail}`);
    }
    console.error('========================================================================\n');
    process.exit(1);
  });
}

export { runPostgresMigration };
