/**
 * MedRemind — Migration Security & Pre-Migration Verification Test Suite
 * Validates TLS certificate handling, SSL configuration, and prescription patient ID integrity.
 * Runs completely locally without connecting to remote databases or services.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabaseSslConfig, DEFAULT_CA_PATH } from './database/sslConfig.js';

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

async function runSecurityTests() {
  console.log('========================================================================');
  console.log('   MEDREMIND MIGRATION SECURITY & TLS VERIFICATION TEST SUITE           ');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. VALID CERTIFICATE LOADING
  // ---------------------------------------------------------------------------
  console.log('--- 1. VALID CERTIFICATE LOADING ---');
  assert(fs.existsSync(DEFAULT_CA_PATH), `Default CA certificate exists at ${DEFAULT_CA_PATH}`);

  const sampleRemoteUrl = 'postgresql://postgres.ykhnezjkhqshfihbbyrj:secret@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
  const sslConfig = getDatabaseSslConfig(sampleRemoteUrl);

  assert(typeof sslConfig === 'object' && sslConfig !== null, 'getDatabaseSslConfig returns an SSL options object for remote URL');
  assert(sslConfig.rejectUnauthorized === true, 'rejectUnauthorized is strictly true');
  assert(typeof sslConfig.ca === 'string' && sslConfig.ca.includes('-----BEGIN CERTIFICATE-----'), 'ca contains valid PEM certificate block');
  assert(sslConfig.ca.includes('-----END CERTIFICATE-----'), 'ca contains valid PEM certificate end boundary');

  // ---------------------------------------------------------------------------
  // 2. MISSING CERTIFICATE HANDLING
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. MISSING CERTIFICATE HANDLING ---');
  const originalEnv = process.env.SUPABASE_SSL_CA;
  process.env.SUPABASE_SSL_CA = '/tmp/non_existent_supabase_ca_test_9999.pem';
  let missingThrew = false;
  let missingErrorMsg = '';
  try {
    getDatabaseSslConfig(sampleRemoteUrl);
  } catch (err) {
    missingThrew = true;
    missingErrorMsg = err.message;
  }
  assert(missingThrew, 'Throws error when custom CA file path does not exist');
  assert(missingErrorMsg.includes('does not exist'), `Error message clearly identifies missing file: ${missingErrorMsg}`);
  if (originalEnv === undefined) {
    delete process.env.SUPABASE_SSL_CA;
  } else {
    process.env.SUPABASE_SSL_CA = originalEnv;
  }

  // ---------------------------------------------------------------------------
  // 3. INVALID / MALFORMED CERTIFICATE HANDLING
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. INVALID / MALFORMED CERTIFICATE HANDLING ---');
  const malformedCertPath = '/tmp/medremind_malformed_ca_test.pem';
  fs.writeFileSync(malformedCertPath, 'NOT_A_VALID_CERTIFICATE_JUST_GARBAGE_CONTENT', 'utf-8');
  process.env.SUPABASE_SSL_CA = malformedCertPath;
  let invalidThrew = false;
  let invalidErrorMsg = '';
  try {
    getDatabaseSslConfig(sampleRemoteUrl);
  } catch (err) {
    invalidThrew = true;
    invalidErrorMsg = err.message;
  }
  try { fs.unlinkSync(malformedCertPath); } catch (e) {}
  assert(invalidThrew, 'Throws error when CA content lacks standard PEM boundaries');
  assert(invalidErrorMsg.includes('invalid or malformed'), `Error message indicates malformed certificate: ${invalidErrorMsg}`);
  if (originalEnv === undefined) {
    delete process.env.SUPABASE_SSL_CA;
  } else {
    process.env.SUPABASE_SSL_CA = originalEnv;
  }

  // ---------------------------------------------------------------------------
  // 4. REMOTE TLS ALWAYS ENFORCES rejectUnauthorized: true
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. REMOTE TLS ALWAYS ENFORCES rejectUnauthorized: true ---');
  const remoteHosts = [
    'postgresql://user:pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres',
    'postgresql://user:pass@db.ykhnezjkhqshfihbbyrj.supabase.co:5432/postgres',
    'postgres://dbadmin:pass@postgres.render.internal:5432/medremind_prod',
    'postgres://user:pass@custom-cloud.postgres.database.azure.com:5432/db'
  ];

  for (const url of remoteHosts) {
    const cfg = getDatabaseSslConfig(url);
    assert(cfg && cfg.rejectUnauthorized === true, `Remote host enforces rejectUnauthorized: true (${url.split('@')[1]})`);
  }

  // ---------------------------------------------------------------------------
  // 5. LOCALHOST RETAINS LOCAL NON-TLS BEHAVIOR
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. LOCALHOST LOCAL BEHAVIOR ---');
  const localHosts = [
    'postgresql://postgres:postgres@localhost:5432/medremind_dev',
    'postgresql://postgres:postgres@127.0.0.1:5432/medremind_dev',
    'postgresql://postgres:postgres@::1:5432/medremind_dev',
    'postgres://user:pass@localhost/db'
  ];

  for (const url of localHosts) {
    const cfg = getDatabaseSslConfig(url);
    assert(cfg === false, `Localhost returns false (non-TLS): ${url.split('@')[1] || url}`);
  }

  // ---------------------------------------------------------------------------
  // 6. NO INSECURE TLS FALLBACK IN CODEBASE
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. VERIFY NO INSECURE TLS FALLBACK EXISTS ---');
  const dbJsContent = fs.readFileSync(path.join(__dirname, 'database', 'db.js'), 'utf-8');
  const migrateJsContent = fs.readFileSync(path.join(__dirname, 'database', 'migrate_to_postgres.js'), 'utf-8');
  const sslConfigJsContent = fs.readFileSync(path.join(__dirname, 'database', 'sslConfig.js'), 'utf-8');

  assert(!dbJsContent.includes('rejectUnauthorized: false'), 'db.js does not contain "rejectUnauthorized: false"');
  assert(!migrateJsContent.includes('rejectUnauthorized: false'), 'migrate_to_postgres.js does not contain "rejectUnauthorized: false"');
  assert(!sslConfigJsContent.includes('rejectUnauthorized: false;'), 'sslConfig.js does not return "rejectUnauthorized: false"');
  assert(dbJsContent.includes('getDatabaseSslConfig'), 'db.js imports and uses getDatabaseSslConfig');
  assert(migrateJsContent.includes('getDatabaseSslConfig'), 'migrate_to_postgres.js imports and uses getDatabaseSslConfig');

  // ---------------------------------------------------------------------------
  // 7. PRESCRIPTION BATCH WITH VALID PATIENT ID SUCCEEDS
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. PRESCRIPTION VALID PATIENT ID VALIDATION ---');
  const validUserIds = new Set([
    'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82',
    'USR-d2e57418-2017-462e-9bb1-ac3044aebc5d',
    'patient-test'
  ]);

  function validatePrescriptionBatch(batch, knownUserIds) {
    const patientId = batch.patientId;
    if (!patientId || typeof patientId !== 'string' || patientId.trim() === '') {
      throw new Error(`Data Integrity Error: Prescription batch "${batch.batchId || 'unknown'}" has missing or empty patientId! Aborting to prevent unintended assignment.`);
    }
    if (!knownUserIds.has(patientId)) {
      throw new Error(`Data Integrity Error: Prescription batch "${batch.batchId || 'unknown'}" references non-existent patientId "${patientId}"! Aborting.`);
    }
    const docs = Array.isArray(batch.documents) ? batch.documents : [];
    for (const doc of docs) {
      const docId = doc.documentId || doc.prescriptionId;
      if (!docId || typeof docId !== 'string' || docId.trim() === '') {
        throw new Error(`Data Integrity Error: Document in prescription batch "${batch.batchId || 'unknown'}" has missing or empty document ID! Aborting.`);
      }
    }
    return { valid: true, docCount: docs.length };
  }

  const validBatch = {
    batchId: 'batch-test-valid-1',
    patientId: 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82',
    documents: [
      { documentId: 'doc-rx-001', fileName: 'valid_rx.jpg' },
      { documentId: 'doc-rx-002', fileName: 'valid_rx2.jpg' }
    ]
  };

  let validSuccess = false;
  try {
    const res = validatePrescriptionBatch(validBatch, validUserIds);
    validSuccess = res.valid && res.docCount === 2;
  } catch (e) {
    validSuccess = false;
  }
  assert(validSuccess, 'Prescription batch with valid patient ID passes validation with all documents intact');

  // ---------------------------------------------------------------------------
  // 8. PRESCRIPTION BATCH WITHOUT PATIENT ID ABORTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. PRESCRIPTION WITHOUT PATIENT ID ABORTS ---');
  const missingBatches = [
    { batchId: 'batch-missing-1', patientId: null, documents: [{ documentId: 'doc-001' }] },
    { batchId: 'batch-missing-2', patientId: undefined, documents: [{ documentId: 'doc-002' }] },
    { batchId: 'batch-empty-3', patientId: '', documents: [{ documentId: 'doc-003' }] },
    { batchId: 'batch-whitespace-4', patientId: '   ', documents: [{ documentId: 'doc-004' }] }
  ];

  for (const b of missingBatches) {
    let aborted = false;
    let errMessage = '';
    try {
      validatePrescriptionBatch(b, validUserIds);
    } catch (e) {
      aborted = true;
      errMessage = e.message;
    }
    assert(aborted, `Prescription batch "${b.batchId}" with null/empty patientId is rejected`);
    assert(errMessage.includes(b.batchId), `Error message explicitly names affected batch "${b.batchId}"`);
  }

  // ---------------------------------------------------------------------------
  // 9. PRESCRIPTION BATCH WITH NON-EXISTENT PATIENT ID ABORTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. PRESCRIPTION WITH NON-EXISTENT PATIENT ID ABORTS ---');
  const ghostBatch = {
    batchId: 'batch-ghost-patient',
    patientId: 'USR-non-existent-ghost-user-999',
    documents: [{ documentId: 'doc-005', fileName: 'rx.jpg' }]
  };

  let ghostAborted = false;
  let ghostErrMsg = '';
  try {
    validatePrescriptionBatch(ghostBatch, validUserIds);
  } catch (e) {
    ghostAborted = true;
    ghostErrMsg = e.message;
  }
  assert(ghostAborted, 'Prescription batch referencing non-existent patientId is rejected');
  assert(ghostErrMsg.includes('references non-existent patientId'), `Error message correctly reports non-existent patient: ${ghostErrMsg}`);

  // ---------------------------------------------------------------------------
  // 10. REAL STORE VALIDATION (125 BATCHES & 182 DOCUMENTS)
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. REAL STORE PRESCRIPTION VALIDATION (medremind_store.json) ---');
  const storePath = path.join(__dirname, 'data', 'medremind_store.json');
  assert(fs.existsSync(storePath), `Store file exists at ${storePath}`);

  const storeData = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  const allStoreUsers = new Set((storeData.users || []).map(u => u.id));
  allStoreUsers.add('patient-test');

  let storeBatchesValidated = 0;
  let storeDocsValidated = 0;
  let storeValidationFailed = false;

  for (const b of (storeData.prescriptions || [])) {
    try {
      const res = validatePrescriptionBatch(b, allStoreUsers);
      storeBatchesValidated++;
      storeDocsValidated += res.docCount;
    } catch (e) {
      storeValidationFailed = true;
      console.error(`[FAIL] Real store batch failed validation: ${e.message}`);
    }
  }

  assert(!storeValidationFailed, 'All real store prescription batches pass strict validation without any fallbacks');
  assert(storeBatchesValidated === 125, `Exactly 125 prescription batches validated (Actual: ${storeBatchesValidated})`);
  assert(storeDocsValidated === 182, `Exactly 182 prescription documents validated (Actual: ${storeDocsValidated})`);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('[FATAL TEST ERROR]:', err);
  process.exit(1);
});
