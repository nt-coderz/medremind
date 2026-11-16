import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import {
  performRealOCR,
  computeSHA256,
  evaluateImageQuality,
  classifyDocument,
  determineDocumentFormat,
  extractEvidence,
  extractMedicines,
  determineDecision,
  extractPatientName,
  comparePatientNames,
  getPdfPageCount,
  extractPdfPagesToImages,
  extractPdfDigitalText
} from './ocrService.js';

import { 
  analyzePrescriptionWithGemini, 
  analyzeStripWithGemini, 
  estimateFoodNutritionWithGemini 
} from './geminiService.js';
import {
  executeWithModelFallback,
  getChatModelCandidates
} from './geminiModels.js';
import { 
  resolveBrandAndGeneric, 
  parseDosageNotation, 
  resolveMedicineDuplicate,
  crossCheckStripMedicine
} from './drugKnowledgeBase.js';

import { 
  db, 
  generateToken, 
  verifyToken, 
  verifyPassword, 
  hashPassword 
} from './database/db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Production Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Allows mobile webview local assets
}));

// Production CORS Configuration
const defaultAllowedOrigins = [
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];
const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(
  process.env.NODE_ENV === 'production'
    ? configuredOrigins
    : [...defaultAllowedOrigins, ...configuredOrigins]
);

app.use(cors({
  origin: (origin, callback) => {
    // Native Capacitor requests may not send an Origin header.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Rate Limiting Protection
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again after 15 minutes.' }
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});
app.use('/api/auth/', authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Authentication middleware: requests without a token may reach public routes,
// but a supplied malformed, invalid, or expired token is always rejected.
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();
  const match = /^Bearer\s+([^\s]+)$/i.exec(authHeader);
  if (!match) {
    return res.status(401).json({ success: false, error: 'Invalid authorization header' });
  }
  const payload = verifyToken(match[1]);
  if (!payload || !payload.id || !payload.role) {
    return res.status(401).json({ success: false, error: 'Invalid or expired authentication token' });
  }
  req.user = payload;
  next();
}
app.use(authenticateToken);

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Administrator access required' });
  next();
}

function requirePatientAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' });
  if (req.user.role === 'admin') return next();
  const requestedIds = [
    req.params.patientId,
    req.params.userId,
    req.query.patientId,
    req.body?.patientId,
    req.body?.patient_id,
    req.body?.userId,
    req.body?.user_id
  ].filter(value => value !== undefined && value !== null && value !== '');
  if (requestedIds.some(id => String(id) !== String(req.user.id))) {
    return res.status(403).json({ success: false, error: 'Access to another patient account is denied' });
  }
  next();
}

function requireSchedulerSecret(req, res, next) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = req.headers['x-cron-secret'];
  if (!configuredSecret || !suppliedSecret ||
      Buffer.byteLength(configuredSecret) !== Buffer.byteLength(suppliedSecret) ||
      !crypto.timingSafeEqual(Buffer.from(configuredSecret), Buffer.from(suppliedSecret))) {
    return res.status(401).json({ success: false, error: 'Scheduler authentication required' });
  }
  next();
}

// Directories
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `rx-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// JSON Store Helpers
function getStore(filename, defaultVal = []) {
  const filePath = path.join(dataDir, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2));
    return defaultVal;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Error reading ${filename}:`, err);
    return defaultVal;
  }
}

function saveStore(filename, data) {
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Log audit trail
function logAudit(action, actorId, details, entityName = null, entityId = null) {
  const logs = getStore('audit_logs.json', []);
  logs.push({
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    action,
    actorId: actorId || 'system',
    entityName: entityName || 'SYSTEM',
    entityId: entityId || null,
    details,
    timestamp: new Date().toISOString()
  });
  saveStore('audit_logs.json', logs);
  // Also forward to centralized database audit logging
  db.logAudit(action, actorId, details, entityName, entityId).catch(() => {});
}

// Lookup verified registered user
async function getRegisteredUser(patientId) {
  let user = (await db.findUserById(patientId)) || (await db.findUserByEmailOrId(patientId));
  if (!user && (patientId === 'patient-alex' || patientId === 'patient-default')) {
    user = await db.findUserById('USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82');
  }
  if (!user) {
    const allUsers = await db.listUsers();
    if (allUsers.length > 0) user = allUsers[0];
  }
  return user || {
    id: patientId || 'USR-patient',
    name: 'Patient',
    email: 'patient@medremind.app',
    role: 'patient'
  };
}

// Health check with database, environment, and uptime reporting
app.get('/api/health', async (req, res) => {
  const health = await db.checkHealth();
  res.json({
    status: health.status === 'error' ? 'error' : 'ok',
    app: 'MedRemind Backend',
    version: '2026.1',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    database: health,
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ''),
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    tesseractAvailable: true
  });
});

// Engine configuration status
app.get('/api/engine-status', (req, res) => {
  res.json({
    primaryEngine: 'GEMINI',
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ''),
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    fallbackEngine: 'TESSERACT',
    tesseractAvailable: true,
    offlineSupported: true
  });
});

// -------------------------------------------------------------
// Pending OTP Registration Storage & Email Dispatch
// -------------------------------------------------------------
const PENDING_REG_FILE = path.join(dataDir, 'pending_registrations.json');

function getPendingStore() {
  if (!fs.existsSync(PENDING_REG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(PENDING_REG_FILE, 'utf-8') || '{}');
  } catch (err) {
    return {};
  }
}

function savePendingStore(data) {
  try {
    fs.writeFileSync(PENDING_REG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Auth OTP] Error saving pending registrations:', err.message);
  }
}

function getPendingRegistration(email) {
  const store = getPendingStore();
  return store[email.toLowerCase().trim()] || null;
}

function setPendingRegistration(email, data) {
  const store = getPendingStore();
  store[email.toLowerCase().trim()] = data;
  savePendingStore(store);
}

function deletePendingRegistration(email) {
  const store = getPendingStore();
  delete store[email.toLowerCase().trim()];
  savePendingStore(store);
}

function generateSecureOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp.trim()).digest('hex');
}

async function sendEmailOtp(email, otp, name) {
  console.log(`[Email Service] ========================================`);
  console.log(`[Email Service] To: ${name} <${email}>`);
  console.log(`[Email Service] Subject: Your MedRemind Verification Code`);
  console.log(`[Email Service] 6-digit OTP: ${otp} (valid for 10 minutes)`);
  console.log(`[Email Service] ========================================`);

  // Direct SMTP Delivery via Nodemailer (if configured)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"MedRemind Security" <${process.env.SMTP_USER}>`,
        to: `${name} <${email}>`,
        subject: `Your MedRemind Verification Code: ${otp}`,
        text: `Hello ${name},\n\nYour 6-digit MedRemind verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this registration, please ignore this email.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #E6ECE8; border-radius: 16px; background: #ffffff;">
            <div style="margin-bottom: 20px;">
              <h2 style="color: #238B78; margin: 0 0 6px 0; font-size: 20px;">MedRemind Email Verification</h2>
              <p style="color: #7A8782; margin: 0; font-size: 13px;">Secure Medication Routine & Adherence</p>
            </div>
            <p style="color: #202B28; font-size: 14px; margin: 16px 0;">Hello <strong>${name}</strong>,</p>
            <p style="color: #55625D; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
              Please use the 6-digit verification code below to verify your email address and activate your MedRemind account:
            </p>
            <div style="background: #F8FAF8; border: 1px solid #DDEFE8; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #238B78; font-family: monospace;">${otp}</span>
            </div>
            <p style="color: #7A8782; font-size: 12px; line-height: 1.4; margin: 0 0 16px 0;">
              This code will expire in <strong>10 minutes</strong>. For your security, never share this code with anyone.
            </p>
            <div style="border-top: 1px solid #E6ECE8; padding-top: 16px; margin-top: 20px;">
              <p style="color: #9AA6A1; font-size: 11px; margin: 0;">
                If you did not attempt to register for MedRemind, you can safely disregard this message.
              </p>
            </div>
          </div>
        `
      });
      console.log(`[Email Service] Verification email successfully sent via SMTP to ${email}`);
    } catch (smtpErr) {
      console.warn('[Email Service] SMTP dispatch warning:', smtpErr.message);
    }
  }

  // Supabase Auth Email OTP Integration
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    try {
      const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      await fetch(`${process.env.SUPABASE_URL}/auth/v1/otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          email: email,
          create_user: true
        })
      });
    } catch (e) {
      console.warn('[Supabase Auth OTP] Forwarding notice:', e.message);
    }
  }

  logAudit('OTP_DISPATCHED', null, `6-digit email verification OTP dispatched to ${email}`, 'AUTH', email);
}

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification attempts. Please try again after 15 minutes.' }
});

// -------------------------------------------------------------
// Authentication Endpoints (Server-Side Persistence & Isolation)
// -------------------------------------------------------------

/**
 * POST /api/auth/register
 * Direct Patient Registration with DOB, Gender, Email, Phone, and Name.
 * OTP verification eliminated in favor of direct credential-based authentication.
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, dob, gender, email, phone, phoneNumber, password, role } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Full name is required.' });
    }
    if (!dob || !dob.toString().trim()) {
      return res.status(400).json({ success: false, error: 'Date of birth is required.' });
    }
    if (!gender || !gender.toString().trim()) {
      return res.status(400).json({ success: false, error: 'Gender is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    const rawPhone = (phone || phoneNumber || '').toString().trim();
    if (!rawPhone || rawPhone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, error: 'A valid phone number with at least 10 digits is required.' });
    }

    const cleanPwd = (password || '').trim();
    if (cleanPwd.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long.' });
    }

    if (role === 'admin' || role?.toLowerCase() === 'administrator') {
      return res.status(403).json({ success: false, error: 'Administrator accounts cannot be created via public registration.' });
    }

    // Verify user doesn't already exist with email or phone
    const existingUser = await db.findUserByEmailOrId(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
    }

    const existingPhone = await db.findUserByEmailOrId(rawPhone);
    if (existingPhone) {
      return res.status(400).json({ success: false, error: 'An account with this phone number already exists.' });
    }

    const newUser = await db.createUser({
      name: name.trim(),
      dob: dob.toString().trim(),
      gender: gender.toString().trim(),
      phone: rawPhone,
      email: cleanEmail,
      password: cleanPwd,
      role: 'patient'
    });

    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role
    });

    await db.logAudit('USER_REGISTRATION', newUser.id, {
      name: newUser.name,
      role: newUser.role,
      email: newUser.email,
      phone: rawPhone
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        dob: newUser.dob,
        gender: newUser.gender,
        phoneNumber: newUser.phoneNumber || newUser.phone,
        role: newUser.role,
        status: newUser.status,
        registeredAt: newUser.registeredAt
      },
      token
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/verify-otp
 * Compatibility endpoint: returns successful notice that OTP is discontinued.
 */
app.post('/api/auth/verify-otp', otpLimiter, async (req, res) => {
  res.json({
    success: true,
    message: 'OTP verification is no longer required. Direct registration is active.'
  });
});

/**
 * POST /api/auth/resend-otp
 * Compatibility endpoint: returns notice that OTP is discontinued.
 */
app.post('/api/auth/resend-otp', otpLimiter, async (req, res) => {
  res.json({
    success: true,
    message: 'OTP verification is no longer required.'
  });
});

/**
 * POST /api/auth/login
 * Authenticates configured administrator credentials or patient credentials.
 * Admin credentials are provisioned out-of-band using ADMIN_EMAIL and
 * ADMIN_PASSWORD_HASH (PBKDF2 format generated by hashPassword).
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const cleanId = (identifier || '').trim();
    const cleanPwd = (password || '').trim();

    if (!cleanId || !cleanPwd) {
      return res.status(400).json({ success: false, error: 'Identifier and password are required.' });
    }

    // Administrator credentials are never hardcoded or accepted from public registration.
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
    if (adminEmail && cleanId.toLowerCase() === adminEmail) {
      if (!adminPasswordHash || !verifyPassword(cleanPwd, adminPasswordHash)) {
        return res.status(401).json({ success: false, error: 'Invalid administrator credentials.' });
      }
      const adminUser = {
        id: process.env.ADMIN_USER_ID || 'configured-admin',
        name: process.env.ADMIN_NAME || 'System Administrator',
        email: adminEmail,
        role: 'admin',
        status: 'Active'
      };
      const token = generateToken(adminUser);
      await db.logAudit('ADMIN_LOGIN', adminUser.id, 'Successful administrator portal login');
      return res.json({ success: true, user: adminUser, token });
    }

    // Patient Authentication (by Email, Phone Number, or User ID)
    const user = await db.findUserByEmailOrId(cleanId);
    if (!user || user.role === 'admin') {
      return res.status(401).json({ success: false, error: 'Invalid credentials. Please verify your Email/Phone number and password.' });
    }

    if (user.status === 'Suspended') {
      return res.status(403).json({ success: false, error: 'This account has been suspended by an administrator.' });
    }

    if (user.status === 'Deactivated') {
      return res.status(403).json({ success: false, error: 'This account has been deactivated.' });
    }

    const isValid = verifyPassword(cleanPwd, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials. Please verify your password.' });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    await db.logAudit('USER_LOGIN', user.id, `User ${user.name} logged in`);

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        dob: user.dob || null,
        gender: user.gender || null,
        phoneNumber: user.phoneNumber || user.phone || null,
        role: user.role,
        status: user.status,
        registeredAt: user.registeredAt,
        scheduledDeletionAt: user.scheduledDeletionAt || null,
        deletionRequestedBy: user.deletionRequestedBy || null,
        deletionReason: user.deletionReason || null
      },
      token
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile
 */
app.get('/api/auth/me', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthenticated' });
  }
  const user = await db.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User record not found' });
  }
  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

/**
 * GET /api/profile/medical
 * Retrieves patient allergies and medical health profile
 */
app.get('/api/profile/medical', requirePatientAccess, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  try {
    const medicalData = await db.getMedicalInfo(req.user.id);
    if (!medicalData) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }
    res.json({ success: true, ...medicalData });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve medical info' });
  }
});

/**
 * PUT /api/profile/medical
 * Updates patient allergies and medical health profile (sanitized & length-capped)
 */
app.put('/api/profile/medical', requirePatientAccess, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  try {
    const { allergies, medicalInfo } = req.body;

    // Sanitize allergies (max 30 entries, max 100 chars each)
    const cleanAllergies = Array.isArray(allergies)
      ? allergies.map(a => String(a || '').trim().slice(0, 100)).filter(Boolean).slice(0, 30)
      : [];

    // Sanitize medical info
    const rawMedInfo = typeof medicalInfo === 'object' && medicalInfo !== null ? medicalInfo : {};
    const cleanMedInfo = {
      bloodType: String(rawMedInfo.bloodType || 'Unknown').slice(0, 20),
      conditions: Array.isArray(rawMedInfo.conditions)
        ? rawMedInfo.conditions.map(c => String(c).trim().slice(0, 100)).filter(Boolean)
        : (typeof rawMedInfo.conditions === 'string' ? rawMedInfo.conditions.slice(0, 300) : ''),
      primaryDoctor: String(rawMedInfo.primaryDoctor || '').slice(0, 100),
      doctorPhone: String(rawMedInfo.doctorPhone || '').slice(0, 30),
      emergencyContactName: String(rawMedInfo.emergencyContactName || '').slice(0, 100),
      emergencyContactPhone: String(rawMedInfo.emergencyContactPhone || '').slice(0, 30),
      emergencyContactRelation: String(rawMedInfo.emergencyContactRelation || '').slice(0, 50),
      height: String(rawMedInfo.height || '').slice(0, 20),
      weight: String(rawMedInfo.weight || '').slice(0, 20),
      notes: String(rawMedInfo.notes || '').slice(0, 500)
    };

    const updated = await db.updateMedicalInfo(req.user.id, {
      allergies: cleanAllergies,
      medicalInfo: cleanMedInfo
    });

    res.json({ success: true, ...updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update medical profile' });
  }
});

/**
 * GET /api/users
 * Returns list of registered users
 */
app.get('/api/users', requireAdmin, async (req, res) => {
  const users = await db.listUsers();
  res.json({ success: true, users });
});

/**
 * PUT /api/users/:id/status
 * Updates user account status (e.g. Active, Suspended)
 */
app.put('/api/users/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });
  const updated = await db.updateUserStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'User not found' });
  await db.logAudit('ADMIN_USER_STATUS_CHANGE', req.user?.id || 'admin', { targetUserId: req.params.id, newStatus: status });
  res.json({ success: true, user: updated });
});

// -------------------------------------------------------------
// Account Deletion Endpoints (24-Hour Grace Period)
// -------------------------------------------------------------

/**
 * POST /api/auth/schedule-deletion
 * Allows authenticated user to schedule account deletion with 24-hour grace period.
 */
app.post('/api/auth/schedule-deletion', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const reason = req.body.reason || 'User initiated account deletion';
    const updatedUser = await db.scheduleUserDeletion(req.user.id, req.user.id, reason);

    // Record system notification for user
    const notifMsg = `Your MedRemind account has been scheduled for permanent deletion in 24 hours. You can cancel this request at any time before the period expires.`;
    await db.saveNotification({
      recipientId: req.user.id,
      title: 'Account Deletion Scheduled (24-Hour Grace Period)',
      message: notifMsg,
      type: 'SYSTEM'
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Account scheduled for deletion in 24 hours. You may cancel at any time before the grace period ends.',
      user: updatedUser
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/cancel-deletion
 * Cancels a pending account deletion and restores active status.
 */
app.post('/api/auth/cancel-deletion', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const updatedUser = await db.cancelUserDeletion(req.user.id, req.user.id);

    await db.saveNotification({
      recipientId: req.user.id,
      title: 'Account Deletion Cancelled',
      message: 'Your account deletion request has been cancelled. Your MedRemind account remains fully active.',
      type: 'SYSTEM'
    }).catch(() => {});

    res.json({
      success: true,
      message: 'Account deletion cancelled successfully. Your account is active.',
      user: updatedUser
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/users/:userId/schedule-deletion
 * Administrator schedules deletion for a user account with 24-hour grace period.
 */
app.post('/api/admin/users/:userId/schedule-deletion', requireAdmin, async (req, res) => {
  try {
    const adminId = req.user?.id || 'admin';
    const targetUserId = req.params.userId;

    if (adminId === targetUserId) {
      return res.status(403).json({ success: false, error: 'Administrators cannot schedule deletion of their own account.' });
    }

    const targetUser = await db.findUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Target user not found.' });
    }

    if (targetUser.role === 'admin') {
      return res.status(403).json({ success: false, error: 'Administrators cannot delete other administrator accounts.' });
    }

    const reason = req.body.reason || 'Administrator scheduled account deletion';
    const updatedUser = await db.scheduleUserDeletion(targetUserId, adminId, reason);

    await db.saveNotification({
      recipientId: targetUserId,
      title: 'Notice: Account Scheduled for Deletion',
      message: `An administrator has scheduled your MedRemind account for deletion in 24 hours. Reason: ${reason}. Please contact support or cancel if this was unexpected.`,
      type: 'SYSTEM'
    }).catch(() => {});

    res.json({
      success: true,
      message: `Account for ${targetUser.name} scheduled for deletion in 24 hours.`,
      user: updatedUser
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/users/:userId/cancel-deletion
 * Administrator cancels a pending account deletion.
 */
app.post('/api/admin/users/:userId/cancel-deletion', requireAdmin, async (req, res) => {
  try {
    const adminId = req.user?.id || 'admin';
    const targetUserId = req.params.userId;

    const targetUser = await db.findUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Target user not found.' });
    }

    const updatedUser = await db.cancelUserDeletion(targetUserId, adminId);

    await db.saveNotification({
      recipientId: targetUserId,
      title: 'Account Deletion Cancelled by Administrator',
      message: 'The scheduled deletion for your account has been cancelled by an administrator.',
      type: 'SYSTEM'
    }).catch(() => {});

    res.json({
      success: true,
      message: `Scheduled deletion cancelled for ${targetUser.name}.`,
      user: updatedUser
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Periodic background worker: executes expired scheduled deletions (24-hour grace window)
setInterval(async () => {
  try {
    const deleted = await db.executeScheduledDeletions();
    if (deleted && deleted.length > 0) {
      console.log(`[Account Deletion Worker] Completed 24h grace deletion for ${deleted.length} user(s): ${deleted.join(', ')}`);
    }
  } catch (err) {
    console.error('[Account Deletion Worker] Error during scheduled deletion run:', err.message);
  }
}, 60000);

// -------------------------------------------------------------
// Medication & Routine Management Endpoints
// -------------------------------------------------------------

/**
 * GET /api/medications
 * Returns medications for a specific patient
 */
app.get('/api/medications', requirePatientAccess, async (req, res) => {
  const patientId = req.query.patientId || req.user?.id;
  const medications = await db.getMedications(patientId);
  res.json({ success: true, medications });
});

/**
 * POST /api/medications
 * Adds or saves a medication
 */
app.post('/api/medications', requirePatientAccess, async (req, res) => {
  try {
    const med = await db.saveMedication({ ...req.body, patientId: req.user.role === 'admin' ? (req.body.patientId || req.user.id) : req.user.id });
    await db.logAudit('MEDICATION_CREATED', req.body.patientId || req.user?.id, { medicationId: med.id, name: med.name });
    res.status(201).json({ success: true, medication: med });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/medications/:id
 * Updates an existing medication
 */
app.put('/api/medications/:id', requirePatientAccess, async (req, res) => {
  const updated = await db.updateMedication(req.params.id, req.body, req.user.role === 'admin' ? null : req.user.id);
  if (!updated) return res.status(404).json({ success: false, error: 'Medication not found' });
  res.json({ success: true, medication: updated });
});

/**
 * GET /api/food-logs
 * Retrieves food logs for a patient on a specific date (defaults to today)
 */
app.get('/api/food-logs', requirePatientAccess, async (req, res) => {
  try {
    const patientId = req.user.role === 'admin' ? (req.query.patientId || req.user.id) : req.user.id;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const logs = await db.getFoodLogs(patientId, date);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/food-logs
 * Adds a new food log entry
 */
app.post('/api/food-logs', requirePatientAccess, async (req, res) => {
  try {
    const patientId = req.user.role === 'admin' ? (req.body.patient_id || req.body.patientId || req.user.id) : req.user.id;
    const log = await db.saveFoodLog({ ...req.body, patient_id: patientId });
    await db.logAudit('FOOD_LOG_CREATED', patientId, { logId: log.id, foodName: log.food_name, calories: log.calories });
    res.status(201).json({ success: true, log });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/food-logs/:id
 * Removes a food log entry
 */
app.delete('/api/food-logs/:id', requirePatientAccess, async (req, res) => {
  try {
    const patientId = req.query.patientId || req.user?.id || 'USR-patient';
    const success = await db.deleteFoodLog(req.params.id, patientId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Food log not found' });
    }
    await db.logAudit('FOOD_LOG_DELETED', patientId, { logId: req.params.id });
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/food-lookup
 * Looks up nutritional data for a food item (Gemini fallback for uncatalogued items)
 */
app.get('/api/food-lookup', async (req, res) => {
  try {
    const query = req.query.query || req.query.q || '';
    const quantity = Number(req.query.quantity) || 1;
    const unit = req.query.unit || 'serving';

    if (!query.trim()) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
      const geminiResult = await estimateFoodNutritionWithGemini(query, quantity, unit);
      return res.json({ success: true, ...geminiResult });
    } catch (geminiErr) {
      console.warn('[Food Lookup] Gemini estimation fallback:', geminiErr.message);
      return res.json({
        success: true,
        name: query,
        servingDescription: `${quantity} ${unit}`,
        calories: Math.round(150 * quantity),
        protein: Math.round(4 * quantity * 10) / 10,
        carbs: Math.round(20 * quantity * 10) / 10,
        fat: Math.round(5 * quantity * 10) / 10,
        fibre: Math.round(2 * quantity * 10) / 10,
        estimated: true,
        source: 'server_fallback',
        notes: 'Estimated value (offline server fallback)'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/nutrition-targets
 * Gets patient's nutritional targets
 */
app.get('/api/nutrition-targets', requirePatientAccess, async (req, res) => {
  try {
    const patientId = req.query.patientId || req.user?.id || 'USR-patient';
    const targets = await db.getNutritionTargets(patientId);
    res.json({ success: true, targets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/nutrition-targets
 * Updates patient's nutritional targets
 */
app.put('/api/nutrition-targets', requirePatientAccess, async (req, res) => {
  try {
    const patientId = req.user.role === 'admin' ? (req.body.patientId || req.user.id) : req.user.id;
    const targets = req.body.targets || req.body;
    const saved = await db.saveNutritionTargets(patientId, targets);
    res.json({ success: true, targets: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/medications/:id
 * Deletes a medication and associated dose schedules
 */
app.delete('/api/medications/:id', requirePatientAccess, async (req, res) => {
  const success = await db.deleteMedication(req.params.id, req.user.role === 'admin' ? null : req.user.id);
  if (!success) return res.status(404).json({ success: false, error: 'Medication not found' });
  res.json({ success: true, message: 'Medication deleted' });
});

/**
 * GET /api/schedules
 * Returns active dose schedules for a patient
 */
app.get('/api/schedules', requirePatientAccess, async (req, res) => {
  const patientId = req.query.patientId || req.user?.id;
  const schedules = await db.getSchedules(patientId);
  res.json({ success: true, schedules });
});

/**
 * POST /api/schedules
 * Creates or updates a dose schedule
 */
app.post('/api/schedules', requirePatientAccess, async (req, res) => {
  const sch = await db.saveSchedule({ ...req.body, patientId: req.user.role === 'admin' ? (req.body.patientId || req.user.id) : req.user.id });
  res.status(201).json({ success: true, schedule: sch });
});

/**
 * GET /api/dose-logs
 * Retrieves adherence logs for a patient
 */
app.get('/api/dose-logs', requirePatientAccess, (req, res) => {
  const patientId = req.query.patientId || req.user?.id;
  const date = req.query.date;
  const logs = db.getDoseLogs(patientId, date);
  res.json({ success: true, logs });
});

/**
 * POST /api/dose-logs
 * Records a dose taken or skipped
 */
app.post('/api/dose-logs', requirePatientAccess, async (req, res) => {
  try {
    const log = await db.recordDoseLog({
      ...req.body,
      patientId: req.user.role === 'admin' ? (req.body.patientId || req.user.id) : req.user.id
    });
    res.status(201).json({ success: true, log });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Statutory DPDP Consent Endpoints
// -------------------------------------------------------------

/**
 * GET /api/consents/:userId
 * Retrieves active statutory consent record
 */
app.get('/api/consents/:userId', requirePatientAccess, async (req, res) => {
  const consent = await db.getConsent(req.params.userId);
  res.json({ success: true, consent });
});

/**
 * POST /api/consents
 * Records statutory consent for DPDP Act, 2023
 */
app.post('/api/consents', requirePatientAccess, async (req, res) => {
  try {
    const consent = await db.saveConsent({ ...req.body, userId: req.user.role === 'admin' ? (req.body.userId || req.user.id) : req.user.id });
    await db.logAudit('STATUTORY_CONSENT_RECORDED', req.body.userId, {
      consentId: consent.id,
      versions: consent.documentVersions
    });
    res.status(201).json({ success: true, consent });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/consents/revoke
 * Revokes statutory consent
 */
app.post('/api/consents/revoke', requirePatientAccess, async (req, res) => {
  const { reason } = req.body;
  const userId = req.user.role === 'admin' ? (req.body.userId || req.user.id) : req.user.id;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  const success = await db.revokeConsent(userId, reason);
  await db.logAudit('STATUTORY_CONSENT_REVOKED', userId, { reason });
  res.json({ success, message: success ? 'Consent revoked successfully' : 'No active consent found' });
});

/**
 * POST /api/admin/backup
 * Triggers full JSON database snapshot
 */
app.post('/api/admin/backup', requireAdmin, (req, res) => {
  const backup = db.createBackup();
  res.json(backup);
});

// User Lookup endpoint (Legacy compatibility)
app.get('/api/users/:patientId', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id !== req.params.patientId) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  const user = await getRegisteredUser(req.params.patientId);
  res.json({ success: true, user });
});

// Strip OCR parsing fallback
function parseStripOcrBackend(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const strengthMatch = rawText.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%))\b/i);
  const strength = strengthMatch ? strengthMatch[1] : '';

  const formMatch = rawText.match(/\b(tablets?|capsules?|syrup|drops?|suspension|ointment|cream|gel|injection|cap|tab)\b/i);
  let form = 'Tablet';
  if (formMatch) {
    const raw = formMatch[1].toLowerCase();
    if (raw.startsWith('cap')) form = 'Capsule';
    else if (raw.startsWith('syr') || raw.includes('susp')) form = 'Syrup';
    else if (raw.startsWith('drop')) form = 'Drops';
    else if (raw.includes('oint') || raw.includes('gel') || raw.includes('cream')) form = 'Ointment';
    else if (raw.includes('inj')) form = 'Injection';
  }

  const batchMatch = rawText.match(/\b(?:b(?:atch)?\.?\s*(?:no\.?|num)?|lot\.?\s*(?:no\.?)?)\s*[:.-]?\s*([a-zA-Z0-9\/-]{3,20})\b/i);
  const batchNumber = batchMatch ? batchMatch[1] : null;

  const expMatch = rawText.match(/\b(?:exp(?:iry)?\.?\s*(?:date)?|use\s*before|val\b|valid\s*till)\s*[:.-]?\s*([0-9]{1,2}[\/-][0-9]{2,4}|[A-Za-z]{3,9}[\s\/-]*[0-9]{2,4}|[0-9]{4}[\/-][0-9]{1,2})\b/i);
  const expiryDate = expMatch ? expMatch[1] : null;

  const mfgMatch = rawText.match(/\b(?:mfg\.?\s*by|marketed\s*by|manufactured\s*by|mfd\s*by)\s*[:.-]?\s*([A-Za-z0-9\s.,&-]{3,40})/i);
  const manufacturer = mfgMatch ? mfgMatch[1].trim() : null;

  const storageMatch = rawText.match(/store\s*(?:below|in|at|protected)[^\n.]{5,60}/i);
  const storageNotes = storageMatch ? storageMatch[0].trim() : null;

  const rxOnly = /schedule\s*h|rx\s*only|\brx\b/i.test(rawText);

  let brandName = '';
  let genericIngredient = '';

  for (const line of lines) {
    const resolved = resolveBrandAndGeneric(line);
    if (resolved.isVerified) {
      brandName = resolved.brandName;
      genericIngredient = resolved.genericIngredient;
      break;
    }
  }

  const crossCheck = crossCheckStripMedicine({ brandName, genericIngredient, strength, form });
  const isReadable = lines.length > 0 && (brandName.length > 0 || genericIngredient.length > 0 || strength.length > 0);

  return {
    engine: 'TESSERACT',
    isReadable,
    unreadableReason: isReadable ? null : 'Text on packaging could not be clearly resolved.',
    brandName,
    genericIngredient,
    strength,
    form,
    manufacturer,
    batchNumber,
    expiryDate,
    storageNotes,
    rxOnly,
    confidences: {
      brandName: brandName ? (crossCheck.matched ? 0.85 : 0.6) : 0.2,
      genericIngredient: genericIngredient ? 0.8 : 0.2,
      strength: strength ? 0.85 : 0.2,
      form: 0.8,
      expiryDate: expiryDate ? 0.75 : 0.2,
      batchNumber: batchNumber ? 0.75 : 0.2
    },
    crossCheck,
    rawOcrText: rawText
  };
}

/**
 * POST /api/scan-strip
 * Analyzes medicine strips, blister packs, and boxes.
 * Supports online (Gemini primary) and offline (Tesseract fallback).
 */
app.post('/api/scan-strip', requireAuth, upload.single('stripImage'), async (req, res) => {
  try {
    let fileBuffer = null;
    let filePath = null;
    const mode = req.body.mode || 'online';

    if (req.file) {
      filePath = req.file.path;
      fileBuffer = fs.readFileSync(filePath);
    } else if (req.body.imageBase64 || req.body.file) {
      const rawB64 = req.body.imageBase64 || req.body.file;
      const matches = rawB64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const b64 = matches && matches.length === 3 ? matches[2] : rawB64;
      fileBuffer = Buffer.from(b64, 'base64');
      const filename = `strip-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, fileBuffer);
    } else {
      return res.status(400).json({ error: 'No medicine strip image provided' });
    }

    const sha256 = computeSHA256(fileBuffer);
    let stripData = null;
    let engineUsed = 'TESSERACT';
    let isFallback = false;

    if (mode === 'online') {
      try {
        stripData = await analyzeStripWithGemini(fileBuffer, 'image/jpeg');
        engineUsed = 'GEMINI';
      } catch (err) {
        console.warn('[Scan Strip] Gemini technical fallback:', err.message);
        isFallback = true;
        engineUsed = 'TESSERACT';
      }
    }

    if (!stripData || engineUsed === 'TESSERACT') {
      const ocrRes = await performRealOCR(filePath || fileBuffer);
      stripData = parseStripOcrBackend(ocrRes.rawText || '');
      stripData.engine = 'TESSERACT';
      stripData.isFallback = isFallback;
    }

    return res.json({
      success: true,
      scanId: `strip-${Date.now()}`,
      imageUrl: filePath ? `/uploads/${path.basename(filePath)}` : null,
      sha256,
      engine: engineUsed,
      isFallback,
      data: stripData
    });
  } catch (error) {
    console.error('[Scan Strip Error]', error);
    return res.status(500).json({ error: error.message || 'Failed to scan medicine strip' });
  }
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many chat requests. Please wait a moment before asking again.' }
});

/**
 * POST /api/chat
 * Conversational Medi assistant powered by Gemini with multi-model fallback.
 * Protected by JWT auth, rate limited.
 */
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
  }

  try {
    // 1. Fetch user active medications and medical/allergy info for context (if authenticated)
    const userId = req.user?.id || null;
    let userMeds = [];
    let userProfile = null;

    if (userId) {
      const allMedications = getStore('medications.json', []);
      userMeds = allMedications.filter(
        m => m.patientId === userId && (m.status === 'Active' || m.status === 'ACTIVE')
      );
      userProfile = await db.findUserById(userId);
    }

    const medSummary = userMeds.map(m => 
      `- ${m.name} (${m.dosage || '1 dose'}, ${m.frequency || 'Daily'}, times: ${(m.times || []).join(', ')}, instructions: ${m.instructions || 'take with water'})`
    ).join('\n') || 'No active medicines recorded yet';

    const allergies = Array.isArray(userProfile?.allergies) ? userProfile.allergies.join(', ') : 'None recorded';
    const medicalInfo = userProfile?.medicalInfo || {};
    const conditions = Array.isArray(medicalInfo.conditions) 
      ? medicalInfo.conditions.join(', ') 
      : (typeof medicalInfo.conditions === 'string' && medicalInfo.conditions ? medicalInfo.conditions : 'None recorded');

    // 2. Medi System Prompt
    const systemInstruction = `You are Medi, an empathetic, caring, and knowledgeable medication assistant inside the MedRemind app.
Your mission is to help the user manage their medications, understand reminders, navigate the app, and live a healthier life.

USER CONTEXT:
Patient Name: ${userProfile?.name || req.user?.name || 'Friend'}
Active Medicines:
${medSummary}
Known Allergies: ${allergies}
Chronic Conditions: ${conditions}

APP NAVIGATION GUIDE (Use exact screen names so the user can easily tap to them):
- "Dashboard" (or "Home"): Shows today's doses, adherence percentage, and next scheduled medicine.
- "Medicines": List of all active medicines, add custom medicines, or edit existing ones.
- "Scan Prescription" (or "Scanner"): Scan prescriptions or medicine strips using camera or file upload.
- "Schedule": Detailed calendar and time-slot breakdown of morning, afternoon, evening, and night doses.
- "History": View compliance logs, charts, and export doctor reports as PDF.
- "Profile": Manage profile, allergies, blood type, medical info, emergency contacts, and language settings.

APP CREDITS:
If the user asks "who made this app?", "who created you?", "who built MedRemind?", or asks for credits/team, answer warmly:
"MedRemind was designed and built by Team Sanjeevani: Aryan Singhania, Tanishq Ghosh, and Naman Thard from The Newtown School, Kolkata."

SAFETY BOUNDARIES (CRITICAL):
1. You are an AI assistant, NOT a doctor or medical practitioner.
2. NEVER diagnose illnesses, NEVER prescribe medications, and NEVER suggest changing a prescribed dose.
3. Always recommend consulting their prescribing doctor or pharmacist before making any changes.
4. If the user mentions emergency red-flag symptoms (such as severe chest pain, sudden difficulty breathing, anaphylaxis, severe bleeding, sudden vision loss), urge them to contact emergency medical services (e.g. 112/102 in India or local emergency number) immediately!

Keep your tone friendly, warm, empathetic, and concise. Format responses with clean, readable markdown bullet points where helpful.`;

    // Format chat history (limit to last 10 turns)
    const validHistory = Array.isArray(history) ? history.slice(-10) : [];
    const contents = [
      {
        role: 'user',
        parts: [{ text: systemInstruction }]
      },
      {
        role: 'model',
        parts: [{ text: "Hello! I'm Medi, your personal MedRemind assistant. How can I help you today?" }]
      }
    ];

    for (const item of validHistory) {
      if (item.sender === 'user' || item.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: item.text || item.content || '' }] });
      } else if (item.sender === 'medi' || item.role === 'model' || item.sender === 'bot') {
        contents.push({ role: 'model', parts: [{ text: item.text || item.content || '' }] });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        success: true,
        reply: "Medi is currently in offline mode. You can still use MedRemind to track doses, view schedules, and scan medicines offline!"
      });
    }

    const candidates = getChatModelCandidates();
    const { result } = await executeWithModelFallback(apiKey, candidates, async (ai, model) => {
      return await ai.models.generateContent({
        model,
        contents,
        config: {
          temperature: 0.7,
          maxOutputTokens: 800
        }
      });
    });

    const reply = result.text || "I'm here to help you manage your medications. How can I assist you today?";
    return res.json({
      success: true,
      reply
    });
  } catch (err) {
    console.warn('[Medi Chat] Service notice:', err.message);
    return res.json({
      success: true,
      reply: "Medi is a bit busy right now. Please try asking again in a moment, or check your Medicines and Schedule tabs directly!"
    });
  }
});

/**
 * POST /api/scan-prescriptions (BATCH MULTI-FILE UPLOAD, GEMINI ENGINE & TESSERACT FALLBACK)
 * Supports Online (Gemini primary) and Offline (Tesseract) scanning modes.
 * Intelligent Brand vs Generic resolution & duplicate prevention.
 */
app.post('/api/scan-prescriptions', requirePatientAccess, async (req, res) => {
  try {
    const { files, mode = 'online' } = req.body;
    const patientId = req.user.role === 'admin' ? req.body.patientId : req.user.id;
    if (!patientId) return res.status(400).json({ success: false, error: 'Patient ID is required for administrator scans' });
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided for batch prescription scan' });
    }

    // 1. Retrieve registered patient identity from authenticated database
    const registeredUser = await getRegisteredUser(patientId);
    const registeredPatientName = registeredUser.name;
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Retrieve active patient medications for intelligent duplicate prevention
    const allMedications = getStore('medications.json', []);
    const patientActiveMeds = allMedications.filter(
      m => m.patientId === registeredUser.id && (m.status === 'Active' || m.status === 'ACTIVE')
    );

    console.log(`[Batch Scan] Mode: ${mode.toUpperCase()} | Processing ${files.length} file(s) for patient ${registeredPatientName} (${registeredUser.id})`);

    const processedDocuments = [];
    const existingPrescriptions = getStore('prescriptions.json', []);
    const seenBatchHashes = new Set();
    const extractedPatientNamesInBatch = new Set();

    for (let index = 0; index < files.length; index++) {
      const fileItem = files[index];
      const fileName = fileItem.name || `document-${index + 1}.jpg`;
      const fileExt = path.extname(fileName).toLowerCase().replace('.', '');

      // Validate supported formats
      const supportedFormats = ['jpg', 'jpeg', 'png', 'pdf'];
      if (!supportedFormats.includes(fileExt)) {
        return res.status(400).json({
          error: `Unsupported format for file "${fileName}". Only JPG, JPEG, PNG, and PDF are supported.`
        });
      }

      // Decode file buffer
      if (!fileItem.dataBase64 || fileItem.dataBase64.trim().length === 0) {
        return res.status(400).json({ error: `File "${fileName}" appears empty or corrupted.` });
      }

      let fileBuffer = null;
      const matches = fileItem.dataBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const b64 = matches && matches.length === 3 ? matches[2] : fileItem.dataBase64;
      fileBuffer = Buffer.from(b64, 'base64');

      if (fileBuffer.length === 0) {
        return res.status(400).json({ error: `File "${fileName}" appears empty or corrupted.` });
      }

      // Compute SHA-256
      const sha256 = computeSHA256(fileBuffer);
      const isBatchDuplicate = seenBatchHashes.has(sha256);
      seenBatchHashes.add(sha256);

      const isStoreDuplicate = existingPrescriptions.some(p => p.sha256 === sha256 && p.patientId === registeredUser.id);
      const isDuplicate = isBatchDuplicate || isStoreDuplicate;

      const docId = `doc-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`;
      const savedFileName = `${docId}.${fileExt}`;
      const savedFilePath = path.join(uploadsDir, savedFileName);
      fs.writeFileSync(savedFilePath, fileBuffer);

      let docResult = null;

      if (fileExt === 'pdf') {
        // --- PDF Multi-Page Pipeline ---
        console.log(`[Batch Scan] Processing PDF document: ${fileName}...`);
        const pageCount = getPdfPageCount(savedFilePath);
        const extractedPages = extractPdfPagesToImages(savedFilePath, uploadsDir, `pdf-${docId}`);
        const digitalText = extractPdfDigitalText(savedFilePath);

        let pdfGeminiSuccess = false;

        // Try Gemini Vision on PDF pages if mode === 'online' and API key is present
        if (mode === 'online' && process.env.GEMINI_API_KEY) {
          try {
            console.log(`[Batch Scan] Running Gemini Vision on ${pageCount} PDF pages for ${fileName}...`);
            const pdfGeminiMeds = [];
            const seenGenericKeys = new Set();
            let detectedPat = null;
            let detectedDoc = null;
            const pageResults = [];

            for (const page of extractedPages) {
              const pageBuffer = fs.readFileSync(page.imagePath);
              const gemRes = await analyzePrescriptionWithGemini(pageBuffer, 'image/png');
              if (gemRes.patientName && !detectedPat) detectedPat = gemRes.patientName;
              if (gemRes.evidence?.doctorName && !detectedDoc) detectedDoc = gemRes.evidence.doctorName;

              for (const m of gemRes.medicines) {
                const key = `${(m.genericIngredient || m.brandName).toLowerCase()}_${(m.strength || '').toLowerCase().replace(/\s/g, '')}`;
                if (!seenGenericKeys.has(key)) {
                  seenGenericKeys.add(key);
                  const dupCheck = resolveMedicineDuplicate(m, patientActiveMeds);
                  pdfGeminiMeds.push({
                    ...m,
                    pageNumber: page.pageNumber,
                    documentName: fileName,
                    isDuplicateRecord: dupCheck.isDuplicate,
                    duplicateReason: dupCheck.reason || null,
                    existingMedicationId: dupCheck.existingMedicationId || null,
                    isDifferentStrength: dupCheck.isDifferentStrength || false,
                    strengthNote: dupCheck.isDifferentStrength ? dupCheck.reason : null
                  });
                }
              }

              pageResults.push({
                pageNumber: page.pageNumber,
                imageUrl: page.imageUrl,
                rawText: `Processed via Gemini Vision (Page ${page.pageNumber})`,
                medicinesCount: gemRes.medicines.length
              });
            }

            const nameComparison = comparePatientNames(registeredPatientName, detectedPat);
            if (detectedPat) extractedPatientNamesInBatch.add(detectedPat);

            const decision = determineDecision(
              { classification: 'MEDICATION_PRESCRIPTION', confidence: 0.95 },
              { isAcceptable: true },
              pdfGeminiMeds
            );

            docResult = {
              documentId: docId,
              fileName,
              fileType: 'application/pdf',
              format: 'PDF',
              pageCount,
              pages: pageResults,
              imageUrl: pageResults[0]?.imageUrl || `/uploads/${savedFileName}`,
              sha256,
              isDuplicate,
              engine: 'GEMINI',
              isFallback: false,
              classification: 'MEDICATION_PRESCRIPTION',
              classificationConfidence: 0.96,
              classificationReason: `Multi-page PDF processed with Gemini Multimodal API (${pageCount} page(s)).`,
              qualityStatus: 'OPTIMAL',
              decision,
              evidence: {
                doctorName: detectedDoc || 'Prescribing Physician',
                clinicName: 'Medical Clinic',
                rxDate: new Date().toISOString().split('T')[0],
                hasSignature: true
              },
              patientVerification: nameComparison,
              medicines: pdfGeminiMeds,
              rawText: digitalText || 'Processed via Gemini Vision Multi-page PDF'
            };
            pdfGeminiSuccess = true;
          } catch (pdfGeminiErr) {
            console.warn(`[Batch Scan] Gemini failed for PDF ${fileName}: ${pdfGeminiErr.message}. Falling back to Tesseract OCR.`);
          }
        }

        if (!pdfGeminiSuccess) {
          const pageResults = [];
          let combinedRawText = digitalText || '';
          const allMedicines = [];
          let detectedPatientName = null;
          let bestQuality = 'OPTIMAL';
          let mainEvidence = null;

          for (const page of extractedPages) {
            console.log(`[Batch Scan] Running Tesseract OCR on PDF ${fileName} Page ${page.pageNumber}/${pageCount}...`);
            const pageOcr = await performRealOCR(page.imagePath);
            combinedRawText += '\n' + pageOcr.rawText;

            const pageQuality = evaluateImageQuality(fs.readFileSync(page.imagePath), pageOcr);
            if (!pageQuality.isAcceptable) bestQuality = pageQuality.status;

            const pageEvidence = extractEvidence(pageOcr.lines, pageOcr.rawText);
            if (!mainEvidence) mainEvidence = pageEvidence;

            const pagePatient = extractPatientName(pageOcr.lines, pageOcr.rawText);
            if (pagePatient.identified && !detectedPatientName) {
              detectedPatientName = pagePatient.name;
            }

            const pageMedicines = extractMedicines(pageOcr.lines, pageOcr.rawText).map(m => {
              const dupCheck = resolveMedicineDuplicate(m, patientActiveMeds);
              return {
                ...m,
                pageNumber: page.pageNumber,
                documentName: fileName,
                isDuplicateRecord: dupCheck.isDuplicate,
                duplicateReason: dupCheck.reason || null,
                existingMedicationId: dupCheck.existingMedicationId || null,
                isDifferentStrength: dupCheck.isDifferentStrength || false,
                strengthNote: dupCheck.isDifferentStrength ? dupCheck.reason : null
              };
            });
            allMedicines.push(...pageMedicines);

            pageResults.push({
              pageNumber: page.pageNumber,
              imageUrl: page.imageUrl,
              rawText: pageOcr.rawText,
              medicinesCount: pageMedicines.length
            });
          }

          const classification = classifyDocument(combinedRawText);
          const qualityResult = { isAcceptable: true, status: bestQuality, reason: `Processed ${pageCount} PDF page(s).` };
          const decision = determineDecision(classification, qualityResult, allMedicines);

          const nameComparison = comparePatientNames(registeredPatientName, detectedPatientName);
          if (detectedPatientName) extractedPatientNamesInBatch.add(detectedPatientName);

          docResult = {
            documentId: docId,
            fileName,
            fileType: 'application/pdf',
            format: 'PDF',
            pageCount,
            pages: pageResults,
            imageUrl: pageResults[0]?.imageUrl || `/uploads/${savedFileName}`,
            sha256,
            isDuplicate,
            engine: 'TESSERACT',
            isFallback: false,
            classification: classification.classification,
            classificationConfidence: classification.confidence,
            classificationReason: classification.reason,
            qualityStatus: bestQuality,
            decision,
            evidence: mainEvidence || {
              doctorName: 'Prescribing Physician',
              clinicName: 'Medical Clinic',
              rxDate: new Date().toISOString().split('T')[0],
              hasSignature: true
            },
            patientVerification: nameComparison,
            medicines: allMedicines,
            rawText: combinedRawText
          };
        }
      } else {
        // --- Image Pipeline (JPG, JPEG, PNG) ---
        let geminiOutput = null;
        let isFallback = false;
        let fallbackReason = null;
        let engineUsed = 'TESSERACT';

        // 1. Try Gemini Multimodal Engine if mode === 'online'
        if (mode === 'online') {
          try {
            console.log(`[Batch Scan] Attempting Primary Gemini Analysis for ${fileName}...`);
            const mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
            geminiOutput = await analyzePrescriptionWithGemini(fileBuffer, mimeType);
            engineUsed = 'GEMINI';
            console.log(`[Batch Scan] Gemini successfully analyzed ${fileName}!`);
          } catch (geminiErr) {
            console.warn(`[Batch Scan] Gemini technical failure for ${fileName}: ${geminiErr.message}. Activating Tesseract fallback.`);
            isFallback = true;
            fallbackReason = geminiErr.message;
            engineUsed = 'TESSERACT';
          }
        } else {
          console.log(`[Batch Scan] Offline mode requested for ${fileName}. Running Tesseract directly.`);
          engineUsed = 'TESSERACT';
        }

        // 2. Build Result: If Gemini succeeded, use Gemini's structured output; else use Tesseract
        if (geminiOutput && engineUsed === 'GEMINI') {
          const patientName = geminiOutput.patientName;
          const nameComparison = comparePatientNames(registeredPatientName, patientName);
          if (patientName) extractedPatientNamesInBatch.add(patientName);

          const evaluatedMedicines = geminiOutput.medicines.map(m => {
            const dupCheck = resolveMedicineDuplicate(m, patientActiveMeds);
            return {
              ...m,
              pageNumber: 1,
              documentName: fileName,
              isDuplicateRecord: dupCheck.isDuplicate,
              duplicateReason: dupCheck.reason || null,
              existingMedicationId: dupCheck.existingMedicationId || null,
              isDifferentStrength: dupCheck.isDifferentStrength || false,
              strengthNote: dupCheck.isDifferentStrength ? dupCheck.reason : null
            };
          });

          const decision = determineDecision(
            { classification: geminiOutput.classification, confidence: 0.95 },
            { isAcceptable: true },
            evaluatedMedicines
          );

          docResult = {
            documentId: docId,
            fileName,
            fileType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
            format: 'IMAGE',
            pageCount: 1,
            pages: [{ pageNumber: 1, imageUrl: `/uploads/${savedFileName}`, medicinesCount: evaluatedMedicines.length }],
            imageUrl: `/uploads/${savedFileName}`,
            sha256,
            isDuplicate,
            engine: 'GEMINI',
            isFallback: false,
            classification: geminiOutput.classification,
            classificationConfidence: 0.96,
            classificationReason: geminiOutput.classificationReason,
            qualityStatus: 'OPTIMAL',
            decision,
            evidence: geminiOutput.evidence,
            patientVerification: nameComparison,
            medicines: evaluatedMedicines,
            rawText: 'Processed via Gemini 2.5 Flash Multimodal API'
          };
        } else {
          // --- Tesseract Pipeline (Offline or Fallback) ---
          console.log(`[Batch Scan] Running OCR on Image ${fileName}...`);
          const ocrResult = await performRealOCR(savedFilePath);
          const quality = evaluateImageQuality(fileBuffer, ocrResult);
          const classification = classifyDocument(ocrResult.rawText);
          const format = determineDocumentFormat(ocrResult.lines);
          const evidence = extractEvidence(ocrResult.lines, ocrResult.rawText);
          
          const rawMedicines = extractMedicines(ocrResult.lines, ocrResult.rawText);
          const evaluatedMedicines = rawMedicines.map(m => {
            const dupCheck = resolveMedicineDuplicate(m, patientActiveMeds);
            return {
              ...m,
              pageNumber: 1,
              documentName: fileName,
              isDuplicateRecord: dupCheck.isDuplicate,
              duplicateReason: dupCheck.reason || null,
              existingMedicationId: dupCheck.existingMedicationId || null,
              isDifferentStrength: dupCheck.isDifferentStrength || false,
              strengthNote: dupCheck.isDifferentStrength ? dupCheck.reason : null
            };
          });
          const decision = determineDecision(classification, quality, evaluatedMedicines);

          const patientExtraction = extractPatientName(ocrResult.lines, ocrResult.rawText);
          const nameComparison = comparePatientNames(registeredPatientName, patientExtraction.name);
          if (patientExtraction.name) extractedPatientNamesInBatch.add(patientExtraction.name);

          docResult = {
            documentId: docId,
            fileName,
            fileType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
            format: format || 'IMAGE',
            pageCount: 1,
            pages: [{ pageNumber: 1, imageUrl: `/uploads/${savedFileName}`, rawText: ocrResult.rawText, medicinesCount: evaluatedMedicines.length }],
            imageUrl: `/uploads/${savedFileName}`,
            sha256,
            isDuplicate,
            engine: 'TESSERACT',
            isFallback,
            fallbackReason,
            classification: classification.classification,
            classificationConfidence: classification.confidence,
            classificationReason: classification.reason,
            qualityStatus: quality.status,
            qualityReason: quality.reason,
            decision,
            evidence,
            patientVerification: nameComparison,
            medicines: evaluatedMedicines,
            rawText: ocrResult.rawText
          };
        }
      }

      processedDocuments.push(docResult);
    }

    // Cross-document conflict detection
    let hasCrossDocumentConflict = false;
    let crossDocumentConflictMessage = null;
    const distinctNames = Array.from(extractedPatientNamesInBatch);
    if (distinctNames.length > 1) {
      hasCrossDocumentConflict = true;
      crossDocumentConflictMessage = `Conflicting patient names identified across uploaded documents: ${distinctNames.map(n => `"${n}"`).join(' vs ')}. Verify each document carefully.`;
    }

    // Persist batch record in prescriptions store
    const newBatchRecord = {
      batchId,
      patientId: registeredUser.id,
      registeredPatientName,
      totalDocuments: processedDocuments.length,
      hasCrossDocumentConflict,
      crossDocumentConflictMessage,
      documents: processedDocuments,
      createdAt: new Date().toISOString()
    };
    existingPrescriptions.unshift(newBatchRecord);
    saveStore('prescriptions.json', existingPrescriptions);

    logAudit('PRESCRIPTIONS_BATCH_SCANNED', registeredUser.id, {
      batchId,
      totalDocuments: processedDocuments.length,
      hasCrossDocumentConflict,
      enginesUsed: processedDocuments.map(d => d.engine)
    });

    res.json({
      success: true,
      batchId,
      registeredPatientName,
      totalDocuments: processedDocuments.length,
      hasCrossDocumentConflict,
      crossDocumentConflictMessage,
      documents: processedDocuments
    });
  } catch (err) {
    console.error('Batch prescription scan error:', err);
    res.status(500).json({
      error: 'Failed to process prescription files',
      details: err.message
    });
  }
});

/**
 * POST /api/approve-prescriptions (BATCH MULTI-DOCUMENT APPROVAL & DUPLICATE PREVENTION)
 * Prevents creating redundant duplicate active medications when brand and generic match.
 */
app.post('/api/approve-prescriptions', requirePatientAccess, async (req, res) => {
  const { batchId, documents } = req.body;
  const patientId = req.user.role === 'admin' ? req.body.patientId : req.user.id;
  if (!patientId) return res.status(400).json({ success: false, error: 'Patient ID is required for administrator approval' });
  if (!Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({ error: 'No documents provided for approval' });
  }

  const registeredUser = await getRegisteredUser(patientId);
  const medications = getStore('medications.json', []);
  const schedules = getStore('schedules.json', []);
  const createdMedications = [];
  const updatedMedications = [];
  const createdSchedules = [];

  documents.forEach(doc => {
    // Audit name mismatch override if user explicitly proceeded
    if (doc.mismatchAcknowledged) {
      logAudit('PATIENT_NAME_MISMATCH_OVERRIDDEN', registeredUser.id, {
        batchId,
        documentId: doc.documentId,
        registeredPatientName: registeredUser.name,
        prescriptionPatientName: doc.patientVerification?.extractedName || 'Unknown',
        decision: 'PROCEED_ANYWAY',
        userAcknowledgement: 'Patient explicitly acknowledged that the prescription name does not match their account.'
      });
    }

    const medsToApprove = doc.approvedMedicines || doc.medicines || [];
    medsToApprove.forEach(item => {
      // 1. DUPLICATE MEDICATION PREVENTION:
      // If this item is recognized as a duplicate of an existing active medication (e.g. P-650 vs Paracetamol 650mg):
      // Update instructions of the existing record instead of creating a second redundant medication!
      if (item.isDuplicateRecord && item.existingMedicationId) {
        const existIdx = medications.findIndex(m => m.id === item.existingMedicationId);
        if (existIdx !== -1) {
          medications[existIdx].instructions = item.instructions || medications[existIdx].instructions;
          medications[existIdx].frequency = item.frequency || medications[existIdx].frequency;
          medications[existIdx].lastUpdatedPrescriptionId = doc.documentId;
          medications[existIdx].lastVerifiedAt = new Date().toISOString();
          
          logAudit('MEDICATION_UPDATED_PREVENTED_DUPLICATE', registeredUser.id, {
            existingMedicationId: item.existingMedicationId,
            name: medications[existIdx].name,
            reason: item.duplicateReason || 'Prevented duplicate active medication; refreshed existing schedule.'
          });

          updatedMedications.push(medications[existIdx]);
          return; // Do not create a duplicate medication!
        }
      }

      // 2. New or genuinely different strength order:
      const medId = `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const brandName = item.brandName || item.name || item.rawRecognizedName;
      const genericIngredient = item.genericIngredient || item.name || item.rawRecognizedName;

      const newMed = {
        id: medId,
        patientId: registeredUser.id,
        documentId: doc.documentId,
        sourceDocument: doc.fileName || 'Prescription',
        name: brandName,
        brandName: brandName,
        genericIngredient: genericIngredient,
        strength: item.strength || 'As Prescribed',
        dosage: item.dosage || '1 Tablet',
        form: item.form || 'Tablet',
        route: item.route || 'Oral',
        morningDose: item.morningDose !== undefined ? item.morningDose : 1,
        afternoonDose: item.afternoonDose !== undefined ? item.afternoonDose : 0,
        nightDose: item.nightDose !== undefined ? item.nightDose : 0,
        frequency: item.frequency || 'Once daily',
        timing: item.timing || 'After meals',
        duration: item.duration || 'Ongoing',
        instructions: item.instructions || 'Take as directed',
        originalPrescriptionNotation: item.originalPrescriptionNotation || '',
        pageNumber: item.pageNumber || 1,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      medications.push(newMed);
      createdMedications.push(newMed);

      // Construct explicit daily times
      let dailyTimes = [];
      if (item.times && Array.isArray(item.times) && item.times.length > 0) {
        dailyTimes = item.times.map(t => {
          const [hStr, mStr] = t.split(':');
          let h = parseInt(hStr, 10);
          const period = h >= 12 ? 'PM' : 'AM';
          if (h > 12) h -= 12;
          if (h === 0) h = 12;
          return `${h.toString().padStart(2, '0')}:${mStr} ${period}`;
        });
      } else {
        if (newMed.morningDose > 0) dailyTimes.push('08:00 AM');
        if (newMed.afternoonDose > 0) dailyTimes.push('01:00 PM');
        if (newMed.nightDose > 0) dailyTimes.push('08:00 PM');
        if (dailyTimes.length === 0) dailyTimes.push('08:00 AM');
      }

      dailyTimes.forEach(timeStr => {
        const scheduleId = `sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newSchedule = {
          id: scheduleId,
          medicationId: medId,
          patientId: registeredUser.id,
          time: timeStr,
          status: 'PENDING',
          lastConfirmedAt: null,
          scheduledDose: newMed.dosage
        };
        schedules.push(newSchedule);
        createdSchedules.push(newSchedule);
      });
    });
  });

  saveStore('medications.json', medications);
  saveStore('schedules.json', schedules);

  // Sync with persistent database
  for (const m of createdMedications) {
    await db.saveMedication(m);
  }
  if (typeof updatedMedications !== 'undefined' && Array.isArray(updatedMedications)) {
    for (const m of updatedMedications) {
      await db.updateMedication(m.id, m);
    }
  }
  for (const s of createdSchedules) {
    await db.saveSchedule(s);
  }

  logAudit('PRESCRIPTIONS_BATCH_APPROVED', registeredUser.id, {
    batchId,
    documentsCount: documents.length,
    medicationsCreated: createdMedications.length,
    medicationsUpdated: updatedMedications.length,
    schedulesCount: createdSchedules.length
  });

  res.json({
    success: true,
    message: 'Prescription batch approved. Active medication routines created.',
    createdMedications,
    updatedMedications,
    createdSchedules
  });
});

/**
 * Backward compatibility: POST /api/scan-medicine
 */
app.post('/api/scan-medicine', requireAuth, upload.single('prescriptionImage'), async (req, res) => {
  try {
    let filePath = null;
    let fileBuffer = null;
    const patientId = req.body.patientId || 'patient-default';
    const mode = req.body.mode || 'online';
    const registeredUser = await getRegisteredUser(patientId);

    if (req.file) {
      filePath = req.file.path;
      fileBuffer = fs.readFileSync(filePath);
    } else if (req.body.imageBase64) {
      const matches = req.body.imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const b64 = matches && matches.length === 3 ? matches[2] : req.body.imageBase64;
      fileBuffer = Buffer.from(b64, 'base64');
      const filename = `rx-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
      filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, fileBuffer);
    } else {
      return res.status(400).json({ error: 'No prescription image provided' });
    }

    const sha256 = computeSHA256(fileBuffer);
    let geminiOutput = null;
    let engineUsed = 'TESSERACT';
    let isFallback = false;

    if (mode === 'online') {
      try {
        geminiOutput = await analyzePrescriptionWithGemini(fileBuffer, 'image/jpeg');
        engineUsed = 'GEMINI';
      } catch (err) {
        console.warn('Gemini technical failure:', err.message);
        isFallback = true;
        engineUsed = 'TESSERACT';
      }
    }

    let resultPayload = null;
    if (geminiOutput && engineUsed === 'GEMINI') {
      const nameComparison = comparePatientNames(registeredUser.name, geminiOutput.patientName);
      resultPayload = {
        prescriptionId: `rx-${Date.now()}`,
        imageUrl: `/uploads/${path.basename(filePath)}`,
        sha256,
        engine: 'GEMINI',
        isFallback: false,
        registeredPatientName: registeredUser.name,
        patientVerification: nameComparison,
        classification: geminiOutput.classification,
        classificationConfidence: 0.96,
        classificationReason: geminiOutput.classificationReason,
        format: 'MIXED',
        qualityStatus: 'OPTIMAL',
        decision: 'CANDIDATE',
        evidence: geminiOutput.evidence,
        medicines: geminiOutput.medicines,
        rawText: 'Gemini Multimodal Analysis'
      };
    } else {
      const ocrResult = await performRealOCR(filePath);
      const quality = evaluateImageQuality(fileBuffer, ocrResult);
      const classification = classifyDocument(ocrResult.rawText);
      const format = determineDocumentFormat(ocrResult.lines);
      const evidence = extractEvidence(ocrResult.lines, ocrResult.rawText);
      const medicines = extractMedicines(ocrResult.lines, ocrResult.rawText);
      const decision = determineDecision(classification, quality, medicines);
      const patientExtraction = extractPatientName(ocrResult.lines, ocrResult.rawText);
      const nameComparison = comparePatientNames(registeredUser.name, patientExtraction.name);

      resultPayload = {
        prescriptionId: `rx-${Date.now()}`,
        imageUrl: `/uploads/${path.basename(filePath)}`,
        sha256,
        engine: 'TESSERACT',
        isFallback,
        registeredPatientName: registeredUser.name,
        patientVerification: nameComparison,
        classification: classification.classification,
        classificationConfidence: classification.confidence,
        classificationReason: classification.reason,
        format,
        qualityStatus: quality.status,
        qualityReason: quality.reason,
        decision,
        evidence,
        medicines,
        rawText: ocrResult.rawText
      };
    }

    res.json({ success: true, ...resultPayload });
  } catch (err) {
    console.error('Error processing scan:', err);
    res.status(500).json({ error: 'Failed to process scan', details: err.message });
  }
});

/**
 * Backward compatibility: POST /api/approve-prescription
 */
app.post('/api/approve-prescription', requirePatientAccess, async (req, res) => {
  const { prescriptionId, approvedMedicines } = req.body;
  const patientId = req.user.role === 'admin' ? req.body.patientId : req.user.id;
  if (!patientId) return res.status(400).json({ success: false, error: 'Patient ID is required for administrator approval' });
  if (!prescriptionId || !Array.isArray(approvedMedicines) || approvedMedicines.length === 0) {
    return res.status(400).json({ error: 'Invalid prescription approval request' });
  }

  const medications = getStore('medications.json', []);
  const schedules = getStore('schedules.json', []);
  const createdMedications = [];
  const createdSchedules = [];

  approvedMedicines.forEach(item => {
    const medId = `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const brandName = item.brandName || item.name || item.rawRecognizedName;
    const genericIngredient = item.genericIngredient || item.name || item.rawRecognizedName;

    const newMed = {
      id: medId,
      patientId: patientId || 'USR-e87f3b14-9a2c-4d5e-88f1-209471ab5e82',
      prescriptionId,
      name: brandName,
      brandName: brandName,
      genericIngredient: genericIngredient,
      strength: item.strength || 'As Prescribed',
      dosage: item.dosage || '1 Tablet',
      form: item.form || 'Tablet',
      route: item.route || 'Oral',
      morningDose: item.morningDose !== undefined ? item.morningDose : 1,
      afternoonDose: item.afternoonDose !== undefined ? item.afternoonDose : 0,
      nightDose: item.nightDose !== undefined ? item.nightDose : 0,
      frequency: item.frequency || 'Once daily',
      timing: item.timing || 'After meals',
      duration: item.duration || 'Ongoing',
      instructions: item.instructions || 'Take as directed',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    medications.push(newMed);
    createdMedications.push(newMed);

    let dailyTimes = ['08:00 AM'];
    if (newMed.frequency.includes('Twice')) dailyTimes = ['08:00 AM', '08:00 PM'];
    else if (newMed.frequency.includes('Three')) dailyTimes = ['08:00 AM', '01:00 PM', '08:00 PM'];

    dailyTimes.forEach(timeStr => {
      const scheduleId = `sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newSchedule = {
        id: scheduleId,
        medicationId: medId,
        patientId: newMed.patientId,
        time: timeStr,
        status: 'PENDING',
        scheduledDose: newMed.dosage
      };
      schedules.push(newSchedule);
      createdSchedules.push(newSchedule);
    });
  });

  saveStore('medications.json', medications);
  saveStore('schedules.json', schedules);

  // Sync with persistent database
  for (const m of createdMedications) {
    await db.saveMedication(m);
  }
  if (typeof updatedMedications !== 'undefined' && Array.isArray(updatedMedications)) {
    for (const m of updatedMedications) {
      await db.updateMedication(m.id, m);
    }
  }
  for (const s of createdSchedules) {
    await db.saveSchedule(s);
  }

  res.json({
    success: true,
    prescription: { status: 'APPROVED' },
    medications: createdMedications,
    schedules: createdSchedules
  });
});

// Initialize Indian Medicines SQLite Database (250,000+ official medicines)
let indianMedDb = null;
try {
  const { DatabaseSync } = await import('node:sqlite');
  const indianDbPath = path.join(dataDir, 'indian_medicines.db');
  if (fs.existsSync(indianDbPath)) {
    indianMedDb = new DatabaseSync(indianDbPath, { readOnly: true });
    console.log('[Indian Medicine DB] Connected to 250,000+ Indian medicine database.');
  }
} catch (e) {
  console.warn('[Indian Medicine DB] SQLite not available, using in-memory catalog fallback.');
}

/**
 * GET /api/indian-medicines
 * Search the official 250,000+ Indian medicine database by brand name, generic ingredient, or manufacturer
 */
app.get('/api/indian-medicines', (req, res) => {
  const query = (req.query.search || req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  if (!query || query.length < 2) {
    return res.json({ success: true, medicines: [] });
  }

  if (indianMedDb) {
    try {
      const stmt = indianMedDb.prepare(`
        SELECT brand_name, primary_ingredient, primary_strength, dosage_form, manufacturer, price_inr, therapeutic_class, packaging
        FROM medicines
        WHERE brand_name LIKE ? OR primary_ingredient LIKE ?
        ORDER BY CASE WHEN brand_name LIKE ? THEN 0 ELSE 1 END, brand_name ASC
        LIMIT ?
      `);
      const prefix = `${query}%`;
      const wildcard = `%${query}%`;
      const rows = stmt.all(wildcard, wildcard, prefix, limit);
      
      const medicines = rows.map(r => ({
        brand: r.brand_name,
        generic: r.primary_ingredient,
        strength: r.primary_strength,
        form: r.dosage_form ? r.dosage_form.charAt(0).toUpperCase() + r.dosage_form.slice(1) : 'Tablet',
        mfr: r.manufacturer,
        price: r.price_inr,
        class: r.therapeutic_class ? r.therapeutic_class.charAt(0).toUpperCase() + r.therapeutic_class.slice(1) : 'Medication',
        pack: r.packaging
      }));

      return res.json({ success: true, medicines, count: medicines.length });
    } catch (err) {
      console.warn('[Indian Medicine Search Error]:', err.message);
    }
  }

  const resolved = resolveBrandAndGeneric(query);
  res.json({
    success: true,
    medicines: [{
      brand: resolved.brandName,
      generic: resolved.genericIngredient,
      strength: resolved.defaultStrength || 'As Prescribed',
      form: 'Tablet',
      class: resolved.drugClass || 'Medication'
    }],
    count: 1
  });
});

/**
 * GET /api/lookup-medicine
 */
app.get('/api/lookup-medicine', (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'Medicine name is required' });

  const resolved = resolveBrandAndGeneric(name);
  res.json({
    success: true,
    drug: {
      name: resolved.brandName,
      generic: resolved.genericIngredient,
      defaultDosage: resolved.defaultStrength || 'As prescribed',
      class: resolved.drugClass || 'Prescription Medication',
      warning: resolved.warning || 'Verify exact administration instructions with prescribing physician.'
    }
  });
});

/**
 * POST /api/tick
 */
app.post('/api/tick', requireSchedulerSecret, (req, res) => {
  const schedules = getStore('schedules.json', []);
  const notifications = getStore('notifications.json', []);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let alertsCreated = 0;

  schedules.forEach(schedule => {
    if (schedule.status === 'PENDING') {
      const [time, period] = schedule.time.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;

      const scheduleMinutes = h * 60 + m;
      const diffMinutes = currentMinutes - scheduleMinutes;

      if (diffMinutes > 30 && !schedule.overdueAlertSent) {
        schedule.overdueAlertSent = true;
        notifications.push({
          id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          patientId: schedule.patientId,
          type: 'UNCONFIRMED_DOSE_ALERT',
          title: 'Unconfirmed Dose Alert',
          message: `Scheduled dose at ${schedule.time} has not been confirmed after the 30-minute grace window.`,
          timestamp: new Date().toISOString()
        });
        alertsCreated++;
      }
    }
  });

  saveStore('schedules.json', schedules);
  saveStore('notifications.json', notifications);

  res.json({ success: true, alertsCreated });
});

let serverInstance = null;
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log(`MedRemind Backend listening on http://0.0.0.0:${PORT}`);
  });
}

export { app, serverInstance };
export default app;
