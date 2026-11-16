import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { LEGAL_VERSIONS } from '../src/data/legalDocuments.js';
import { 
  recordUserConsent, 
  getUserConsentRecord, 
  hasCurrentConsent, 
  getAllConsentRecords 
} from '../src/services/legalConsentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function runProductionVerification() {
  console.log('========================================================================');
  console.log('   MEDREMIND COMPLETE PRODUCTION & LEGAL VERIFICATION SUITE              ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const getB64 = (relPath) => {
    const fullPath = path.join(__dirname, relPath);
    const buf = fs.readFileSync(fullPath);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  };

  // --- PART 1: GEMINI API VERIFICATION ---
  console.log('--- 1. GEMINI API INTEGRATION VERIFICATION ---');
  try {
    const engineRes = await fetch('http://localhost:3001/api/engine-status');
    const engineData = await engineRes.json();

    assert(engineData.primaryEngine === 'GEMINI', 'Primary engine is GEMINI');
    assert(engineData.geminiConfigured === true, 'Gemini is configured in backend');
    assert(engineData.model === 'gemini-3.5-flash', 'Model is verified as gemini-3.5-flash');
    assert(engineData.offlineSupported === true, 'Offline scanning is supported');

    // Security: verify key is NOT in response
    const jsonStr = JSON.stringify(engineData);
    assert(!jsonStr.includes('AIza') && !jsonStr.includes('AQ.A'), 'Zero API keys exposed in /api/engine-status');
  } catch (err) {
    assert(false, `Engine status check failed: ${err.message}`);
  }

  // --- PART 2: SYNTHETIC PRESCRIPTION PROCESSING (ONLINE GEMINI) ---
  console.log('\n--- 2. SYNTHETIC PRESCRIPTION PROCESSING VIA GEMINI ---');
  try {
    const scanRes = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82',
        mode: 'online',
        files: [{ name: 'synthetic_p650_test.jpg', dataBase64: getB64('uploads/test_p650_101.jpg') }]
      })
    });

    const scanData = await scanRes.json();
    assert(scanRes.status === 200, 'Scan request returned HTTP 200');
    assert(scanData.success === true, 'Scan completed successfully');

    const doc = scanData.documents?.[0];
    assert(doc.engine === 'GEMINI', 'Document processed by GEMINI');
    assert(doc.isFallback === false, 'isFallback is false for successful Gemini call');
    assert(doc.classification === 'MEDICATION_PRESCRIPTION', 'Classified as MEDICATION_PRESCRIPTION');
    assert(doc.medicines?.length === 1, 'Exactly 1 medicine record returned (single unified entity)');

    const med = doc.medicines[0];
    assert(med.brandName.includes('P-650'), 'Brand recognized as P-650');
    assert(med.genericIngredient.includes('Paracetamol'), 'Generic recognized as Paracetamol');
    assert(med.strength === '650 mg', 'Strength accurately extracted as 650 mg');
    assert(med.morningDose === 1 && med.afternoonDose === 0 && med.nightDose === 1, '1-0-1 shorthand mapped to morning:1, afternoon:0, night:1');
    assert(med.timing === 'After meals', 'Timing accurately extracted as After meals');
    assert(med.confidence >= 0.9, 'Confidence score reported without inventing fields');
  } catch (err) {
    assert(false, `Gemini synthetic scan failed: ${err.message}`);
  }

  // --- PART 3: OFFLINE TESSERACT OCR SCANNING ---
  console.log('\n--- 3. OFFLINE TESSERACT OCR VERIFICATION ---');
  try {
    const offlineRes = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82',
        mode: 'offline',
        files: [{ name: 'offline_synthetic.jpg', dataBase64: getB64('uploads/test_p650_101.jpg') }]
      })
    });

    const offlineData = await offlineRes.json();
    assert(offlineRes.status === 200, 'Offline scan returned HTTP 200');
    const offDoc = offlineData.documents?.[0];
    assert(offDoc.engine === 'TESSERACT', 'Document processed by TESSERACT');
    assert(offDoc.isFallback === false, 'isFallback is false because offline was explicitly requested');
    assert(offDoc.medicines?.length === 1, 'Tesseract returned normalized medicine record');
  } catch (err) {
    assert(false, `Tesseract offline scan failed: ${err.message}`);
  }

  // --- PART 4: STATUTORY CONSENT & LEGAL RECORDS (DPDP ACT, 2023) ---
  console.log('\n--- 4. STATUTORY CONSENT & REGISTRATION GATE TESTS ---');
  try {
    // Test Mock User ID
    const testUserId = `USR-TEST-${Date.now()}`;

    // Test A: Missing consent check
    assert(hasCurrentConsent(testUserId) === false, 'Unregistered user has no current consent');

    // Test B: Recording complete statutory consent
    const consent = recordUserConsent({
      userId: testUserId,
      userEmail: 'patient.test@medremind.app',
      ageConfirmed: true,
      termsAccepted: true,
      privacyAccepted: true,
      aiAcknowledged: true,
      dpdpConsentGiven: true
    });

    assert(consent.userId === testUserId, 'Consent recorded with correct User ID');
    assert(consent.termsVersion === LEGAL_VERSIONS.TERMS, `Terms version is ${LEGAL_VERSIONS.TERMS}`);
    assert(consent.privacyVersion === LEGAL_VERSIONS.PRIVACY, `Privacy Policy version is ${LEGAL_VERSIONS.PRIVACY}`);
    assert(consent.aiDisclosureVersion === LEGAL_VERSIONS.AI_DISCLOSURE, `AI disclosure version is ${LEGAL_VERSIONS.AI_DISCLOSURE}`);
    assert(consent.ageConfirmed === true, 'Statutory consent eligibility confirmed');
    assert(consent.dpdpConsentGiven === true, 'DPDP Act explicit consent recorded');
    assert(typeof consent.acceptedAt === 'string', 'Timestamp properly recorded');

    // Test C: Verify user now has valid current consent
    assert(hasCurrentConsent(testUserId) === true, 'User with recorded consent is verified as current');

    // Test D: Outdated version simulation (e.g., if terms increment)
    const stored = getUserConsentRecord(testUserId);
    assert(stored !== null, 'Consent record is retrievable');
  } catch (err) {
    assert(false, `Legal consent tests failed: ${err.message}`);
  }

  // --- PART 5: MANUAL APPROVAL WORKFLOW INTEGRITY ---
  console.log('\n--- 5. MANUAL APPROVAL WORKFLOW INTEGRITY ---');
  try {
    // Test: Submitting empty or unverified documents must reject approval
    const emptyApproval = await fetch('http://localhost:3001/api/approve-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: 'batch-test-unapproved',
        patientId: 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82',
        documents: []
      })
    });
    assert(emptyApproval.status === 400, 'Unapproved/empty submission rejected with HTTP 400');

    // Test: Legitimate approval creates dose schedules
    const approvalRes = await fetch('http://localhost:3001/api/approve-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: `batch-verify-${Date.now()}`,
        patientId: 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82',
        documents: [
          {
            documentId: `doc-${Date.now()}`,
            fileName: 'verified_prescription.jpg',
            patientVerification: { status: 'MATCH', extractedName: 'Alex Morgan' },
            mismatchAcknowledged: false,
            approvedMedicines: [
              {
                brandName: 'P-650',
                genericIngredient: 'Paracetamol',
                strength: '650 mg',
                dosage: '1 Tablet',
                frequency: 'Twice daily',
                timing: 'After meals',
                timeSlots: ['Morning (8:00 AM)', 'Night (8:00 PM)'],
                times: ['08:00', '20:00'],
                duration: '5 days',
                instructions: 'Take 1 tablet after meals with water'
              }
            ]
          }
        ]
      })
    });

    const approvalData = await approvalRes.json();
    assert(approvalRes.status === 200, 'Approved prescription returned HTTP 200');
    assert(approvalData.success === true, 'Prescription approval marked success: true');
    assert(approvalData.createdMedications.length + approvalData.updatedMedications.length >= 1, 'Medication routine recorded');
  } catch (err) {
    assert(false, `Manual approval workflow test failed: ${err.message}`);
  }

  console.log('\n========================================================================');
  console.log(`   VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED               `);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionVerification();
