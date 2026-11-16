import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('===============================================================');
  console.log('   MEDREMIND LEVEL 2 REAL PRESCRIPTION VERIFICATION TEST SUITE  ');
  console.log('===============================================================\n');

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

  // 1. Health Endpoint
  console.log('--- TEST 1: Backend API Health ---');
  try {
    const res = await fetch('http://localhost:3001/api/health');
    const data = await res.json();
    assert(data.status === 'ok', 'Server returned status: ok');
  } catch (e) {
    assert(false, `Health check failed: ${e.message}`);
  }

  // 2. Drug Safety Guidelines
  console.log('\n--- TEST 2: Clinical Drug Safety Guidelines ---');
  try {
    const res = await fetch('http://localhost:3001/api/lookup-medicine?name=Amoxicillin');
    const data = await res.json();
    assert(data.success === true && data.drug.class.includes('Antibiotic'), 'Correct clinical safety class for Amoxicillin');
  } catch (e) {
    assert(false, `Drug lookup failed: ${e.message}`);
  }

  // 3. Scan Real Prescription Image
  console.log('\n--- TEST 3: Real Prescription OCR & Clinical Evidence Extraction ---');
  let rxResult = null;
  try {
    const rxPath = path.join(__dirname, 'uploads', 'test_prescription.png');
    const rxBuffer = fs.readFileSync(rxPath);
    const rxBase64 = `data:image/png;base64,${rxBuffer.toString('base64')}`;

    console.log('Sending real prescription image to Tesseract OCR engine...');
    const scanRes = await fetch('http://localhost:3001/api/scan-medicine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: rxBase64, patientId: 'patient-test' })
    });
    rxResult = await scanRes.json();

    assert(rxResult.success === true, 'Scan request processed successfully');
    assert(rxResult.classification === 'MEDICATION_PRESCRIPTION', `Document classified as MEDICATION_PRESCRIPTION (Actual: ${rxResult.classification})`);
    assert(rxResult.format === 'TYPED' || rxResult.format === 'MIXED', `Format accurately detected as ${rxResult.format}`);
    assert(rxResult.qualityStatus === 'OPTIMAL' || rxResult.qualityStatus === 'ACCEPTABLE', `Image quality acceptable: ${rxResult.qualityStatus}`);
    assert(rxResult.evidence?.doctorName?.includes('Sterling'), `Doctor extracted: ${rxResult.evidence?.doctorName}`);
    assert(rxResult.evidence?.clinicName?.includes('Hospital'), `Clinic extracted: ${rxResult.evidence?.clinicName}`);
    assert(rxResult.medicines && rxResult.medicines.length >= 2, `Extracted genuine medicines: ${rxResult.medicines?.length} found`);
    
    const medNames = rxResult.medicines.map(m => m.interpretedName || m.rawRecognizedName);
    console.log('Extracted Medicine Names:', medNames);
    assert(medNames.some(n => /amox/i.test(n)), 'Extracted Amoxicillin correctly from image text');
    assert(medNames.some(n => /para/i.test(n)), 'Extracted Paracetamol correctly from image text');
    assert(rxResult.decision === 'CANDIDATE' || rxResult.decision === 'REVIEW', `Decision reached: ${rxResult.decision}`);
  } catch (e) {
    assert(false, `Prescription OCR scan failed: ${e.message}`);
  }

  // 4. Scan Diagnostic Lab Report (Rejection Test)
  console.log('\n--- TEST 4: Non-Prescription Rejection (Lab Report) ---');
  try {
    const labPath = path.join(__dirname, 'uploads', 'test_lab_report.png');
    const labBuffer = fs.readFileSync(labPath);
    const labBase64 = `data:image/png;base64,${labBuffer.toString('base64')}`;

    console.log('Sending lab report image to verification engine...');
    const scanRes = await fetch('http://localhost:3001/api/scan-medicine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: labBase64, patientId: 'patient-test' })
    });
    const labResult = await scanRes.json();

    assert(labResult.classification === 'LAB_REPORT', `Document correctly classified as LAB_REPORT (Actual: ${labResult.classification})`);
    assert(labResult.decision === 'REJECT', `Processing decision is REJECT for non-prescription`);
    console.log('Rejection Reason:', labResult.classificationReason);
  } catch (e) {
    assert(false, `Lab report test failed: ${e.message}`);
  }

  // 5. Explicit Patient Approval & Routine Scheduling
  console.log('\n--- TEST 5: Explicit Patient Approval & Dose Schedule Creation ---');
  try {
    if (!rxResult || !rxResult.prescriptionId) {
      throw new Error('No prescription ID available from Test 3');
    }

    const approveRes = await fetch('http://localhost:3001/api/approve-prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prescriptionId: rxResult.prescriptionId,
        patientId: 'patient-test',
        approvedMedicines: rxResult.medicines
      })
    });
    const approveData = await approveRes.json();

    assert(approveData.success === true, 'Prescription approval endpoint succeeded');
    assert(approveData.prescription?.status === 'APPROVED', 'Prescription status updated to APPROVED');
    assert(approveData.medications?.length >= 2, `Medications created: ${approveData.medications?.length}`);
    assert(approveData.schedules?.length >= 2, `Dose occurrences scheduled: ${approveData.schedules?.length}`);
    console.log('Created Dose Schedules:', approveData.schedules.map(s => `${s.time} - ${s.scheduledDose}`));
  } catch (e) {
    assert(false, `Prescription approval test failed: ${e.message}`);
  }

  // 6. Schedule Tick & Overdue Dose Alerts
  console.log('\n--- TEST 6: Real-time Schedule Tick & Notifications ---');
  try {
    const tickRes = await fetch('http://localhost:3001/api/tick', { method: 'POST' });
    const tickData = await tickRes.json();
    assert(tickData.success === true, 'Schedule tick completed successfully without exceptions');
  } catch (e) {
    assert(false, `Tick check failed: ${e.message}`);
  }

  console.log('\n===============================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED               `);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
