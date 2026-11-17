import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from './server.js';
import { db, generateToken, hashPassword, verifyPassword, verifyToken } from './database/db.js';

let server;
let baseUrl;
const patientToken = generateToken({ id: 'test-patient', role: 'patient' });
const adminToken = generateToken({ id: 'test-admin', role: 'admin' });

before(async () => {
  server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve())
    );
  }
});

test('password verification accepts only the exact PBKDF2 password', () => {
  const encoded = hashPassword('a-unique-test-password');
  assert.equal(verifyPassword('a-unique-test-password', encoded), true);
  assert.equal(verifyPassword('wrong-password', encoded), false);
  assert.equal(verifyPassword('123456', '123456'), false);
  assert.equal(verifyPassword('password123', 'password123'), false);
});

test('JWT verification rejects invalid, expired, and unsigned tokens', () => {
  const valid = generateToken({ id: 'test-user', role: 'patient' });
  assert.equal(verifyToken(valid)?.id, 'test-user');
  assert.equal(verifyToken('not-a-jwt'), null);
  assert.equal(verifyToken(generateToken({ id: 'expired-user', role: 'patient' }, -1)), null);
});

test('legacy hardcoded administrator credentials are rejected', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'ADMIN', password: '123456' })
  });
  assert.equal(response.status, 401);
});

test('admin user directory rejects unauthenticated and patient requests', async () => {
  const anonymous = await fetch(`${baseUrl}/api/users`);
  assert.equal(anonymous.status, 401);

  const patient = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  assert.equal(patient.status, 403);

  const admin = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(admin.status, 200);
});

test('patient medication endpoints require authentication and reject another patient ID', async () => {
  const anonymous = await fetch(`${baseUrl}/api/medications`);
  assert.equal(anonymous.status, 401);

  const crossPatient = await fetch(`${baseUrl}/api/medications?patientId=some-other-patient`, {
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  assert.equal(crossPatient.status, 403);
});

test('scheduler tick rejects requests without its shared secret', async () => {
  const response = await fetch(`${baseUrl}/api/tick`, { method: 'POST' });
  assert.equal(response.status, 401);
});


test('prescription media is not publicly served and signed previews are time-limited', async (t) => {
  const patientId = `media-test-${crypto.randomUUID()}`;
  const otherPatientId = `other-media-test-${crypto.randomUUID()}`;
  const filename = 'private-test-image.png';
  const patientKey = crypto.createHash('sha256').update(patientId).digest('hex');
  const otherPatientKey = crypto.createHash('sha256').update(otherPatientId).digest('hex');
  const patientDir = path.join(process.cwd(), 'uploads', patientKey);
  const otherPatientDir = path.join(process.cwd(), 'uploads', otherPatientKey);
  fs.mkdirSync(patientDir, { recursive: true });
  fs.writeFileSync(path.join(patientDir, filename), 'private-test-image');
  t.after(() => {
    fs.rmSync(patientDir, { recursive: true, force: true });
    fs.rmSync(otherPatientDir, { recursive: true, force: true });
  });

  const token = generateToken({ id: patientId, role: 'media', filename }, 1 / 6);
  const privateResponse = await fetch(`${baseUrl}/api/media/${token}`);
  assert.equal(privateResponse.status, 200);
  assert.equal(await privateResponse.text(), 'private-test-image');
  assert.match(privateResponse.headers.get('cache-control') || '', /no-store/);

  const publicResponse = await fetch(`${baseUrl}/uploads/${filename}`);
  assert.equal(publicResponse.status, 404);

  const otherPatientToken = generateToken({ id: otherPatientId, role: 'media', filename }, 1 / 6);
  const otherPatientResponse = await fetch(`${baseUrl}/api/media/${otherPatientToken}`);
  assert.equal(otherPatientResponse.status, 404);

  const expiredToken = generateToken({ id: patientId, role: 'media', filename }, -1);
  const expiredResponse = await fetch(`${baseUrl}/api/media/${expiredToken}`);
  assert.equal(expiredResponse.status, 401);

  const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  const tamperedResponse = await fetch(`${baseUrl}/api/media/${tamperedToken}`);
  assert.equal(tamperedResponse.status, 401);
});


test('prescription approval cannot modify a medication belonging to another patient', async (t) => {
  const actorId = `approval-actor-${crypto.randomUUID()}`;
  const ownerId = `approval-owner-${crypto.randomUUID()}`;
  const actorEmail = `${actorId}@example.test`;
  const ownerEmail = `${ownerId}@example.test`;
  await db.createUser({ id: actorId, name: 'Approval Actor', email: actorEmail, password: 'test-password-actor' });
  await db.createUser({ id: ownerId, name: 'Medication Owner', email: ownerEmail, password: 'test-password-owner' });

  const storePath = path.join(process.cwd(), 'data', 'medications.json');
  const hadStore = fs.existsSync(storePath);
  const originalStore = hadStore ? fs.readFileSync(storePath, 'utf8') : null;
  const protectedMedication = {
    id: `protected-med-${crypto.randomUUID()}`,
    patientId: ownerId,
    name: 'Owner medicine',
    instructions: 'Keep original instructions',
    status: 'ACTIVE'
  };
  fs.writeFileSync(storePath, JSON.stringify([protectedMedication], null, 2));
  t.after(() => {
    if (hadStore) fs.writeFileSync(storePath, originalStore);
    else fs.rmSync(storePath, { force: true });
  });

  const response = await fetch(`${baseUrl}/api/approve-prescriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${generateToken({ id: actorId, role: 'patient' })}`
    },
    body: JSON.stringify({
      batchId: 'cross-patient-duplicate-test',
      documents: [{
        documentId: 'attacker-controlled-document',
        approvedMedicines: [{
          isDuplicateRecord: true,
          existingMedicationId: protectedMedication.id,
          name: 'Attacker supplied medicine',
          instructions: 'Attacker changed instructions'
        }]
      }]
    })
  });

  assert.equal(response.status, 200);
  const saved = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const stillProtected = saved.find(item => item.id === protectedMedication.id);
  assert.equal(stillProtected.patientId, ownerId);
  assert.equal(stillProtected.instructions, 'Keep original instructions');
});


test('scan endpoints reject spoofed image MIME types based on actual file signatures', async () => {
  const response = await fetch(`${baseUrl}/api/scan-strip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}`
    },
    body: JSON.stringify({
      imageBase64: 'data:image/png;base64,QUFBQQ==',
      mode: 'online'
    })
  });
  assert.equal(response.status, 415);
});


test('prescription batch endpoint caps the number of uploaded documents', async () => {
  const response = await fetch(`${baseUrl}/api/scan-prescriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}`
    },
    body: JSON.stringify({
      files: Array.from({ length: 6 }, (_, index) => ({
        name: `document-${index + 1}.jpg`,
        dataBase64: 'AAAA'
      }))
    })
  });
  assert.equal(response.status, 413);
  const payload = await response.json();
  assert.match(payload.error, /at most 5/);
});


test('PostgreSQL user lookups do not fall back to stale local account records', async () => {
  const previousIsPostgres = db.isPostgres;
  const previousPool = db.pool;
  const staleUser = {
    id: `stale-user-${crypto.randomUUID()}`,
    email: `stale-${crypto.randomUUID()}@example.test`,
    name: 'Stale Local User',
    role: 'patient'
  };
  db.memory.users.push(staleUser);
  db.isPostgres = true;
  db.pool = { query: async () => ({ rows: [] }) };

  try {
    assert.equal(await db.findUserById(staleUser.id), null);
    assert.equal(await db.findUserByEmailOrId(staleUser.email), null);
    assert.equal(await db.updateUserStatus(staleUser.id, 'Suspended'), null);
    assert.equal(await db.updateMedicalInfo(staleUser.id, { allergies: [], medicalInfo: {} }), null);

    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.equal(await db.scheduleUserDeletion(staleUser.id), null);
      assert.equal(await db.cancelUserDeletion(staleUser.id), null);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  } finally {
    db.isPostgres = previousIsPostgres;
    db.pool = previousPool;
    db.memory.users = db.memory.users.filter(user => user.id !== staleUser.id);
  }
});


test('account deletion endpoints reject unauthenticated requests', async () => {
  const schedule = await fetch(`${baseUrl}/api/auth/schedule-deletion`, { method: 'POST' });
  assert.equal(schedule.status, 401);

  const cancel = await fetch(`${baseUrl}/api/auth/cancel-deletion`, { method: 'POST' });
  assert.equal(cancel.status, 401);
});


test('PostgreSQL dose logs persist against a real schedule and can be retrieved', async () => {
  const previousIsPostgres = db.isPostgres;
  const previousPool = db.pool;
  const previousSave = db.saveDurableStore;
  const previousDoseLogs = db.memory.doseLogs;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const scheduledTime = [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')].join(':');
  const calls = [];

  db.isPostgres = true;
  db.saveDurableStore = () => {};
  db.memory.doseLogs = [];
  db.pool = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT id FROM public.medications')) {
        return { rows: [{ id: 'med-dose-test' }], rowCount: 1 };
      }
      if (sql.includes('SELECT id FROM public.dose_schedules')) {
        return { rows: [{ id: 'schedule-dose-test' }], rowCount: 1 };
      }
      if (sql.includes('SELECT d.id, d.patient_id')) {
        return {
          rows: [{
            id: 'dose-occurrence-test',
            patient_id: 'patient-dose-test',
            medication_id: 'med-dose-test',
            date_key: today,
            scheduled_timestamp: new Date(),
            status: 'TAKEN',
            recorded_at: new Date(),
            time_display: '08:00 AM',
            time_slot_label: 'Morning'
          }]
        };
      }
      return { rows: [], rowCount: 1 };
    }
  };

  try {
    const recorded = await db.recordDoseLog({
      patientId: 'patient-dose-test',
      medicationId: 'med-dose-test',
      timeSlot: 'Morning (08:00 AM)',
      scheduledTime,
      status: 'taken',
      dateKey: today
    });
    assert.equal(recorded.status, 'taken');

    const insert = calls.find(call => call.sql.includes('INSERT INTO public.dose_occurrences'));
    assert.ok(insert, 'dose occurrence insert should execute');
    assert.match(insert.sql, /schedule_id, medication_id, patient_id/);
    assert.match(insert.sql, /ON CONFLICT \(schedule_id, scheduled_date\) DO UPDATE/);
    assert.equal(insert.params[0], 'schedule-dose-test');

    const logs = await db.getDoseLogs('patient-dose-test', today);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].patientId, 'patient-dose-test');
    assert.equal(logs[0].status, 'taken');
    assert.equal(logs[0].timeSlot, '08:00 AM');
    const doseToken = generateToken({ id: 'patient-dose-test', role: 'patient' });
    const response = await fetch(`${baseUrl}/api/dose-logs?date=${today}`, {
      headers: { Authorization: `Bearer ${doseToken}` }
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.logs.length, 1);
    assert.equal(payload.logs[0].status, 'taken');
  } finally {
    db.isPostgres = previousIsPostgres;
    db.pool = previousPool;
    db.saveDurableStore = previousSave;
    db.memory.doseLogs = previousDoseLogs;
  }
});


test('dose recording rejects invalid status and malformed calendar dates', async () => {
  const previousIsPostgres = db.isPostgres;
  const previousPool = db.pool;
  db.isPostgres = false;
  db.pool = null;
  try {
    await assert.rejects(
      db.recordDoseLog({
        patientId: 'patient-dose-test',
        medicationId: 'med-dose-test',
        timeSlot: '08:00 AM',
        status: 'pending'
      }),
      /status must be either taken or skipped/
    );
    await assert.rejects(
      db.recordDoseLog({
        patientId: 'patient-dose-test',
        medicationId: 'med-dose-test',
        timeSlot: '08:00 AM',
        status: 'taken',
        dateKey: '2026-02-30'
      }),
      /valid calendar date/
    );
  } finally {
    db.isPostgres = previousIsPostgres;
    db.pool = previousPool;
  }
});
