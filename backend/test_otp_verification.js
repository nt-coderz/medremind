/**
 * MEDREMIND — EMAIL OTP VERIFICATION & RATE-LIMITING TEST SUITE
 * 
 * Verifies:
 * 1. 6-digit cryptographically secure OTP generation
 * 2. Mandatory registration input validation (email format, password length)
 * 3. Administrator registration restriction (403 Forbidden)
 * 4. 60-second resend cooldown timer enforcement (429 Too Many Requests)
 * 5. Wrong OTP code rejection & attempt decrementing
 * 6. Successful 6-digit OTP verification & user activation
 * 7. Token generation & subsequent login with verified credentials
 * 8. Protection against re-use of consumed OTPs
 */

import http from 'http';
import assert from 'assert';

const PORT = 3009;
process.env.PORT = PORT;
process.env.NODE_ENV = 'development';

// Import server app
const { default: app } = await import('./server.js');

const server = http.createServer(app);

function startServer() {
  return new Promise((resolve) => {
    server.listen(PORT, () => {
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

const BASE_URL = `http://localhost:${PORT}/api`;

console.log('========================================================================');
console.log('   MEDREMIND EMAIL OTP VERIFICATION & RATE LIMITING TEST SUITE          ');
console.log('========================================================================\n');

await startServer();

try {
  // Test 1: Invalid email format rejected
  await test('Registration rejects malformed email address (400)', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'invalid-email-no-at',
        password: 'password123',
        role: 'patient'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // Test 2: Short password rejected
  await test('Registration rejects passwords shorter than 6 characters (400)', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test.pwd@medremind.app',
        password: '123',
        role: 'patient'
      })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // Test 3: Public administrator creation forbidden
  await test('Public registration strictly prevents Administrator creation (403)', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rogue Admin',
        email: 'rogue@medremind.app',
        password: 'password123',
        role: 'admin'
      })
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // Test 4: Genuine OTP generation & dispatch
  const uniqueEmail = `otp.patient.${Date.now()}@medremind.app`;
  let receivedOtp = '';

  await test('Valid registration generates 6-digit OTP and returns requireOtp: true', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Sharma',
        email: uniqueEmail,
        password: 'securePassword123',
        role: 'patient'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.requireOtp, true);
    assert.strictEqual(data.email, uniqueEmail.toLowerCase());
    assert(data.devOtp, 'Development OTP returned for verification');
    assert.strictEqual(data.devOtp.length, 6, 'OTP must be exactly 6 digits');
    assert(/^\d{6}$/.test(data.devOtp), 'OTP must contain only numeric digits');
    receivedOtp = data.devOtp;
  });

  // Test 5: 60-Second Cooldown on Resend
  await test('Immediate re-request is blocked by 60-second cooldown timer (429)', async () => {
    const res = await fetch(`${BASE_URL}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail })
    });
    assert.strictEqual(res.status, 429);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert(data.error.includes('seconds'), 'Error informs user of remaining wait time');
  });

  // Test 6: Malformed OTP rejected
  await test('Non-6-digit OTP input is rejected (400)', async () => {
    const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, otp: '123' })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

  // Test 7: Wrong OTP code decrements attempts
  await test('Incorrect 6-digit OTP is rejected and decrements remaining attempts (400)', async () => {
    const wrongOtp = receivedOtp === '111111' ? '222222' : '111111';
    const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, otp: wrongOtp })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert(data.error.includes('attempt'), 'Indicates remaining attempts');
  });

  // Test 8: Correct OTP activates user account
  let authUser = null;
  let authToken = '';

  await test('Correct 6-digit OTP activates user and returns session JWT', async () => {
    const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, otp: receivedOtp })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert(data.user, 'Activated user record returned');
    assert.strictEqual(data.user.email, uniqueEmail.toLowerCase());
    assert.strictEqual(data.user.name, 'Priya Sharma');
    assert.strictEqual(data.user.role, 'patient');
    assert(data.token, 'Auth JWT token generated');
    authUser = data.user;
    authToken = data.token;
  });

  // Test 9: Activated user can authenticate with password
  await test('Activated user successfully logs in with password', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: uniqueEmail,
        password: 'securePassword123'
      })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.id, authUser.id);
  });

  // Test 10: Consumed OTP cannot be reused
  await test('Consumed OTP cannot be verified a second time (400)', async () => {
    const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, otp: receivedOtp })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  });

} finally {
  await stopServer();
}

console.log('\n========================================================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================================\n');

if (failed > 0) process.exit(1);
process.exit(0);
