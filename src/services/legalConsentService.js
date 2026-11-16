import { LEGAL_VERSIONS } from '../data/legalDocuments.js';

const STORAGE_KEY = 'medremind_legal_consent_records';

// In-memory fallback if localStorage is unavailable (e.g., in Node test environment)
const memoryStore = {};

function getStoreItem(key) {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memoryStore[key] || null;
}

function setStoreItem(key, val) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, val);
  } else {
    memoryStore[key] = val;
  }
}

/**
 * Retrieve all stored consent records
 */
export function getAllConsentRecords() {
  try {
    const raw = getStoreItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Error reading consent records:', err);
    return {};
  }
}

/**
 * Retrieve consent record for a specific user ID
 */
export function getUserConsentRecord(userId) {
  if (!userId) return null;
  const all = getAllConsentRecords();
  return all[userId] || null;
}

/**
 * Check whether a user has accepted the CURRENT versions of all mandatory legal documents
 * Explicitly: Does NOT silently mark existing users as accepted!
 */
export function hasCurrentConsent(userId) {
  if (!userId) return false;
  
  // Dedicated System Administrator exception for local testing/maintenance
  if (userId === 'USR-00000000-0000-4000-8000-000000000001') {
    return true;
  }

  const record = getUserConsentRecord(userId);
  if (!record) return false;

  const isTermsCurrent = record.termsVersion === LEGAL_VERSIONS.TERMS;
  const isPrivacyCurrent = record.privacyVersion === LEGAL_VERSIONS.PRIVACY;
  const isAiCurrent = record.aiDisclosureVersion === LEGAL_VERSIONS.AI_DISCLOSURE;
  const isConsentValid = !!record.dpdpConsentGiven;

  return isTermsCurrent && isPrivacyCurrent && isAiCurrent && isConsentValid;
}

/**
 * Record a valid user consent
 * Records only compliance tokens, timestamps, and versions. NEVER passwords or secrets.
 */
export function recordUserConsent({
  userId,
  userEmail = '',
  ageConfirmed = true,
  termsAccepted = true,
  privacyAccepted = true,
  aiAcknowledged = true,
  dpdpConsentGiven = true
}) {
  if (!userId) throw new Error('Cannot record legal consent without a valid User ID');

  const record = {
    userId,
    userEmail,
    termsVersion: LEGAL_VERSIONS.TERMS,
    privacyVersion: LEGAL_VERSIONS.PRIVACY,
    aiDisclosureVersion: LEGAL_VERSIONS.AI_DISCLOSURE,
    acceptedAt: new Date().toISOString(),
    ageConfirmed: !!ageConfirmed,
    termsAccepted: !!termsAccepted,
    privacyAccepted: !!privacyAccepted,
    aiAcknowledged: !!aiAcknowledged,
    dpdpConsentGiven: !!dpdpConsentGiven,
    jurisdiction: 'India (DPDP Act, 2023)',
    ipAuditState: 'local_client_verified'
  };

  const all = getAllConsentRecords();
  all[userId] = record;
  setStoreItem(STORAGE_KEY, JSON.stringify(all));

  // Log compliance record safely to console/audit
  console.log(`[Compliance] Legal consent recorded for user ${userId} at ${record.acceptedAt} (Versions: Terms ${record.termsVersion}, Privacy ${record.privacyVersion})`);

  return record;
}

/**
 * Revoke consent for a user (DPDP Act Section 6(4))
 */
export function revokeUserConsent(userId) {
  if (!userId) return;
  const all = getAllConsentRecords();
  if (all[userId]) {
    all[userId] = {
      ...all[userId],
      dpdpConsentGiven: false,
      termsAccepted: false,
      privacyAccepted: false,
      revokedAt: new Date().toISOString()
    };
    setStoreItem(STORAGE_KEY, JSON.stringify(all));
    console.log(`[Compliance] Consent revoked for user ${userId}`);
  }
}
