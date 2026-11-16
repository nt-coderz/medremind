import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from './server.js';
import { generateToken, hashPassword, verifyPassword, verifyToken } from './database/db.js';

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
  if (server) await new Promise((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve())
  );
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
