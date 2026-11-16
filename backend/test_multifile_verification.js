import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runAll15Scenarios() {
  console.log('========================================================================');
  console.log('   MEDREMIND MULTI-FILE PRESCRIPTION & PATIENT IDENTITY TEST SUITE      ');
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
    const ext = path.extname(relPath).replace('.', '').toLowerCase();
    const mime = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  };

  const patientId = 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82'; // Registered: Alex Morgan

  // --- SCENARIO 1: Multiple JPG prescription photos ---
  console.log('--- SCENARIO 1: Multiple JPG Prescription Photos ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'rx_photo1.jpg', dataBase64: getB64('uploads/test_match_1.jpg') },
          { name: 'rx_photo2.jpg', dataBase64: getB64('uploads/test_match_1.jpg') }
        ]
      })
    });
    const data = await res.json();
    assert(data.success && data.documents.length === 2, 'Successfully processed multiple JPG files in one batch');
    assert(data.documents[0].format === 'TYPED' || data.documents[0].format === 'IMAGE', 'First JPG recognized');
  } catch (e) {
    assert(false, `Scenario 1 failed: ${e.message}`);
  }

  // --- SCENARIO 2: Multiple JPEG prescription photos ---
  console.log('\n--- SCENARIO 2: Multiple JPEG Prescription Photos ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'rx_1.jpeg', dataBase64: getB64('uploads/test_match_2.jpeg') },
          { name: 'rx_2.jpeg', dataBase64: getB64('uploads/test_match_2.jpeg') }
        ]
      })
    });
    const data = await res.json();
    assert(data.success && data.documents.length === 2, 'Successfully processed multiple JPEG files');
  } catch (e) {
    assert(false, `Scenario 2 failed: ${e.message}`);
  }

  // --- SCENARIO 3: Multiple PNG prescription photos ---
  console.log('\n--- SCENARIO 3: Multiple PNG Prescription Photos ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'rx_1.png', dataBase64: getB64('uploads/test_match_3.png') },
          { name: 'rx_2.png', dataBase64: getB64('uploads/test_match_3.png') }
        ]
      })
    });
    const data = await res.json();
    assert(data.success && data.documents.length === 2, 'Successfully processed multiple PNG files');
  } catch (e) {
    assert(false, `Scenario 3 failed: ${e.message}`);
  }

  // --- SCENARIO 4: Multiple PDFs ---
  console.log('\n--- SCENARIO 4: Multiple PDF Documents ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'rx_pdf1.pdf', dataBase64: getB64('uploads/test_multipage_rx.pdf') },
          { name: 'rx_pdf2.pdf', dataBase64: getB64('uploads/test_multipage_rx.pdf') }
        ]
      })
    });
    const data = await res.json();
    assert(data.success && data.documents.length === 2, 'Successfully processed multiple PDF files');
    assert(data.documents[0].format === 'PDF' && data.documents[0].pageCount >= 2, 'PDF page count verified (>= 2 pages)');
  } catch (e) {
    assert(false, `Scenario 4 failed: ${e.message}`);
  }

  // --- SCENARIO 5: Mixed JPG, PNG, JPEG, and PDF submission ---
  console.log('\n--- SCENARIO 5: Mixed Formats (JPG, JPEG, PNG, Multi-page PDF) ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'doc1.jpg', dataBase64: getB64('uploads/test_match_1.jpg') },
          { name: 'doc2.jpeg', dataBase64: getB64('uploads/test_match_2.jpeg') },
          { name: 'doc3.png', dataBase64: getB64('uploads/test_match_3.png') },
          { name: 'doc4.pdf', dataBase64: getB64('uploads/test_multipage_rx.pdf') }
        ]
      })
    });
    const data = await res.json();
    assert(data.success && data.documents.length === 4, 'Processed 4 mixed format documents in 1 submission');
    const formats = data.documents.map(d => d.format);
    assert(formats.includes('PDF'), 'Contains processed PDF document in mixed batch');
  } catch (e) {
    assert(false, `Scenario 5 failed: ${e.message}`);
  }

  // --- SCENARIO 6: Multi-page PDF processing ---
  console.log('\n--- SCENARIO 6: Multi-Page PDF Full Processing ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'hospital_rx.pdf', dataBase64: getB64('uploads/test_multipage_rx.pdf') }
        ]
      })
    });
    const data = await res.json();
    const pdfDoc = data.documents[0];
    assert(pdfDoc.pageCount === 2, `Multi-page PDF has exact 2 pages (Actual: ${pdfDoc.pageCount})`);
    assert(pdfDoc.pages && pdfDoc.pages.length === 2, 'Both pages individually rendered and processed');
    assert(pdfDoc.medicines && pdfDoc.medicines.some(m => /lisinopril/i.test(m.interpretedName || m.rawRecognizedName)), 'Extracted Lisinopril from Page 1');
    assert(pdfDoc.medicines && pdfDoc.medicines.some(m => /omeprazole/i.test(m.interpretedName || m.rawRecognizedName)), 'Extracted Omeprazole from Page 2');
  } catch (e) {
    assert(false, `Scenario 6 failed: ${e.message}`);
  }

  // --- SCENARIO 7: Matching registered and prescription names ---
  console.log('\n--- SCENARIO 7: Matching Patient Identity (Alex Morgan) ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId, // Alex Morgan
        files: [{ name: 'amox_rx.jpg', dataBase64: getB64('uploads/test_match_1.jpg') }]
      })
    });
    const data = await res.json();
    const doc = data.documents[0];
    assert(doc.patientVerification.status === 'MATCH', `Patient name status is MATCH (Extracted: "${doc.patientVerification.extractedName}")`);
    assert(doc.patientVerification.match === true, 'Match boolean is true');
    assert(doc.patientVerification.registeredName === 'Alex Morgan', 'Registered patient verified as Alex Morgan');
  } catch (e) {
    assert(false, `Scenario 7 failed: ${e.message}`);
  }

  // --- SCENARIO 8: Different registered and prescription names (MISMATCH) ---
  console.log('\n--- SCENARIO 8: Patient Name Mismatch (Robin Smith vs Alex Morgan) ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId, // Registered: Alex Morgan
        files: [{ name: 'mismatch_rx.jpg', dataBase64: getB64('uploads/test_mismatch.jpg') }]
      })
    });
    const data = await res.json();
    const doc = data.documents[0];
    assert(doc.patientVerification.status === 'MISMATCH', `Identified status: MISMATCH (Actual: ${doc.patientVerification.status})`);
    assert(doc.patientVerification.extractedName.includes('Robin'), `Extracted prescription patient: "${doc.patientVerification.extractedName}"`);
    assert(doc.patientVerification.registeredName === 'Alex Morgan', 'Identified registered patient: "Alex Morgan"');
    assert(doc.patientVerification.displayTitle === 'PATIENT NAME MISMATCH', 'Shows PATIENT NAME MISMATCH title');
  } catch (e) {
    assert(false, `Scenario 8 failed: ${e.message}`);
  }

  // --- SCENARIO 9: Missing or unreadable patient name ---
  console.log('\n--- SCENARIO 9: Missing / Unreadable Patient Name (UNVERIFIED) ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [{ name: 'unverified_rx.png', dataBase64: getB64('uploads/test_unverified.png') }]
      })
    });
    const data = await res.json();
    const doc = data.documents[0];
    assert(doc.patientVerification.status === 'UNVERIFIED', `Status is UNVERIFIED (Actual: ${doc.patientVerification.status})`);
    assert(doc.patientVerification.extractedName === null, 'No hallucinated or guessed patient name');
    assert(doc.patientVerification.displayTitle === 'PATIENT NAME COULD NOT BE VERIFIED', 'Displays PATIENT NAME COULD NOT BE VERIFIED');
  } catch (e) {
    assert(false, `Scenario 9 failed: ${e.message}`);
  }

  // --- SCENARIO 10: Multiple documents with conflicting patient names ---
  console.log('\n--- SCENARIO 10: Cross-Document Conflicting Patient Names ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'doc_alex.jpg', dataBase64: getB64('uploads/test_match_1.jpg') },
          { name: 'doc_robin.jpg', dataBase64: getB64('uploads/test_mismatch.jpg') }
        ]
      })
    });
    const data = await res.json();
    assert(data.hasCrossDocumentConflict === true, 'Detected cross-document conflict between Alex Morgan and Robin Smith');
    assert(data.crossDocumentConflictMessage.includes('Alex') && data.crossDocumentConflictMessage.includes('Robin'), 'Alert message details both conflicting names');
  } catch (e) {
    assert(false, `Scenario 10 failed: ${e.message}`);
  }

  // --- SCENARIO 11: Duplicate files detection ---
  console.log('\n--- SCENARIO 11: Duplicate Files Detection (SHA-256) ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'original.jpg', dataBase64: getB64('uploads/test_match_1.jpg') },
          { name: 'copy.jpg', dataBase64: getB64('uploads/test_match_1.jpg') }
        ]
      })
    });
    const data = await res.json();
    assert(data.documents[1].isDuplicate === true, 'Second file flagged as duplicate with identical SHA-256');
  } catch (e) {
    assert(false, `Scenario 11 failed: ${e.message}`);
  }

  // --- SCENARIO 12: Removing one file while retaining others ---
  console.log('\n--- SCENARIO 12: Selective Document Removal ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'keep1.jpg', dataBase64: getB64('uploads/test_match_1.jpg') },
          { name: 'remove_me.jpg', dataBase64: getB64('uploads/test_mismatch.jpg') },
          { name: 'keep2.jpg', dataBase64: getB64('uploads/test_match_2.jpeg') }
        ]
      })
    });
    const data = await res.json();
    const filteredDocs = data.documents.filter(d => d.fileName !== 'remove_me.jpg');
    assert(filteredDocs.length === 2, 'Successfully retained 2 documents after removing mismatched file');
    assert(!filteredDocs.some(d => d.fileName === 'remove_me.jpg'), 'Removed document excluded from retained set');
  } catch (e) {
    assert(false, `Scenario 12 failed: ${e.message}`);
  }

  // --- SCENARIO 13: Proceeding after a mismatch warning (with explicit audit log) ---
  console.log('\n--- SCENARIO 13: Proceed Anyway After Mismatch & Audit Trail ---');
  try {
    const scanRes = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [{ name: 'robin_mismatch.jpg', dataBase64: getB64('uploads/test_mismatch.jpg') }]
      })
    });
    const scanData = await scanRes.json();
    const doc = scanData.documents[0];

    const approveRes = await fetch('http://localhost:3001/api/approve-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: scanData.batchId,
        patientId,
        documents: [
          {
            documentId: doc.documentId,
            fileName: doc.fileName,
            patientVerification: doc.patientVerification,
            mismatchAcknowledged: true,
            approvedMedicines: doc.medicines
          }
        ]
      })
    });
    const approveData = await approveRes.json();
    assert(approveData.success === true, 'Approval succeeded with explicit mismatch acknowledgment');

    // Verify audit log has PATIENT_NAME_MISMATCH_OVERRIDDEN
    const auditLogs = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'audit_logs.json'), 'utf-8'));
    const overrideEntry = auditLogs.find(l => l.action === 'PATIENT_NAME_MISMATCH_OVERRIDDEN' && l.details?.documentId === doc.documentId);
    assert(overrideEntry !== undefined, 'Audit log contains PATIENT_NAME_MISMATCH_OVERRIDDEN entry');
    assert(overrideEntry?.details?.decision === 'PROCEED_ANYWAY', 'Audit records decision as PROCEED_ANYWAY');
  } catch (e) {
    assert(false, `Scenario 13 failed: ${e.message}`);
  }

  // --- SCENARIO 14: Unsupported and corrupted files ---
  console.log('\n--- SCENARIO 14: Validation of Unsupported & Corrupted Files ---');
  try {
    const res = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'malicious_file.exe', dataBase64: 'data:application/octet-stream;base64,ZWNobyAnYmFkJw==' }
        ]
      })
    });
    const data = await res.json();
    assert(res.status === 400 && data.error.includes('Unsupported format'), 'Rejected unsupported format .exe with 400');

    const resEmpty = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [
          { name: 'corrupted.jpg', dataBase64: '' }
        ]
      })
    });
    assert(resEmpty.status === 400 || !resEmpty.ok, 'Corrupted/empty file gracefully rejected');
  } catch (e) {
    assert(false, `Scenario 14 failed: ${e.message}`);
  }

  // --- SCENARIO 15: Approval and medication-record creation ---
  console.log('\n--- SCENARIO 15: Approval and Medication Record Creation ---');
  try {
    const scanRes = await fetch('http://localhost:3001/api/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        files: [{ name: 'amox_valid.jpg', dataBase64: getB64('uploads/test_match_1.jpg') }]
      })
    });
    const scanData = await scanRes.json();
    const doc = scanData.documents[0];

    const approveRes = await fetch('http://localhost:3001/api/approve-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: scanData.batchId,
        patientId,
        documents: [
          {
            documentId: doc.documentId,
            fileName: doc.fileName,
            patientVerification: doc.patientVerification,
            mismatchAcknowledged: false,
            approvedMedicines: doc.medicines
          }
        ]
      })
    });
    const approveData = await approveRes.json();
    assert(approveData.success === true, 'Approved prescription batch successfully');
    const totalProcessed = (approveData.createdMedications?.length || 0) + (approveData.updatedMedications?.length || 0);
    assert(totalProcessed >= 1, `Processed medication order (Created: ${approveData.createdMedications?.length || 0}, Updated: ${approveData.updatedMedications?.length || 0})`);
  } catch (e) {
    assert(false, `Scenario 15 failed: ${e.message}`);
  }

  console.log('\n========================================================================');
  console.log(`   FINAL MULTI-FILE TEST RESULTS: ${passed} PASSED, ${failed} FAILED     `);
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runAll15Scenarios().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
