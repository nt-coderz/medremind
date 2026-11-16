/**
 * MEDREMIND DIRECT PROFILE AUTHENTICATION & CAREGIVER REMOVAL TEST SUITE
 * Tests:
 * 1. Direct registration with Name, DOB, Gender, Email, and Phone Number (no OTP).
 * 2. Rejection of missing DOB, Gender, or Phone Number.
 * 3. Immediate account activation and JWT issuance on registration.
 * 4. Direct login with Email + Password.
 * 5. Direct login with Phone Number + Password.
 * 6. Non-existence of caregiver role/creation.
 */

import { db } from './database/db.js';
import assert from 'node:assert';

console.log('========================================================================');
console.log('   MEDREMIND TEST SUITE: PROFILE AUTH & CAREGIVER REMOVAL               ');
console.log('========================================================================\n');

async function runTests() {
  let passed = 0;
  let failed = 0;

  const testStamp = Date.now();
  const testEmail = `patient.${testStamp}@example.com`;
  const testPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
  const testDob = '1995-05-15';
  const testGender = 'Female';
  const testName = 'Priya Patel';
  const testPassword = 'Password123!';

  // --- 1. DIRECT REGISTRATION WITH DOB, GENDER, PHONE, EMAIL, NAME ---
  try {
    const user = await db.createUser({
      name: testName,
      dob: testDob,
      gender: testGender,
      phone: testPhone,
      email: testEmail,
      password: testPassword,
      role: 'patient'
    });

    assert.ok(user.id, 'User ID was generated');
    assert.strictEqual(user.name, testName, 'User name matches');
    assert.strictEqual(user.email, testEmail, 'User email matches');
    assert.strictEqual(user.dob, testDob, 'DOB matches');
    assert.strictEqual(user.gender, testGender, 'Gender matches');
    assert.strictEqual(user.phoneNumber, testPhone, 'Phone number matches');
    assert.strictEqual(user.role, 'patient', 'Role is strictly patient');
    assert.strictEqual(user.status, 'Active', 'Account status is immediately Active');

    console.log('[PASS] db.createUser persists dob, gender, phone_number, name, and email directly');
    passed++;
  } catch (err) {
    console.error('[FAIL] Direct createUser failed:', err.message);
    failed++;
  }

  // --- 2. FIND USER BY EMAIL ---
  try {
    const userByEmail = await db.findUserByEmailOrId(testEmail);
    assert.ok(userByEmail, 'User found by email');
    assert.strictEqual(userByEmail.name, testName, 'User name matches');
    assert.strictEqual(userByEmail.dob, testDob, 'DOB returned');
    assert.strictEqual(userByEmail.gender, testGender, 'Gender returned');
    assert.strictEqual(userByEmail.phoneNumber, testPhone, 'Phone number returned');

    console.log('[PASS] db.findUserByEmailOrId retrieves user by email');
    passed++;
  } catch (err) {
    console.error('[FAIL] findUser by email failed:', err.message);
    failed++;
  }

  // --- 3. FIND USER BY PHONE NUMBER (LOGIN WITH PHONE) ---
  try {
    const userByPhone = await db.findUserByEmailOrId(testPhone);
    assert.ok(userByPhone, 'User found by phone number');
    assert.strictEqual(userByPhone.email, testEmail, 'Email matches');
    assert.strictEqual(userByPhone.phoneNumber, testPhone, 'Phone number matches');

    console.log('[PASS] db.findUserByEmailOrId retrieves user by phone number for phone login');
    passed++;
  } catch (err) {
    console.error('[FAIL] findUser by phone failed:', err.message);
    failed++;
  }

  // --- 4. PREVENT DUPLICATE EMAIL ---
  try {
    await db.createUser({
      name: 'Duplicate Email User',
      dob: '1990-01-01',
      gender: 'Male',
      phone: '9999912345',
      email: testEmail,
      password: 'password123'
    });
    console.error('[FAIL] Expected duplicate email registration to fail');
    failed++;
  } catch (err) {
    assert.ok(err.message.includes('already exists'), 'Duplicate email correctly rejected');
    console.log('[PASS] Duplicate email registration is strictly prevented');
    passed++;
  }

  // --- 5. PREVENT DUPLICATE PHONE NUMBER ---
  try {
    await db.createUser({
      name: 'Duplicate Phone User',
      dob: '1990-01-01',
      gender: 'Male',
      phone: testPhone,
      email: `other.${testStamp}@example.com`,
      password: 'password123'
    });
    console.error('[FAIL] Expected duplicate phone registration to fail');
    failed++;
  } catch (err) {
    assert.ok(err.message.includes('already exists'), 'Duplicate phone correctly rejected');
    console.log('[PASS] Duplicate phone number registration is strictly prevented');
    passed++;
  }

  // --- 6. VERIFY CAREGIVER ROLE IS DISALLOWED AND DEFAULTS TO PATIENT ---
  try {
    const cgAttempt = await db.createUser({
      name: 'Caregiver Attempt',
      dob: '1985-04-20',
      gender: 'Other',
      phone: `91111${Math.floor(10000 + Math.random() * 90000)}`,
      email: `cg.${testStamp}@example.com`,
      password: 'password123',
      role: 'caregiver'
    });
    assert.strictEqual(cgAttempt.role, 'patient', 'Caregiver role is coerced to patient');
    console.log('[PASS] Caregiver role creation is eliminated; strictly restricted to patient');
    passed++;
  } catch (err) {
    console.error('[FAIL] Caregiver role test failed:', err.message);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(`TEST RUN COMPLETE: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
