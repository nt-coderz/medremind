/**
 * MedRemind Comprehensive Test Suite:
 * - Account Security & Email Uniqueness
 * - Arithmetic CAPTCHA Elimination
 * - 24-Hour Grace Period Account Deletion
 * - Arbitrary Time Schedules & Audio Alarm Resources
 * - Active / Inactive Medication Routine Toggle
 * - Future Dose Recording Safeguards
 * - Prescription Patient Name Verification & Medical Disclaimer
 * - Offline Tesseract OCR Preprocessing & Drug Knowledge Base
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, hashPassword, verifyPassword } from './database/db.js';
import { 
  DRUG_CATALOG, 
  parseDosageNotation, 
  resolveBrandAndGeneric, 
  isNonPrescriptionDocument 
} from './drugKnowledgeBase.js';
import { parseArbitraryTime } from '../src/services/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('================================================================');
  console.log('MedRemind Comprehensive Test Suite: Security, Reminders & OCR');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // SECTION 1: Arithmetic CAPTCHA Removal Verification
  // -------------------------------------------------------------
  console.log('1. Arithmetic CAPTCHA Elimination:');

  test('RegisterPage.jsx contains NO arithmetic CAPTCHA or fake challenges', () => {
    const regSource = fs.readFileSync(path.join(__dirname, '../src/pages/auth/RegisterPage.jsx'), 'utf-8');
    assert(!regSource.includes('generateAntiBotChallenge'), 'generateAntiBotChallenge must be removed');
    assert(!regSource.includes('isCaptchaVerified'), 'isCaptchaVerified state must be removed');
    assert(!regSource.includes('Anti-Bot Security Challenge'), 'Anti-bot UI challenge card must be removed');
    assert(!regSource.includes('Enter sum'), 'Arithmetic sum input must be removed');
  });

  // -------------------------------------------------------------
  // SECTION 2: Email Normalization & Uniqueness
  // -------------------------------------------------------------
  console.log('\n2. Email Normalization & One Email = One Account:');

  await testAsync('Case-insensitive duplicate user registration is strictly blocked', async () => {
    const testEmail = `test.unique.${Date.now()}@example.com`;
    const user1 = await db.createUser({
      name: 'Test Patient',
      email: testEmail.toUpperCase(),
      password: 'password123',
      role: 'patient'
    });
    assert(user1.id, 'User 1 should be created');

    // Attempt to create user with lowercase variant
    try {
      await db.createUser({
        name: 'Duplicate Patient',
        email: testEmail.toLowerCase(),
        password: 'password123',
        role: 'patient'
      });
      assert.fail('Should throw error for duplicate email');
    } catch (err) {
      assert(err.message.includes('already exists'), 'Expected duplicate email error');
    }
  });

  // -------------------------------------------------------------
  // SECTION 3: 24-Hour Grace Period Account Deletion
  // -------------------------------------------------------------
  console.log('\n3. 24-Hour Grace Period Account Deletion:');

  let testUserId = null;
  await testAsync('Schedule user deletion sets Pending_Deletion status and 24h timestamp', async () => {
    const tempUser = await db.createUser({
      name: 'Deletion Candidate',
      email: `deletion.${Date.now()}@example.com`,
      password: 'password123',
      role: 'patient'
    });
    testUserId = tempUser.id;

    const scheduled = await db.scheduleUserDeletion(testUserId, testUserId, 'Patient self-deletion request');
    assert.strictEqual(scheduled.status, 'Pending_Deletion');
    assert(scheduled.scheduledDeletionAt, 'scheduledDeletionAt must be populated');

    const scheduledDate = new Date(scheduled.scheduledDeletionAt);
    const diffHours = (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60);
    assert(diffHours >= 23 && diffHours <= 25, `Expected ~24h grace window, got ${diffHours.toFixed(1)}h`);
  });

  await testAsync('Cancel user deletion restores Active status and clears deletion fields', async () => {
    const restored = await db.cancelUserDeletion(testUserId, testUserId);
    assert.strictEqual(restored.status, 'Active');
    assert(!restored.scheduledDeletionAt, 'scheduledDeletionAt must be cleared');
  });

  await testAsync('Background deletion worker permanently deletes accounts after 24h expiration', async () => {
    // Schedule an already-expired deletion (timestamp in the past)
    const expiredUser = await db.createUser({
      name: 'Expired Grace User',
      email: `expired.${Date.now()}@example.com`,
      password: 'password123',
      role: 'patient'
    });

    const pastTimestamp = new Date(Date.now() - 1000).toISOString();
    await db.scheduleUserDeletion(expiredUser.id, 'system', 'Test immediate execution', pastTimestamp);

    const deletedIds = await db.executeScheduledDeletions();
    assert(deletedIds.includes(expiredUser.id), 'Expired user must be permanently deleted');

    const lookup = await db.findUserById(expiredUser.id);
    assert.strictEqual(lookup, null, 'Deleted user must no longer exist in database');
  });

  // -------------------------------------------------------------
  // SECTION 4: Audio Alarm Resources & Arbitrary Time Parsing
  // -------------------------------------------------------------
  console.log('\n4. Audio Alarm & Arbitrary Medication Timings:');

  test('Valid PCM WAV alarm chime exists in Android raw resource directory', () => {
    const androidWavPath = path.join(__dirname, '../android/app/src/main/res/raw/alarm_chime.wav');
    assert(fs.existsSync(androidWavPath), 'alarm_chime.wav must exist in android/app/src/main/res/raw');
    const stats = fs.statSync(androidWavPath);
    assert(stats.size > 10000, `Audio file must be substantial (>10KB), found ${stats.size} bytes`);

    // Verify RIFF header
    const buffer = fs.readFileSync(androidWavPath);
    assert.strictEqual(buffer.toString('ascii', 0, 4), 'RIFF');
    assert.strictEqual(buffer.toString('ascii', 8, 12), 'WAVE');
  });

  test('Arbitrary custom time parser handles non-standard minutes accurately', () => {
    const t1 = parseArbitraryTime('07:05 AM');
    assert.strictEqual(t1.hours, 7);
    assert.strictEqual(t1.minutes, 5);

    const t2 = parseArbitraryTime('1:35 PM');
    assert.strictEqual(t2.hours, 13);
    assert.strictEqual(t2.minutes, 35);

    const t3 = parseArbitraryTime('11:45 PM');
    assert.strictEqual(t3.hours, 23);
    assert.strictEqual(t3.minutes, 45);

    const t4 = parseArbitraryTime('14:20');
    assert.strictEqual(t4.hours, 14);
    assert.strictEqual(t4.minutes, 20);

    const t5 = parseArbitraryTime('Morning (8:00 AM)');
    assert.strictEqual(t5.hours, 8);
    assert.strictEqual(t5.minutes, 0);
  });

  // -------------------------------------------------------------
  // SECTION 5: Future Dose Recording Protection
  // -------------------------------------------------------------
  console.log('\n5. Future Dose Recording Safeguards:');

  await testAsync('Reject dose logging for future date', async () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    try {
      await db.recordDoseLog({
        patientId: 'USR-test',
        medicationId: 'med-test',
        timeSlot: 'Morning (8:00 AM)',
        status: 'taken',
        dateKey: futureDate
      });
      assert.fail('Should reject future date log');
    } catch (err) {
      assert(err.message.includes('future date'), 'Expected future date error message');
    }
  });

  await testAsync('Reject dose logging before scheduled time today', async () => {
    // Pick an hour far in the future today (e.g. 23:59)
    const futureSlot = '11:59 PM';
    try {
      await db.recordDoseLog({
        patientId: 'USR-test',
        medicationId: 'med-test',
        timeSlot: futureSlot,
        scheduledTime: '23:59',
        status: 'taken'
      });
      assert.fail('Should reject future scheduled time today');
    } catch (err) {
      assert(err.message.includes('before its scheduled time'), 'Expected premature dose error message');
    }
  });

  // -------------------------------------------------------------
  // SECTION 6: Offline OCR Knowledge Base & Shorthand Parsing
  // -------------------------------------------------------------
  console.log('\n6. Offline OCR Entity Extraction & Medical Shorthand:');

  test('Expanded drug catalog contains wide coverage of key classes', () => {
    const catalogKeys = Object.keys(DRUG_CATALOG);
    assert(catalogKeys.length >= 40, `Expected at least 40 medications in catalog, got ${catalogKeys.length}`);

    // Verify key medicines
    assert(DRUG_CATALOG['dolo 650'], 'Dolo 650 must be present');
    assert(DRUG_CATALOG['augmentin'], 'Augmentin must be present');
    assert(DRUG_CATALOG['amoxicillin'], 'Amoxicillin must be present');
    assert(DRUG_CATALOG['telmisartan'], 'Telmisartan must be present');
    assert(DRUG_CATALOG['metformin'], 'Metformin must be present');
    assert(DRUG_CATALOG['pantoprazole'], 'Pantoprazole must be present');
    assert(DRUG_CATALOG['levothyroxine'], 'Levothyroxine must be present');
  });

  test('Dosage parser accurately decodes 1-0-1, 1-1-1, and 0-0-1 numeric shorthand', () => {
    const bid = parseDosageNotation('1-0-1 after meals');
    assert.strictEqual(bid.frequency, 'Twice daily');
    assert.strictEqual(bid.morningDose, 1);
    assert.strictEqual(bid.afternoonDose, 0);
    assert.strictEqual(bid.nightDose, 1);
    assert(bid.instructions.includes('after meals'));

    const tid = parseDosageNotation('1-1-1');
    assert.strictEqual(tid.frequency, 'Three times daily');
    assert.strictEqual(tid.morningDose, 1);
    assert.strictEqual(tid.afternoonDose, 1);
    assert.strictEqual(tid.nightDose, 1);

    const night = parseDosageNotation('0-0-1 at bedtime');
    assert.strictEqual(night.frequency, 'Once daily');
    assert.strictEqual(night.morningDose, 0);
    assert.strictEqual(night.nightDose, 1);
  });

  test('Dosage parser accurately decodes Latin medical notations (OD, BD, TDS, QDS, HS, SOS, BBF)', () => {
    const tds = parseDosageNotation('TDS before food');
    assert.strictEqual(tds.frequency, 'Three times daily');
    assert(tds.instructions.includes('before meals') || tds.instructions.includes('empty stomach'));

    const bd = parseDosageNotation('BD with food');
    assert.strictEqual(bd.frequency, 'Twice daily');

    const hs = parseDosageNotation('HS bedtime');
    assert.strictEqual(hs.frequency, 'Once daily (Night)');
    assert.strictEqual(hs.nightDose, 1);

    const sos = parseDosageNotation('Tab Paracetamol SOS');
    assert.strictEqual(sos.frequency, 'As needed (SOS)');
  });

  test('Non-prescription documents (invoices, utility bills) are successfully detected', () => {
    const invoiceText = 'Tax Invoice No: 2026/0491 Date: 12/03/2026 Bill To: John Doe GSTIN: 27AAAAA0000A1Z5 Total Due: 4500.00';
    assert(isNonPrescriptionDocument(invoiceText), 'Invoice should be flagged as non-prescription');

    const electricBill = 'Electricity Bill for Month: March 2026 Account Statement Units Consumed: 340 Amount: 2450';
    assert(isNonPrescriptionDocument(electricBill), 'Electricity bill should be flagged as non-prescription');

    const genuineRx = 'Rx Dr. Sharma Clinic Patient: Alex Morgan Tab Dolo 650 1-0-1 for 3 days';
    assert(!isNonPrescriptionDocument(genuineRx), 'Doctor prescription should NOT be flagged as non-prescription');
  });

  // -------------------------------------------------------------
  // SECTION 7: Prescription Review Patient Name Verification & Disclaimer
  // -------------------------------------------------------------
  console.log('\n7. Prescription Review UI Verification & Disclaimer:');

  test('ScannerPage.jsx includes editable patient name field and professional disclaimer', () => {
    const scannerSource = fs.readFileSync(path.join(__dirname, '../src/pages/patient/ScannerPage.jsx'), 'utf-8');
    assert(scannerSource.includes('Confirm or Edit Prescription Patient Name'), 'Must feature editable patient name input');
    assert(scannerSource.includes('Mandatory Professional Medical Disclaimer'), 'Must feature mandatory medical disclaimer');
    assert(scannerSource.includes('does not provide medical advice'), 'Disclaimer must state tool does not provide medical advice');
  });

  console.log('\n================================================================');
  console.log(`Results: ${passed} of ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
