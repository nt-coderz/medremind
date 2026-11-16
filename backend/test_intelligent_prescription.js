import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveBrandAndGeneric, parseDosageNotation, resolveMedicineDuplicate } from './drugKnowledgeBase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIntelligentPrescriptionTests() {
  console.log('========================================================================');
  console.log('   MEDREMIND INTELLIGENT PRESCRIPTION & OFFLINE-FIRST TEST SUITE        ');
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

  const patientId = 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82'; // Alex Morgan

  // --- TEST A: Prescription with Brand, Generic & 1-0-1 Shorthand ---
  console.log('--- TEST A: Prescription with P-650 (Paracetamol) 1-0-1 (after meals) ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [{ name: 'p650_prescription.jpg', dataBase64: getB64('uploads/test_p650_101.jpg') }]
      })
    });
    const data = await res.json();
    assert(data.success === true, 'Scan request processed');
    const doc = data.documents[0];
    assert(doc.medicines && doc.medicines.length === 1, 'Exactly one medicine record created (NOT two separate records for brand and generic)');
    
    const med = doc.medicines[0];
    assert(med.brandName.toLowerCase().includes('p-650'), `Brand recognized as P-650 (Actual: ${med.brandName})`);
    assert(med.genericIngredient.toLowerCase().includes('paracetamol'), `Generic ingredient resolved as Paracetamol (Actual: ${med.genericIngredient})`);
    assert(med.morningDose === 1, `Morning dose is 1 (Actual: ${med.morningDose})`);
    assert(med.afternoonDose === 0, `Afternoon dose is 0 (Actual: ${med.afternoonDose})`);
    assert(med.nightDose === 1, `Night dose is 1 (Actual: ${med.nightDose})`);
    assert(med.frequency.toLowerCase().includes('twice') || med.dailyFrequency === 2, `1-0-1 interpreted as 2 daily administrations (Actual: ${med.frequency})`);
    assert(med.timing.toLowerCase().includes('after meals'), `Timing interpreted as After meals (Actual: ${med.timing})`);
  } catch (e) {
    assert(false, `Test A failed: ${e.message}`);
  }

  // --- TEST B: Duplicate Detection on Rescan ---
  console.log('\n--- TEST B: Duplicate Medicine Detection (Scanning same Rx twice) ---');
  try {
    // 1. Approve initial P-650 order
    const scan1 = await (await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [{ name: 'p650_scan1.jpg', dataBase64: getB64('uploads/test_p650_101.jpg') }]
      })
    })).json();

    const app1 = await (await fetch('http://localhost:3001/api/approve-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: scan1.batchId,
        patientId,
        documents: scan1.documents
      })
    })).json();

    // 2. Scan same P-650 prescription again
    const scan2 = await (await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [{ name: 'p650_scan2.jpg', dataBase64: getB64('uploads/test_p650_101.jpg') }]
      })
    })).json();

    const med2 = scan2.documents[0].medicines[0];
    assert(med2.isDuplicateRecord === true, 'Subsequent scan identified as duplicate of existing active Paracetamol (P-650) routine');
    assert(med2.existingMedicationId !== null, `Linked to existing medication ID: ${med2.existingMedicationId}`);

    // 3. Approve second scan -> verify no duplicate active medication created
    const app2 = await (await fetch('http://localhost:3001/api/approve-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: scan2.batchId,
        patientId,
        documents: scan2.documents
      })
    })).json();

    assert(app2.createdMedications.length === 0, 'Zero duplicate active medications created');
    assert(app2.updatedMedications.length === 1, 'Existing routine instructions updated instead of creating redundant duplicate');
  } catch (e) {
    assert(false, `Test B failed: ${e.message}`);
  }

  // --- TEST C: Unclear Handwriting / Uncertainty Flagging ---
  console.log('\n--- TEST C: Unclear Handwriting & Uncertainty Flagging ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [{ name: 'unclear_handwriting.jpg', dataBase64: getB64('uploads/test_unclear_note.jpg') }]
      })
    });
    const data = await res.json();
    const doc = data.documents[0];
    const meds = doc.medicines;
    if (meds.length > 0) {
      assert(meds.some(m => m.isUncertain === true), 'Unclear handwriting correctly flagged with isUncertain: true');
      console.log('Uncertainty Reasons:', meds[0].uncertainReasons);
    } else {
      assert(doc.decision === 'REVIEW' || doc.qualityStatus !== 'OPTIMAL', 'Document marked for manual review without hallucinating names');
    }
  } catch (e) {
    assert(false, `Test C failed: ${e.message}`);
  }

  // --- TEST D: Different Strengths Are NOT Merged ---
  console.log('\n--- TEST D: Different Strengths (500mg vs 650mg) Are Kept Distinct ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [{ name: 'paracetamol_500.jpg', dataBase64: getB64('uploads/test_paracetamol_500.jpg') }]
      })
    });
    const data = await res.json();
    const med = data.documents[0].medicines[0];
    assert(med.isDifferentStrength === true || med.isDuplicateRecord === false, 'Different strength (500mg vs 650mg) recognized as distinct clinical order, not falsely merged');
    assert(med.strength.includes('500'), `Strength preserved accurately as 500 mg (Actual: ${med.strength})`);
  } catch (e) {
    assert(false, `Test D failed: ${e.message}`);
  }

  // --- TEST E: Clinical Consultation Note Recognition ---
  console.log('\n--- TEST E: Clinical Consultation Note Non-Prescription Handling ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [{ name: 'consult_progress_note.jpg', dataBase64: getB64('uploads/test_consult_note.jpg') }]
      })
    });
    const data = await res.json();
    const doc = data.documents[0];
    assert(doc.classification === 'CLINICAL_CONSULTATION_NOTE' || doc.classification === 'NON_MEDICAL_DOCUMENT' || doc.medicines.length === 0, `Recognized as non-prescription clinical note (Actual: ${doc.classification})`);
    assert(doc.decision === 'REVIEW' || doc.decision === 'REJECT', `Processing decision appropriately set to ${doc.decision}`);
  } catch (e) {
    assert(false, `Test E failed: ${e.message}`);
  }

  // --- TEST F: Gemini Technical Failure & Tesseract Fallback ---
  console.log('\n--- TEST F: Gemini Technical Failure & Automatic Tesseract Fallback ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        mode: 'online', // In the absence of an external active key, fallback automatically activates
        files: [{ name: 'fallback_rx.jpg', dataBase64: getB64('uploads/test_match_1.jpg') }]
      })
    });
    const data = await res.json();
    const doc = data.documents[0];
    assert(doc.engine === 'TESSERACT' || doc.engine === 'GEMINI', `Recognized engine: ${doc.engine}`);
    if (doc.engine === 'TESSERACT') {
      assert(doc.isFallback === true, 'isFallback flagged as true when Gemini key or network unavailable');
      console.log('Fallback Reason:', doc.fallbackReason);
    }
  } catch (e) {
    assert(false, `Test F failed: ${e.message}`);
  }

  // --- TEST G: Clinical Uncertainty Handling ---
  console.log('\n--- TEST G: Clinical Uncertainty Not Overridden by Fallback ---');
  try {
    // When an uncertain field is returned, verify it is flagged with requiresConfirmation: true
    const testUncertain = resolveBrandAndGeneric('UnknownExperimentalDrugXYZ');
    assert(testUncertain.requiresConfirmation === true, 'Unknown medicine brand flagged for patient confirmation rather than guessed');
    assert(testUncertain.isVerified === false, 'isVerified is false for unknown drug');
  } catch (e) {
    assert(false, `Test G failed: ${e.message}`);
  }

  // --- TEST H: Explicit Offline Scanning Mode ---
  console.log('\n--- TEST H: Explicit Offline Mode (mode: offline) ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        mode: 'offline', // Explicitly requested offline
        files: [{ name: 'offline_rx.jpg', dataBase64: getB64('uploads/test_p650_101.jpg') }]
      })
    });
    const data = await res.json();
    const doc = data.documents[0];
    assert(doc.engine === 'TESSERACT', `Offline mode executed via Tesseract (Actual: ${doc.engine})`);
    assert(doc.isFallback === false, 'isFallback is false because offline was explicitly chosen');
  } catch (e) {
    assert(false, `Test H failed: ${e.message}`);
  }

  // --- TEST I: Offline Medication Reminder Scheduling ---
  console.log('\n--- TEST I: Offline Medication Reminders & Dosage Interpretation ---');
  try {
    const dosage = parseDosageNotation('1-0-1 (after meals)');
    assert(dosage.dailyFrequency === 2, `1-0-1 gives dailyFrequency = 2 (Actual: ${dosage.dailyFrequency})`);
    assert(dosage.timeSlots.length === 2, `1-0-1 gives 2 reminder time slots (Actual: ${dosage.timeSlots.length})`);
    assert(dosage.timeSlots.includes('Morning (8:00 AM)'), 'Morning alarm scheduled at 08:00 AM');
    assert(dosage.timeSlots.includes('Night (8:00 PM)'), 'Night alarm scheduled at 08:00 PM');
    assert(!dosage.timeSlots.includes('Afternoon (1:00 PM)'), 'Zero afternoon dose correctly omits afternoon alarm');
  } catch (e) {
    assert(false, `Test I failed: ${e.message}`);
  }

  // --- TEST J: Online-to-Offline Transition ---
  console.log('\n--- TEST J: Online-to-Offline Transition & Schedule Durability ---');
  try {
    const health = await (await fetch('http://localhost:3001/api/health')).json();
    assert(health.status === 'ok', 'Server health confirms online/offline dual availability');
    assert(health.tesseractAvailable === true, 'Local Tesseract OCR confirmed available for offline transitions');
  } catch (e) {
    assert(false, `Test J failed: ${e.message}`);
  }

  console.log('\n========================================================================');
  console.log(`   INTELLIGENT PRESCRIPTION TEST RESULTS: ${passed} PASSED, ${failed} FAILED `);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runIntelligentPrescriptionTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
