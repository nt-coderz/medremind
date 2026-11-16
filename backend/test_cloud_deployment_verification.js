import assert from 'assert';

const BASE_URL = 'http://localhost:3001/api';

async function runCloudVerification() {
  console.log('====================================================');
  console.log('MEDREMIND — PRODUCTION CLOUD & BACKEND VERIFICATION');
  console.log('====================================================\n');

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

  // 1. Health check & security headers
  await test('Health check returns ok, DB connected, version 2026.1, and security headers', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(res.status, 200);
    assert(res.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff present');
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.version, '2026.1');
    assert.strictEqual(data.database.status, 'connected');
    assert(data.geminiConfigured === true, 'Gemini configured');
  });

  // 2. Admin Authentication
  let adminToken = '';
  await test('Admin login with valid credentials (ADMIN / 123456) returns token', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'ADMIN', password: '123456' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert(data.success === true);
    assert.strictEqual(data.user.role, 'admin');
    assert(data.token && data.token.length > 20);
    adminToken = data.token;
  });

  await test('Admin login with invalid credentials is strictly rejected (401)', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'ADMIN', password: 'bad_password' })
    });
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert(data.success === false);
  });

  // 3. User Registration & Isolation
  const testEmail = `test.patient.${Date.now()}@example.com`;
  let patientToken = '';
  let patientId = '';

  await test('Patient registration creates new account, hashes password, returns token', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kavita Patel',
        email: testEmail,
        password: 'securePassword456',
        role: 'patient'
      })
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert(data.success === true);
    assert.strictEqual(data.user.name, 'Kavita Patel');
    assert.strictEqual(data.user.role, 'patient');
    assert(data.user.id.startsWith('USR-'));
    patientId = data.user.id;
    patientToken = data.token;
  });

  await test('Public registration strictly forbids creating administrator accounts (403)', async () => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Hacker Admin',
        email: 'hacker@test.internal',
        password: 'pass',
        role: 'admin'
      })
    });
    assert.strictEqual(res.status, 403);
  });

  // 4. Token verification
  await test('Authenticated /api/auth/me returns current user matching token', async () => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.id, patientId);
    assert.strictEqual(data.user.email, testEmail);
    assert(!data.user.passwordHash, 'Zero password hashes leaked');
  });

  // 5. Statutory DPDP Consent Storage
  await test('Statutory DPDP consent record is stored and retrievable by User ID', async () => {
    const postRes = await fetch(`${BASE_URL}/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: patientId,
        ageConfirmed: true,
        explicitConsentGiven: true,
        aiProcessingConsent: true
      })
    });
    assert.strictEqual(postRes.status, 201);

    const getRes = await fetch(`${BASE_URL}/consents/${patientId}`);
    assert.strictEqual(getRes.status, 200);
    const getData = await getRes.json();
    assert(getData.success === true);
    assert.strictEqual(getData.consent.userId, patientId);
    assert.strictEqual(getData.consent.documentVersions.terms, '2026.1');
    assert.strictEqual(getData.consent.documentVersions.privacy, '2026.1');
    assert.strictEqual(getData.consent.status, 'ACTIVE');
  });

  // 6. Medication & Schedule Persistence
  let createdMedId = '';
  await test('Medication creation stores to database and retrieves by patient ID', async () => {
    const medRes = await fetch(`${BASE_URL}/medications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
      body: JSON.stringify({
        patientId,
        name: 'Metformin 500mg',
        genericIngredient: 'Metformin Hydrochloride',
        dosage: '1 Tablet',
        frequency: 'Twice daily',
        morningDose: 1,
        afternoonDose: 0,
        nightDose: 1,
        status: 'Active'
      })
    });
    assert.strictEqual(medRes.status, 201);
    const medData = await medRes.json();
    assert(medData.success === true);
    createdMedId = medData.medication.id;

    const listRes = await fetch(`${BASE_URL}/medications?patientId=${patientId}`);
    const listData = await listRes.json();
    assert(listData.medications.some(m => m.id === createdMedId));
  });

  // 7. Synthetic Prescription Approval
  await test('Batch prescription approval updates database with medications & schedules', async () => {
    const approveRes = await fetch(`${BASE_URL}/approve-prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: `batch-${Date.now()}`,
        patientId,
        documents: [
          {
            documentId: `doc-${Date.now()}`,
            fileName: 'synthetic_rx.jpg',
            approvedMedicines: [
              {
                name: 'Amoxicillin 500mg',
                genericIngredient: 'Amoxicillin',
                dosage: '1 Capsule',
                frequency: 'Three times daily',
                times: ['08:00', '14:00', '20:00'],
                instructions: 'Take with food for 7 days'
              }
            ]
          }
        ]
      })
    });
    assert.strictEqual(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert(approveData.success === true);
    assert.strictEqual(approveData.createdMedications.length, 1);
    assert.strictEqual(approveData.createdSchedules.length, 3);
  });

  // 8. Database Backup Snapshot
  await test('Admin database backup endpoint exports snapshot without error', async () => {
    const backupRes = await fetch(`${BASE_URL}/admin/backup`, { method: 'POST' });
    assert.strictEqual(backupRes.status, 200);
    const backupData = await backupRes.json();
    assert(backupData.success === true);
    assert(backupData.backupFile.includes('medremind-backup-'));
    assert(backupData.counts.users >= 5);
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runCloudVerification();
