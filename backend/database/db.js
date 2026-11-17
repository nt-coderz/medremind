import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { normalizeTimeTo24Hour } from '../utils/timeUtils.js';
import { getDatabaseSslConfig } from './sslConfig.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load backend/.env before reading DATABASE_URL or AUTH_SECRET. Static ESM imports
// are evaluated before server.js executes dotenv.config(), so this module must
// initialize its own environment before creating the database pool or token secret.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dataDir = path.join(__dirname, '..', 'data');
const backupsDir = path.join(dataDir, 'backups');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
try { fs.chmodSync(dataDir, 0o700); fs.chmodSync(backupsDir, 0o700); } catch {}

// Secret management for auth tokens
const SECRET_FILE = path.join(dataDir, '.auth_secret');
let AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  if (fs.existsSync(SECRET_FILE)) {
    AUTH_SECRET = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
  } else {
    AUTH_SECRET = crypto.randomBytes(32).toString('hex');
    try { fs.writeFileSync(SECRET_FILE, AUTH_SECRET, { mode: 0o600 }); } catch (e) {}
  }
}
try { if (fs.existsSync(SECRET_FILE)) fs.chmodSync(SECRET_FILE, 0o600); } catch {}

// Password hashing utilities using crypto PBKDF2
export function hashPassword(plainTextPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plainTextPassword, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plainTextPassword, storedHash) {
  if (typeof plainTextPassword !== 'string' || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  // PBKDF2-SHA512 with a 16-byte hex salt and 64-byte hex digest.
  if (!/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(originalHash)) return false;
  try {
    const computedHash = crypto.pbkdf2Sync(plainTextPassword, salt, 100000, 64, 'sha512');
    const expectedHash = Buffer.from(originalHash, 'hex');
    return expectedHash.length === computedHash.length &&
      crypto.timingSafeEqual(computedHash, expectedHash);
  } catch {
    return false;
  }
}

// Simple signed token generator
export function generateToken(payload, expiresInHours = 72) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (expiresInHours * 3600);
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  try {
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf-8'));
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') return null;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET)
      .update(`${header}.${body}`).digest();
    const suppliedSig = Buffer.from(signature, 'base64url');
    if (suppliedSig.length !== expectedSig.length ||
        !crypto.timingSafeEqual(suppliedSig, expectedSig)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(payload.exp) || payload.exp <= now) return null;
    if (!payload.id || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// Database Store (Supabase PostgreSQL + Durable Fallback)
// -------------------------------------------------------------
const STORE_FILE = path.join(dataDir, 'medremind_store.json');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isPostgres = false;
    this.postgresError = null;
    this.memory = {
      users: [],
      prescriptions: [],
      medications: [],
      schedules: [],
      doseLogs: [],
      consents: [],
      auditLogs: [],
      notifications: [],
      foodLogs: [],
      nutritionTargets: {}
    };
    this.init();
  }

  init() {
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
      try {
        const connStr = process.env.DATABASE_URL.trim();
        const ssl = getDatabaseSslConfig(connStr);
        this.pool = new pg.Pool({
          connectionString: connStr,
          ssl,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000
        });

        // Critical: Attach pool-level error handler to prevent unhandled EventEmitter process crashes
        // when Supavisor or PostgreSQL closes an idle connection
        this.pool.on('error', (err, client) => {
          console.error('[Database Pool Warning] Idle client connection error:', err.message);
          this.postgresError = err.message;
        });

        this.isPostgres = true;
        console.log('[Database] Supabase PostgreSQL pool initialized with connection string.');

        // Test connectivity immediately
        this.pool.query('SELECT NOW() as current_time', (err, res) => {
          if (err) {
            console.error('[Database] PostgreSQL connection test failed:', err.message);
            this.postgresError = err.message;
            if (process.env.NODE_ENV === 'production') {
              console.error('[Database] CRITICAL: Running in production with failing DATABASE_URL!');
            }
          } else {
            console.log('[Database] Connected to PostgreSQL. Server timestamp:', res.rows[0].current_time);
            this.postgresError = null;
          }
        });
      } catch (err) {
        console.error('[Database] Failed to configure PostgreSQL pool:', err);
        this.isPostgres = false;
        this.postgresError = err.message;
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        console.warn('[Database] WARNING: NODE_ENV=production but no DATABASE_URL configured.');
      }
    }

    // Always load local store for offline development / recovery
    this.loadDurableStore();
  }

  async checkHealth() {
    if (this.isPostgres && this.pool) {
      try {
        const start = Date.now();
        const res = await this.pool.query('SELECT NOW() as current_time, COUNT(*) as user_count FROM public.profiles');
        const latency = Date.now() - start;
        return {
          type: 'Supabase PostgreSQL',
          status: 'connected',
          latencyMs: latency,
          currentTime: res.rows[0].current_time,
          totalUsersInDb: parseInt(res.rows[0].user_count, 10)
        };
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          return {
            type: 'Supabase PostgreSQL',
            status: 'error',
            error: err.message
          };
        }
      }
    }

    return {
      type: this.isPostgres ? 'PostgreSQL (Connecting/Degraded)' : 'DurableStore (Local)',
      status: this.postgresError ? 'degraded' : 'connected',
      error: this.postgresError || null,
      recordCounts: {
        users: this.memory.users.length,
        medications: this.memory.medications.length,
        schedules: this.memory.schedules.length
      }
    };
  }

  loadDurableStore() {
    if (fs.existsSync(STORE_FILE)) {
      try {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.memory = { ...this.memory, ...parsed };
      } catch (err) {
        console.error('[Database] Error loading durable store file:', err);
      }
    }
  }

  saveDurableStore() {
    try {
      const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(this.memory, null, 2), { encoding: 'utf-8', mode: 0o600 });
      fs.renameSync(tempFile, STORE_FILE);
    } catch (err) {
      console.error('[Database] Error saving durable store:', err);
    }
  }

  // Backup strategy
  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupsDir, `medremind-backup-${timestamp}.json`);
    const payload = {
      backupDate: new Date().toISOString(),
      counts: {
        users: this.memory.users.length,
        prescriptions: this.memory.prescriptions.length,
        medications: this.memory.medications.length,
        schedules: this.memory.schedules.length,
        doseLogs: this.memory.doseLogs.length,
        consents: this.memory.consents.length,
        auditLogs: this.memory.auditLogs.length
      },
      data: this.memory
    };
    fs.writeFileSync(backupFile, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
    return {
      success: true,
      backupFile: path.basename(backupFile),
      counts: payload.counts
    };
  }

  // -------------------------------------------------------------
  // User Operations (PostgreSQL Async + Fallback)
  // -------------------------------------------------------------
  async findUserByEmailOrId(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim();

    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT user_id as id, email, full_name as name, dob, gender, phone_number as "phoneNumber", allergies, medical_info as "medicalInfo", role, status, password_hash as "passwordHash", registered_at as "registeredAt",
                  scheduled_deletion_at as "scheduledDeletionAt", deletion_requested_by as "deletionRequestedBy", deletion_reason as "deletionReason"
           FROM public.profiles
           WHERE LOWER(email) = LOWER($1) OR user_id = $1 OR phone_number = $1
           LIMIT 1`,
          [clean]
        );
        return res.rows[0] || null;
      } catch (err) {
        console.error('[Database] PostgreSQL findUser error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    // Fallback to local memory store
    const lower = clean.toLowerCase();
    return this.memory.users.find(u => 
      u.email.toLowerCase() === lower || 
      u.id.toLowerCase() === lower || 
      (u.phoneNumber && u.phoneNumber === clean) ||
      (u.phone && u.phone === clean) ||
      (lower === 'admin' && u.role === 'admin')
    ) || null;
  }

  async findUserById(id) {
    if (!id) return null;
    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT user_id as id, email, full_name as name, dob, gender, phone_number as "phoneNumber", allergies, medical_info as "medicalInfo", role, status, password_hash as "passwordHash", registered_at as "registeredAt",
                  scheduled_deletion_at as "scheduledDeletionAt", deletion_requested_by as "deletionRequestedBy", deletion_reason as "deletionReason"
           FROM public.profiles WHERE user_id = $1 LIMIT 1`,
          [id]
        );
        return res.rows[0] || null;
      } catch (err) {
        console.error('[Database] PostgreSQL findUserById error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }
    return this.memory.users.find(u => u.id === id) || null;
  }

  async getMedicalInfo(userId) {
    const user = await this.findUserById(userId);
    if (!user) return null;
    return {
      allergies: Array.isArray(user.allergies) ? user.allergies : [],
      medicalInfo: user.medicalInfo || {}
    };
  }

  async updateMedicalInfo(userId, { allergies, medicalInfo }) {
    const safeAllergies = Array.isArray(allergies) 
      ? allergies.map(a => String(a).trim().slice(0, 100)).filter(Boolean).slice(0, 30)
      : [];
    const safeMedicalInfo = typeof medicalInfo === 'object' && medicalInfo !== null ? medicalInfo : {};

    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `UPDATE public.profiles 
           SET allergies = $1, medical_info = $2, updated_at = NOW() 
           WHERE user_id = $3
           RETURNING user_id as id, email, full_name as name, allergies, medical_info as "medicalInfo"`,
          [safeAllergies, JSON.stringify(safeMedicalInfo), userId]
        );
        if (!res.rows.length) return null;
        return {
          allergies: res.rows[0].allergies || [],
          medicalInfo: res.rows[0].medicalInfo || {}
        };
      } catch (err) {
        console.error('[Database] PostgreSQL updateMedicalInfo error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const user = this.memory.users.find(u => u.id === userId);
    if (!user) return null;
    user.allergies = safeAllergies;
    user.medicalInfo = safeMedicalInfo;
    user.updatedAt = new Date().toISOString();
    this.saveDurableStore();

    return {
      allergies: user.allergies,
      medicalInfo: user.medicalInfo
    };
  }

  async createUser(userData) {
    const existing = await this.findUserByEmailOrId(userData.email);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const cleanPhone = (userData.phone || userData.phoneNumber || '').trim();
    if (cleanPhone) {
      const existingPhone = await this.findUserByEmailOrId(cleanPhone);
      if (existingPhone) {
        throw new Error('An account with this phone number already exists.');
      }
    }

    const uniqueId = userData.id || `USR-${crypto.randomUUID()}`;
    if (!userData.password && !userData.passwordHash) {
      throw new Error('A password is required when creating a user account.');
    }
    const pwdHash = userData.passwordHash || hashPassword(userData.password);
    const role = 'patient';
    const regDate = new Date().toISOString().split('T')[0];
    const dob = userData.dob || null;
    const gender = userData.gender || null;

    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `INSERT INTO public.profiles (user_id, email, full_name, dob, gender, phone_number, role, status, password_hash, registered_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', $8, $9)
           RETURNING user_id as id, email, full_name as name, dob, gender, phone_number as "phoneNumber", role, status, registered_at as "registeredAt"`,
          [uniqueId, userData.email.toLowerCase(), userData.name.trim(), dob, gender, cleanPhone || null, role, pwdHash, regDate]
        );
        return res.rows[0];
      } catch (err) {
        console.error('[Database] PostgreSQL createUser error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const newUser = {
      id: uniqueId,
      name: userData.name.trim(),
      email: userData.email.toLowerCase(),
      dob,
      gender,
      phoneNumber: cleanPhone || null,
      phone: cleanPhone || null,
      passwordHash: pwdHash,
      role,
      status: 'Active',
      registeredAt: regDate,
      createdAt: new Date().toISOString()
    };
    this.memory.users.unshift(newUser);
    this.saveDurableStore();
    return newUser;
  }

  async updateUserStatus(userId, newStatus) {
    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `UPDATE public.profiles SET status = $1, updated_at = NOW() WHERE user_id = $2
           RETURNING user_id as id, email, full_name as name, role, status, registered_at as "registeredAt"`,
          [newStatus, userId]
        );
        return res.rows[0] || null;
      } catch (err) {
        console.error('[Database] PostgreSQL updateUserStatus error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const user = this.memory.users.find(u => u.id === userId);
    if (!user) return null;
    user.status = newStatus;
    user.updatedAt = new Date().toISOString();
    this.saveDurableStore();
    return user;
  }

  async listUsers() {
    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT user_id as id, email, full_name as name, role, status, registered_at as "registeredAt",
                  scheduled_deletion_at as "scheduledDeletionAt", deletion_requested_by as "deletionRequestedBy", deletion_reason as "deletionReason"
           FROM public.profiles ORDER BY registered_at DESC`
        );
        return res.rows;
      } catch (err) {
        console.error('[Database] PostgreSQL listUsers error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }
    return this.memory.users.map(({ passwordHash, ...u }) => u);
  }

  // -------------------------------------------------------------
  // Account Deletion Operations (24-Hour Grace Period)
  // -------------------------------------------------------------
  async scheduleUserDeletion(userId, requestedBy = 'user', reason = 'User requested account closure', scheduledAt = null) {
    const finalScheduledAt = scheduledAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `UPDATE public.profiles 
           SET status = 'Pending_Deletion', 
               scheduled_deletion_at = $1, 
               deletion_requested_by = $2, 
               deletion_reason = $3,
               updated_at = NOW() 
           WHERE user_id = $4
           RETURNING user_id as id, email, full_name as name, role, status, 
                     scheduled_deletion_at as "scheduledDeletionAt", 
                     deletion_requested_by as "deletionRequestedBy", 
                     deletion_reason as "deletionReason"`,
          [finalScheduledAt, requestedBy, reason, userId]
        );
        if (res.rows.length > 0) {
          await this.logAudit('ACCOUNT_DELETION_SCHEDULED', requestedBy, {
            targetUserId: userId,
            scheduledDeletionAt: finalScheduledAt,
            reason
          }, 'PROFILE', userId);
          return res.rows[0];
        }
        if (process.env.NODE_ENV === 'production') return null;
      } catch (err) {
        console.error('[Database] PostgreSQL scheduleUserDeletion error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const user = this.memory.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    user.status = 'Pending_Deletion';
    user.scheduledDeletionAt = finalScheduledAt;
    user.deletionRequestedBy = requestedBy;
    user.deletionReason = reason;
    user.updatedAt = new Date().toISOString();
    this.saveDurableStore();

    await this.logAudit('ACCOUNT_DELETION_SCHEDULED', requestedBy, {
      targetUserId: userId,
      scheduledDeletionAt: finalScheduledAt,
      reason
    }, 'PROFILE', userId);

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async cancelUserDeletion(userId, cancelledBy = 'user') {
    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `UPDATE public.profiles 
           SET status = 'Active', 
               scheduled_deletion_at = NULL, 
               deletion_requested_by = NULL, 
               deletion_reason = NULL,
               updated_at = NOW() 
           WHERE user_id = $1
           RETURNING user_id as id, email, full_name as name, role, status, registered_at as "registeredAt"`,
          [userId]
        );
        if (res.rows.length > 0) {
          await this.logAudit('ACCOUNT_DELETION_CANCELLED', cancelledBy, {
            targetUserId: userId
          }, 'PROFILE', userId);
          return res.rows[0];
        }
        if (process.env.NODE_ENV === 'production') return null;
      } catch (err) {
        console.error('[Database] PostgreSQL cancelUserDeletion error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const user = this.memory.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    user.status = 'Active';
    delete user.scheduledDeletionAt;
    delete user.deletionRequestedBy;
    delete user.deletionReason;
    user.updatedAt = new Date().toISOString();
    this.saveDurableStore();

    await this.logAudit('ACCOUNT_DELETION_CANCELLED', cancelledBy, {
      targetUserId: userId
    }, 'PROFILE', userId);

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async executeScheduledDeletions() {
    const nowIso = new Date().toISOString();
    const deletedIds = [];

    if (this.isPostgres && this.pool) {
      try {
        const pendingUsers = await this.pool.query(
          `SELECT user_id, email, full_name FROM public.profiles 
           WHERE status = 'Pending_Deletion' AND scheduled_deletion_at <= NOW()`
        );

        for (const row of pendingUsers.rows) {
          await this.pool.query(`DELETE FROM public.profiles WHERE user_id = $1`, [row.user_id]);
          await this.logAudit('ACCOUNT_DELETED_PERMANENTLY', 'SYSTEM_DELETION_WORKER', {
            userId: row.user_id,
            email: row.email,
            deletedAt: nowIso
          }, 'PROFILE', row.user_id);
          deletedIds.push(row.user_id);
          console.log(`[Database] Account ${row.user_id} (${row.email}) permanently deleted after 24h grace period.`);
        }
        return deletedIds;
      } catch (err) {
        console.error('[Database] PostgreSQL executeScheduledDeletions error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    // Fallback in-memory / JSON store deletion
    const dueUsers = this.memory.users.filter(u => 
      u.status === 'Pending_Deletion' && 
      u.scheduledDeletionAt && 
      new Date(u.scheduledDeletionAt).getTime() <= Date.now()
    );

    for (const u of dueUsers) {
      const uId = u.id;
      // Cascade associated user records
      if (Array.isArray(this.memory.users)) this.memory.users = this.memory.users.filter(usr => usr.id !== uId);
      if (Array.isArray(this.memory.medications)) this.memory.medications = this.memory.medications.filter(m => m.patientId !== uId);
      if (Array.isArray(this.memory.schedules)) this.memory.schedules = this.memory.schedules.filter(s => s.patientId !== uId);
      if (Array.isArray(this.memory.doseLogs)) this.memory.doseLogs = this.memory.doseLogs.filter(d => d.patientId !== uId);
      if (Array.isArray(this.memory.prescriptions)) this.memory.prescriptions = this.memory.prescriptions.filter(p => p.patientId !== uId);
      if (Array.isArray(this.memory.notifications)) this.memory.notifications = this.memory.notifications.filter(n => n.recipientId !== uId);

      await this.logAudit('ACCOUNT_DELETED_PERMANENTLY', 'SYSTEM_DELETION_WORKER', {
        userId: uId,
        email: u.email,
        deletedAt: nowIso
      }, 'PROFILE', uId);

      deletedIds.push(uId);
      console.log(`[Database] In-memory account ${uId} (${u.email}) permanently deleted.`);
    }

    if (deletedIds.length > 0) {
      this.saveDurableStore();
    }

    return deletedIds;
  }

  // -------------------------------------------------------------
  // Medication Operations (PostgreSQL Async + Fallback)
  // -------------------------------------------------------------
  async getMedications(patientId) {
    if (this.isPostgres && this.pool) {
      try {
        const query = patientId 
          ? `SELECT * FROM public.medications WHERE patient_id = $1 AND status != 'Discontinued' ORDER BY created_at DESC`
          : `SELECT * FROM public.medications WHERE status != 'Discontinued' ORDER BY created_at DESC`;
        const res = await this.pool.query(query, patientId ? [patientId] : []);
        return res.rows.map(m => ({
          id: m.id,
          patientId: m.patient_id,
          name: m.name || m.standardized_name,
          brandName: m.brand_name || m.name,
          genericIngredient: m.generic_ingredient || m.name,
          dosage: m.dosage,
          strength: m.strength,
          form: m.form,
          route: m.route,
          morningDose: m.morning_dose,
          afternoonDose: m.afternoon_dose,
          nightDose: m.night_dose,
          frequency: m.frequency,
          timing: m.timing,
          duration: m.duration,
          instructions: m.instructions,
          status: m.status,
          createdAt: m.created_at
        }));
      } catch (err) {
        console.error('[Database] PostgreSQL getMedications error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    if (!patientId) return this.memory.medications;
    return this.memory.medications.filter(m => m.patientId === patientId);
  }

  async saveMedication(medData) {
    const id = medData.id || `med-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const name = medData.name || medData.brandName || 'Medication';
    const brandName = medData.brandName || name;
    const generic = medData.genericIngredient || name;

    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `INSERT INTO public.medications (
             id, patient_id, originally_prescribed_name, standardized_name,
             brand_name, generic_ingredient, dosage, strength, form, route,
             morning_dose, afternoon_dose, night_dose, frequency, timing,
             duration, instructions, status, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
           ON CONFLICT (id) DO UPDATE SET
             instructions = EXCLUDED.instructions,
             frequency = EXCLUDED.frequency,
             status = EXCLUDED.status,
             updated_at = NOW()
           WHERE medications.patient_id = EXCLUDED.patient_id
           RETURNING *`,
          [
            id,
            medData.patientId || 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82',
            name,
            name,
            brandName,
            generic,
            medData.dosage || '1 Tablet',
            medData.strength || 'As Prescribed',
            medData.form || 'Tablet',
            medData.route || 'Oral',
            medData.morningDose !== undefined ? medData.morningDose : 1,
            medData.afternoonDose !== undefined ? medData.afternoonDose : 0,
            medData.nightDose !== undefined ? medData.nightDose : 0,
            medData.frequency || 'Once daily',
            medData.timing || 'After meals',
            medData.duration || 'Ongoing',
            medData.instructions || 'Take as directed',
            medData.status || 'Active'
          ]
        );
        return res.rows[0];
      } catch (err) {
        console.error('[Database] PostgreSQL saveMedication error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const newMed = {
      ...medData,
      id,
      name,
      brandName,
      genericIngredient: generic,
      status: medData.status || 'Active',
      createdAt: medData.createdAt || new Date().toISOString()
    };
    const idx = this.memory.medications.findIndex(m => m.id === id);
    if (idx >= 0) {
      const existingPatientId = this.memory.medications[idx].patientId || this.memory.medications[idx].patient_id;
      if (existingPatientId && existingPatientId !== newMed.patientId) {
        throw new Error('Medication ID belongs to another patient.');
      }
      this.memory.medications[idx] = { ...this.memory.medications[idx], ...newMed };
    } else {
      this.memory.medications.unshift(newMed);
    }
    this.saveDurableStore();
    return newMed;
  }

  async updateMedication(id, updates, patientId = null) {
    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `UPDATE public.medications SET
             instructions = COALESCE($1, instructions),
             frequency = COALESCE($2, frequency),
             status = COALESCE($3, status),
             updated_at = NOW()
           WHERE id = $4 AND ($5::text IS NULL OR patient_id::text = $5)
           RETURNING *`,
          [updates.instructions || null, updates.frequency || null, updates.status || null, id, patientId]
        );
        if (res.rows.length > 0) return res.rows[0];
        return null;
      } catch (err) {
        console.error('[Database] PostgreSQL updateMedication error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const idx = this.memory.medications.findIndex(m =>
      m.id === id && (!patientId || m.patientId === patientId || m.patient_id === patientId)
    );
    if (idx === -1) return null;
    this.memory.medications[idx] = { ...this.memory.medications[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveDurableStore();
    return this.memory.medications[idx];
  }

  async deleteMedication(id, patientId = null) {
    if (this.isPostgres && this.pool) {
      try {
        const result = await this.pool.query(
          'DELETE FROM public.medications WHERE id = $1 AND ($2::text IS NULL OR patient_id::text = $2)',
          [id, patientId]
        );
        return result.rowCount > 0;
      } catch (err) {
        console.error('[Database] PostgreSQL deleteMedication error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const idx = this.memory.medications.findIndex(m =>
      m.id === id && (!patientId || m.patientId === patientId || m.patient_id === patientId)
    );
    if (idx === -1) return false;
    this.memory.medications.splice(idx, 1);
    this.memory.schedules = this.memory.schedules.filter(s => s.medicationId !== id);
    this.saveDurableStore();
    return true;
  }

  // -------------------------------------------------------------
  // Schedules Operations (PostgreSQL Async + Fallback)
  // -------------------------------------------------------------
  async getSchedules(patientId) {
    if (this.isPostgres && this.pool) {
      try {
        const query = patientId
          ? `SELECT * FROM public.dose_schedules WHERE patient_id = $1 AND is_active = true ORDER BY scheduled_time ASC`
          : `SELECT * FROM public.dose_schedules WHERE is_active = true ORDER BY scheduled_time ASC`;
        const res = await this.pool.query(query, patientId ? [patientId] : []);
        return res.rows.map(s => ({
          id: s.id,
          medicationId: s.medication_id,
          patientId: s.patient_id,
          time: s.time_display || s.scheduled_time,
          status: s.status,
          scheduledDose: s.scheduled_dose
        }));
      } catch (err) {
        console.error('[Database] PostgreSQL getSchedules error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    if (!patientId) return this.memory.schedules;
    return this.memory.schedules.filter(s => s.patientId === patientId);
  }

  async saveSchedule(schData) {
    if (!schData.patientId || !schData.medicationId) {
      throw new Error('Patient and medication are required to create a dose schedule.');
    }
    if (this.isPostgres && this.pool) {
      const owner = await this.pool.query(
        'SELECT id FROM public.medications WHERE id = $1 AND patient_id::text = $2',
        [schData.medicationId, String(schData.patientId)]
      );
      if (owner.rowCount === 0) throw new Error('Medication does not belong to this patient.');
    } else {
      const owner = this.memory.medications.find(m =>
        m.id === schData.medicationId &&
        String(m.patientId || m.patient_id) === String(schData.patientId)
      );
      if (!owner) throw new Error('Medication does not belong to this patient.');
    }

    const id = schData.id || `sch-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const timeDisplay = schData.time || '08:00 AM';
    let scheduledTime;
    try {
      scheduledTime = normalizeTimeTo24Hour(timeDisplay);
    } catch (err) {
      console.warn(`[Database] Time normalization warning for "${timeDisplay}":`, err.message);
      scheduledTime = '08:00:00';
    }

    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `INSERT INTO public.dose_schedules (
             id, medication_id, patient_id, time_slot_label, scheduled_time,
             time_display, scheduled_dose, is_active, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
           ON CONFLICT (id) DO UPDATE SET
             time_slot_label = EXCLUDED.time_slot_label,
             scheduled_time = EXCLUDED.scheduled_time,
             time_display = EXCLUDED.time_display,
             scheduled_dose = EXCLUDED.scheduled_dose,
             is_active = EXCLUDED.is_active
           WHERE dose_schedules.patient_id = EXCLUDED.patient_id
           RETURNING *`,
          [
            id, schData.medicationId, schData.patientId,
            schData.timeSlotLabel || timeDisplay,
            scheduledTime,
            timeDisplay,
            schData.scheduledDose || '1 Dose'
          ]
        );
        if (!res.rows[0]) throw new Error('Schedule ID already belongs to another patient.');
        return res.rows[0];
      } catch (err) {
        console.error('[Database] PostgreSQL saveSchedule error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const newSch = { ...schData, id, time: timeDisplay, createdAt: new Date().toISOString() };
    const idx = this.memory.schedules.findIndex(s => s.id === id);
    if (idx >= 0) {
      if (this.memory.schedules[idx].patientId !== newSch.patientId) {
        throw new Error('Schedule ID belongs to another patient.');
      }
      this.memory.schedules[idx] = { ...this.memory.schedules[idx], ...newSch };
    } else {
      this.memory.schedules.push(newSch);
    }
    this.saveDurableStore();
    return newSch;
  }

  // -------------------------------------------------------------
  // Dose Logs Operations
  // -------------------------------------------------------------
  async getDoseLogs(patientId, dateKey) {
    if (this.isPostgres && this.pool) {
      try {
        const conditions = [];
        const params = [];
        if (patientId) {
          params.push(patientId);
          conditions.push(`d.patient_id = ${params.length}`);
        }
        if (dateKey) {
          params.push(dateKey);
          conditions.push(`d.scheduled_date = ${params.length}::date`);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await this.pool.query(
          `SELECT d.id, d.patient_id, d.medication_id, d.scheduled_date::text AS date_key,
                  d.scheduled_timestamp, d.status, d.recorded_at, d.notes,
                  s.time_display, s.time_slot_label
           FROM public.dose_occurrences d
           LEFT JOIN public.dose_schedules s ON s.id = d.schedule_id
           ${where}
           ORDER BY d.scheduled_timestamp DESC`,
          params
        );
        return result.rows.map(row => ({
          id: row.id,
          patientId: row.patient_id,
          medicationId: row.medication_id,
          dateKey: row.date_key,
          timeSlot: row.time_display || row.time_slot_label || '',
          scheduledTime: row.scheduled_timestamp,
          status: String(row.status || '').toLowerCase(),
          recordedAt: row.recorded_at,
          notes: row.notes
        }));
      } catch (err) {
        console.error('[Database] PostgreSQL getDoseLogs error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    return this.memory.doseLogs.filter(l => {
      if (patientId && l.patientId !== patientId) return false;
      if (dateKey && l.dateKey !== dateKey) return false;
      return true;
    });
  }

  async recordDoseLog({ patientId, medicationId, timeSlot, status, dateKey, scheduledTime }) {
    if (!patientId || !medicationId) {
      throw new Error('Patient and medication are required to record a dose.');
    }
    if (this.isPostgres && this.pool) {
      const owner = await this.pool.query(
        'SELECT id FROM public.medications WHERE id = $1 AND patient_id::text = $2',
        [medicationId, String(patientId)]
      );
      if (owner.rowCount === 0) throw new Error('Medication does not belong to this patient.');
    } else {
      const owner = this.memory.medications.find(m =>
        m.id === medicationId &&
        String(m.patientId || m.patient_id) === String(patientId)
      );
      if (!owner) throw new Error('Medication does not belong to this patient.');
    }

    const now = new Date();
    const todayDateKey = now.toISOString().split('T')[0];
    const targetDateKey = dateKey || todayDateKey;

    // Strict validation: Reject future date recordings
    if (targetDateKey > todayDateKey) {
      throw new Error('Dose cannot be recorded for a future date.');
    }

    // Strict validation: If scheduled for today, reject if scheduled time is in the future
    if (targetDateKey === todayDateKey) {
      const timeStr = scheduledTime || timeSlot;
      if (timeStr) {
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const ampm = match[3] ? match[3].toUpperCase() : null;
          if (ampm === 'PM' && hours < 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;

          const scheduledDateTime = new Date();
          scheduledDateTime.setHours(hours, minutes, 0, 0);

          // If scheduled time is more than 60 seconds in the future
          if (scheduledDateTime.getTime() - now.getTime() > 60000) {
            throw new Error('Dose cannot be recorded before its scheduled time.');
          }
        }
      }
    }

    const id = `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const newLog = {
      id,
      patientId,
      medicationId,
      timeSlot,
      status, // 'taken' | 'skipped'
      dateKey: targetDateKey,
      recordedAt: new Date().toISOString()
    };

    if (this.isPostgres && this.pool) {
      try {
        const rawTime = scheduledTime || timeSlot;
        let requestedTime;
        try {
          requestedTime = normalizeTimeTo24Hour(rawTime);
        } catch (timeError) {
          const embeddedTime = String(rawTime || '').match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/i)?.[0];
          if (!embeddedTime) throw timeError;
          requestedTime = normalizeTimeTo24Hour(embeddedTime);
        }
        const scheduleResult = await this.pool.query(
          `SELECT id FROM public.dose_schedules
           WHERE patient_id = $1 AND medication_id = $2
             AND scheduled_time = $3::time AND is_active = true
           ORDER BY created_at DESC
           LIMIT 1`,
          [patientId, medicationId, requestedTime]
        );
        const schedule = scheduleResult.rows[0];
        if (!schedule) {
          throw new Error('No active dose schedule matches this medication, patient, and time.');
        }

        await this.pool.query(
          `INSERT INTO public.dose_occurrences
             (schedule_id, medication_id, patient_id, scheduled_date, scheduled_timestamp, status, recorded_at, notes)
           VALUES
             ($1, $2, $3, $4::date, ($4::date + $5::time), $6, NOW(), $7)
           ON CONFLICT (schedule_id, scheduled_date) DO UPDATE SET
             scheduled_timestamp = EXCLUDED.scheduled_timestamp,
             status = EXCLUDED.status,
             recorded_at = NOW(),
             notes = EXCLUDED.notes`,
          [schedule.id, medicationId, patientId, targetDateKey, requestedTime, status.toUpperCase(), `Recorded via ${status}`]
        );
      } catch (err) {
        console.error('[Database] PostgreSQL recordDoseLog error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    const idx = this.memory.doseLogs.findIndex(l => 
      l.patientId === patientId && 
      l.medicationId === medicationId && 
      l.timeSlot === timeSlot && 
      l.dateKey === newLog.dateKey
    );
    if (idx >= 0) {
      this.memory.doseLogs[idx] = newLog;
    } else {
      this.memory.doseLogs.unshift(newLog);
    }
    this.saveDurableStore();
    return newLog;
  }

  // -------------------------------------------------------------
  // DPDP Statutory Consent Operations (PostgreSQL Async + Fallback)
  // -------------------------------------------------------------
  async getConsent(userId) {
    if (!userId) return null;

    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT * FROM public.consents WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1`,
          [userId]
        );
        if (res.rows.length > 0) {
          const c = res.rows[0];
          return {
            id: c.id,
            userId: c.user_id,
            documentVersions: {
              terms: c.terms_version,
              privacy: c.privacy_version,
              aiDisclosure: c.ai_disclosure_version
            },
            consentedAt: c.consented_at,
            ageConfirmed: c.age_confirmed,
            explicitConsentGiven: c.explicit_consent_given,
            aiProcessingConsent: c.ai_processing_consent,
            status: c.status
          };
        }
        return null;
      } catch (err) {
        console.error('[Database] PostgreSQL getConsent error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    return this.memory.consents.find(c => c.userId === userId && c.status === 'ACTIVE') || null;
  }

  async saveConsent(consentData) {
    const versions = consentData.documentVersions || { terms: '2026.1', privacy: '2026.1', aiDisclosure: '2026.1' };
    const id = `cst-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    if (this.isPostgres && this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE public.consents SET status = 'SUPERSEDED' WHERE user_id = $1 AND status = 'ACTIVE'`,
          [consentData.userId]
        );
        const res = await client.query(
          `INSERT INTO public.consents (
             id, user_id, terms_version, privacy_version, ai_disclosure_version,
             age_confirmed, explicit_consent_given, ai_processing_consent,
             statutory_notice_acknowledged, status, consented_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 'ACTIVE', NOW())
           RETURNING *`,
          [
            id, consentData.userId, versions.terms, versions.privacy, versions.aiDisclosure,
            consentData.ageConfirmed !== undefined ? Boolean(consentData.ageConfirmed) : true,
            Boolean(consentData.explicitConsentGiven), Boolean(consentData.aiProcessingConsent)
          ]
        );
        await client.query('COMMIT');
        return {
          id: res.rows[0].id,
          userId: res.rows[0].user_id,
          documentVersions: versions,
          consentedAt: res.rows[0].consented_at,
          status: 'ACTIVE'
        };
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch (rbErr) {}
        console.error('[Database] PostgreSQL saveConsent error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      } finally {
        client.release();
      }
    }

    const record = {
      id,
      userId: consentData.userId,
      documentVersions: versions,
      consentedAt: new Date().toISOString(),
      ageConfirmed: consentData.ageConfirmed !== undefined ? Boolean(consentData.ageConfirmed) : true,
      explicitConsentGiven: Boolean(consentData.explicitConsentGiven),
      aiProcessingConsent: Boolean(consentData.aiProcessingConsent),
      statutoryNoticeAcknowledged: true,
      status: 'ACTIVE'
    };
    this.memory.consents.forEach(c => {
      if (c.userId === consentData.userId && c.status === 'ACTIVE') {
        c.status = 'SUPERSEDED';
      }
    });
    this.memory.consents.unshift(record);
    this.saveDurableStore();
    return record;
  }

  async revokeConsent(userId, reason = 'User requested revocation') {
    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `UPDATE public.consents 
           SET status = 'REVOKED', revoked_at = NOW(), revocation_reason = $1
           WHERE user_id = $2 AND status = 'ACTIVE'`,
          [reason, userId]
        );
        return res.rowCount > 0;
      } catch (err) {
        console.error('[Database] PostgreSQL revokeConsent error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    let count = 0;
    this.memory.consents.forEach(c => {
      if (c.userId === userId && c.status === 'ACTIVE') {
        c.status = 'REVOKED';
        c.revokedAt = new Date().toISOString();
        c.revocationReason = reason;
        count++;
      }
    });
    this.saveDurableStore();
    return count > 0;
  }

  // -------------------------------------------------------------
  // Audit Logs
  // -------------------------------------------------------------
  async logAudit(action, actorId, details, entityName = null, entityId = null) {
    // Automatically infer entity_name if not explicitly passed
    let resolvedEntity = entityName;
    if (!resolvedEntity) {
      if (action.includes('USER') || action.includes('LOGIN') || action.includes('REGISTRATION') || action.includes('AUTH')) {
        resolvedEntity = 'USER';
      } else if (action.includes('MEDICATION')) {
        resolvedEntity = 'MEDICATION';
      } else if (action.includes('SCHEDULE')) {
        resolvedEntity = 'SCHEDULE';
      } else if (action.includes('PRESCRIPTION')) {
        resolvedEntity = 'PRESCRIPTION';
      } else if (action.includes('CONSENT')) {
        resolvedEntity = 'CONSENT';
      } else {
        resolvedEntity = 'SYSTEM';
      }
    }

    const entry = {
      id: `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      action,
      actorId: actorId || 'system',
      entityName: resolvedEntity,
      entityId: entityId || null,
      details,
      timestamp: new Date().toISOString()
    };

    if (this.isPostgres && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO public.audit_logs (id, action_type, entity_name, entity_id, user_id, details, created_at)
           VALUES (
             $1, $2, $3, $4,
             (SELECT user_id FROM public.profiles WHERE user_id = $5 OR LOWER(email) = LOWER($5) LIMIT 1),
             $6, NOW()
           )`,
          [entry.id, action, resolvedEntity, entityId, actorId || 'system', JSON.stringify(details || {})]
        );
      } catch (err) {
        // Non-blocking error for audit logs
        console.warn('[Database] Audit log async write error:', err.message);
      }
    }

    this.memory.auditLogs.unshift(entry);
    if (this.memory.auditLogs.length > 500) {
      this.memory.auditLogs = this.memory.auditLogs.slice(0, 500);
    }
    this.saveDurableStore();
  }

  getAuditLogs(limit = 50) {
    return this.memory.auditLogs.slice(0, limit);
  }

  // -------------------------------------------------------------
  // Food & Nutrition Operations (PostgreSQL Async + Fallback)
  // -------------------------------------------------------------
  async getFoodLogs(patientId, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    if (this.isPostgres && this.pool) {
      try {
        const query = `
          SELECT * FROM public.food_logs 
          WHERE patient_id = $1 AND log_date = $2 
          ORDER BY created_at DESC
        `;
        const res = await this.pool.query(query, [patientId, targetDate]);
        return res.rows.map(r => ({
          id: r.id,
          patient_id: r.patient_id,
          food_name: r.food_name,
          quantity: Number(r.quantity),
          unit: r.unit,
          meal_type: r.meal_type,
          log_date: r.log_date instanceof Date ? r.log_date.toISOString().split('T')[0] : r.log_date,
          log_time: r.log_time,
          calories: Number(r.calories),
          protein_g: Number(r.protein_g),
          carbs_g: Number(r.carbs_g),
          fat_g: Number(r.fat_g),
          fibre_g: Number(r.fibre_g),
          is_estimated: Boolean(r.is_estimated),
          source: r.source,
          notes: r.notes,
          created_at: r.created_at
        }));
      } catch (err) {
        console.error('[Database] PostgreSQL getFoodLogs error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    if (!Array.isArray(this.memory.foodLogs)) this.memory.foodLogs = [];
    return this.memory.foodLogs.filter(
      l => (l.patient_id === patientId || l.patientId === patientId) && 
           (l.log_date === targetDate || l.date === targetDate)
    );
  }

  async saveFoodLog(logData) {
    const id = logData.id || `food-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const patientId = logData.patient_id || logData.patientId;
    if (!patientId) throw new Error('Patient ID is required to save a food log.');
    const foodName = logData.food_name || logData.name || 'Food Item';
    const quantity = Number(logData.quantity) || 1;
    const unit = logData.unit || 'serving';
    const mealType = logData.meal_type || logData.mealType || 'snack';
    const logDate = logData.log_date || logData.date || new Date().toISOString().split('T')[0];
    const logTime = logData.log_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const calories = Math.round(Number(logData.calories) || 0);
    const proteinG = Math.round((Number(logData.protein_g ?? logData.protein) || 0) * 10) / 10;
    const carbsG = Math.round((Number(logData.carbs_g ?? logData.carbs) || 0) * 10) / 10;
    const fatG = Math.round((Number(logData.fat_g ?? logData.fat) || 0) * 10) / 10;
    const fibreG = Math.round((Number(logData.fibre_g ?? logData.fibre) || 0) * 10) / 10;
    const isEstimated = Boolean(logData.is_estimated ?? logData.isEstimated);
    const source = logData.source || 'local';
    const notes = logData.notes || null;

    if (this.isPostgres && this.pool) {
      try {
        const query = `
          INSERT INTO public.food_logs (
            id, patient_id, food_name, quantity, unit, meal_type,
            log_date, log_time, calories, protein_g, carbs_g, fat_g,
            fibre_g, is_estimated, source, notes, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            food_name = EXCLUDED.food_name,
            quantity = EXCLUDED.quantity,
            unit = EXCLUDED.unit,
            meal_type = EXCLUDED.meal_type,
            calories = EXCLUDED.calories,
            protein_g = EXCLUDED.protein_g,
            carbs_g = EXCLUDED.carbs_g,
            fat_g = EXCLUDED.fat_g,
            fibre_g = EXCLUDED.fibre_g,
            is_estimated = EXCLUDED.is_estimated,
            updated_at = NOW()
          WHERE food_logs.patient_id = EXCLUDED.patient_id
          RETURNING *
        `;
        const res = await this.pool.query(query, [
          id, patientId, foodName, quantity, unit, mealType,
          logDate, logTime, calories, proteinG, carbsG, fatG,
          fibreG, isEstimated, source, notes
        ]);
        const r = res.rows[0];
        if (!r) throw new Error('Food log ID already belongs to another patient.');
        return {
          id: r.id,
          patient_id: r.patient_id,
          food_name: r.food_name,
          quantity: Number(r.quantity),
          unit: r.unit,
          meal_type: r.meal_type,
          log_date: r.log_date instanceof Date ? r.log_date.toISOString().split('T')[0] : r.log_date,
          log_time: r.log_time,
          calories: Number(r.calories),
          protein_g: Number(r.protein_g),
          carbs_g: Number(r.carbs_g),
          fat_g: Number(r.fat_g),
          fibre_g: Number(r.fibre_g),
          is_estimated: Boolean(r.is_estimated),
          source: r.source,
          notes: r.notes,
          created_at: r.created_at
        };
      } catch (err) {
        console.error('[Database] PostgreSQL saveFoodLog error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    if (!Array.isArray(this.memory.foodLogs)) this.memory.foodLogs = [];
    const record = {
      id,
      patient_id: patientId,
      food_name: foodName,
      quantity,
      unit,
      meal_type: mealType,
      log_date: logDate,
      log_time: logTime,
      calories,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
      fibre_g: fibreG,
      is_estimated: isEstimated,
      source,
      notes,
      created_at: new Date().toISOString()
    };
    const existingIndex = this.memory.foodLogs.findIndex(l => l.id === id);
    if (existingIndex >= 0) {
      if (String(this.memory.foodLogs[existingIndex].patient_id || this.memory.foodLogs[existingIndex].patientId) !== String(patientId)) {
        throw new Error('Food log ID already belongs to another patient.');
      }
      this.memory.foodLogs[existingIndex] = record;
    } else {
      this.memory.foodLogs.unshift(record);
    }
    this.saveDurableStore();
    return record;
  }

  async deleteFoodLog(id, patientId) {
    if (!patientId) throw new Error('Patient ID is required to delete a food log.');
    if (this.isPostgres && this.pool) {
      try {
        const query = `DELETE FROM public.food_logs WHERE id = $1 AND patient_id::text = $2`;
        const res = await this.pool.query(query, [id, String(patientId)]);
        return res.rowCount > 0;
      } catch (err) {
        console.error('[Database] PostgreSQL deleteFoodLog error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    if (!Array.isArray(this.memory.foodLogs)) this.memory.foodLogs = [];
    const before = this.memory.foodLogs.length;
    this.memory.foodLogs = this.memory.foodLogs.filter(
      l => !(l.id === id && String(l.patient_id || l.patientId) === String(patientId))
    );
    this.saveDurableStore();
    return this.memory.foodLogs.length < before;
  }

  async getNutritionTargets(patientId) {
    const fallback = {
      calories: 2000,
      protein: 60,
      carbs: 250,
      fat: 65,
      fibre: 30
    };

    if (this.isPostgres && this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT * FROM public.nutrition_targets WHERE patient_id = $1`,
          [patientId]
        );
        if (res.rows.length > 0) {
          const r = res.rows[0];
          return {
            calories: Number(r.calories_target) || fallback.calories,
            protein: Number(r.protein_target_g) || fallback.protein,
            carbs: Number(r.carbs_target_g) || fallback.carbs,
            fat: Number(r.fat_target_g) || fallback.fat,
            fibre: Number(r.fibre_target_g) || fallback.fibre
          };
        }
      } catch (err) {
        console.error('[Database] PostgreSQL getNutritionTargets error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    if (!this.memory.nutritionTargets) this.memory.nutritionTargets = {};
    return this.memory.nutritionTargets[patientId] || fallback;
  }

  async saveNutritionTargets(patientId, targets) {
    const safeTargets = {
      calories: Math.max(500, Math.min(10000, Number(targets.calories) || 2000)),
      protein: Math.max(10, Math.min(500, Number(targets.protein) || 60)),
      carbs: Math.max(10, Math.min(1000, Number(targets.carbs) || 250)),
      fat: Math.max(5, Math.min(500, Number(targets.fat) || 65)),
      fibre: Math.max(0, Math.min(200, Number(targets.fibre) || 30))
    };

    if (this.isPostgres && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO public.nutrition_targets (
            patient_id, calories_target, protein_target_g, carbs_target_g, fat_target_g, fibre_target_g, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (patient_id) DO UPDATE SET
            calories_target = EXCLUDED.calories_target,
            protein_target_g = EXCLUDED.protein_target_g,
            carbs_target_g = EXCLUDED.carbs_target_g,
            fat_target_g = EXCLUDED.fat_target_g,
            fibre_target_g = EXCLUDED.fibre_target_g,
            updated_at = NOW()`,
          [patientId, safeTargets.calories, safeTargets.protein, safeTargets.carbs, safeTargets.fat, safeTargets.fibre]
        );
      } catch (err) {
        console.error('[Database] PostgreSQL saveNutritionTargets error:', err.message);
        if (process.env.NODE_ENV === 'production') throw err;
      }
    }

    if (!this.memory.nutritionTargets) this.memory.nutritionTargets = {};
    this.memory.nutritionTargets[patientId] = safeTargets;
    this.saveDurableStore();
    return safeTargets;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('[Database] PostgreSQL connection pool closed gracefully');
    }
  }
}

export const db = new DatabaseManager();
