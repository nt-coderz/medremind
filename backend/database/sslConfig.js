import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_CA_PATH = path.join(__dirname, 'supabase-ca.pem');

/**
 * Shared database SSL configuration helper.
 * Enforces strict TLS verification (rejectUnauthorized: true) with the official
 * Supabase Root CA certificate for all remote PostgreSQL connections.
 * Rules:
 * 1. rejectUnauthorized: true is strictly enforced for all non-local connections.
 * 2. Never falls back to rejectUnauthorized: false.
 * 3. Uses Node.js default TLS hostname verification (no bypass).
 * 4. Localhost / 127.0.0.1 retains non-TLS local development behavior (returns false).
 * 5. Supports SUPABASE_SSL_CA environment variable (file path or PEM text).
 * 6. Defaults to backend/database/supabase-ca.pem.
 * 7. Fails loudly with descriptive error if certificate is missing, malformed, or unreadable.
 * 8. Never leaks credentials, connection strings, or full certificate content in errors.
 *
 * @param {string} connectionString
 * @returns {false | { rejectUnauthorized: true, ca: string }}
 */
export function getDatabaseSslConfig(connectionString) {
  if (!connectionString || typeof connectionString !== 'string' || connectionString.trim() === '') {
    throw new Error('[SSL Config Error] Connection string is required to determine database SSL configuration.');
  }

  const trimmedConn = connectionString.trim();

  // Safely check for localhost / loopback address without exposing secrets
  let isLocal = false;
  try {
    if (
      trimmedConn.includes('@localhost') ||
      trimmedConn.includes('@127.0.0.1') ||
      trimmedConn.includes('@[::1]') ||
      trimmedConn.includes('@::1') ||
      trimmedConn.includes('://localhost') ||
      trimmedConn.includes('://127.0.0.1') ||
      trimmedConn.includes('://[::1]')
    ) {
      isLocal = true;
    } else {
      const urlMatch = trimmedConn.match(/@(?:\[([^\]]+)\]|([^:/]+))(?::(\d+))?/);
      const host = (urlMatch ? (urlMatch[1] || urlMatch[2]) : '').toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        isLocal = true;
      }
    }
  } catch (e) {
    // Fallback safe substring check
    if (trimmedConn.includes('localhost') || trimmedConn.includes('127.0.0.1') || trimmedConn.includes('::1')) {
      isLocal = true;
    }
  }

  if (isLocal) {
    return false;
  }

  // Remote connection requires strict TLS with valid CA certificate
  let caContent = null;
  const customCaEnv = process.env.SUPABASE_SSL_CA;

  if (customCaEnv && customCaEnv.trim() !== '') {
    const trimmedEnv = customCaEnv.trim();
    if (trimmedEnv.includes('-----BEGIN CERTIFICATE-----')) {
      caContent = trimmedEnv;
    } else {
      const resolvedPath = path.isAbsolute(trimmedEnv) ? trimmedEnv : path.resolve(process.cwd(), trimmedEnv);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`[SSL Config Error] Custom CA file specified by SUPABASE_SSL_CA does not exist: ${resolvedPath}`);
      }
      try {
        caContent = fs.readFileSync(resolvedPath, 'utf-8');
      } catch (err) {
        throw new Error(`[SSL Config Error] Failed to read custom CA certificate at ${resolvedPath}: ${err.message}`);
      }
    }
  } else {
    // Default to the project Supabase CA certificate
    if (!fs.existsSync(DEFAULT_CA_PATH)) {
      throw new Error(
        `[SSL Config Error] Supabase Root CA certificate not found at expected path: ${DEFAULT_CA_PATH}. ` +
        `Strict TLS verification is mandatory for remote PostgreSQL connections. ` +
        `Ensure supabase-ca.pem is present or provide SUPABASE_SSL_CA.`
      );
    }
    try {
      caContent = fs.readFileSync(DEFAULT_CA_PATH, 'utf-8');
    } catch (err) {
      throw new Error(`[SSL Config Error] Failed to read Supabase Root CA certificate at ${DEFAULT_CA_PATH}: ${err.message}`);
    }
  }

  // Validate PEM certificate structure
  if (
    !caContent ||
    typeof caContent !== 'string' ||
    !caContent.includes('-----BEGIN CERTIFICATE-----') ||
    !caContent.includes('-----END CERTIFICATE-----')
  ) {
    throw new Error('[SSL Config Error] CA certificate is invalid or malformed: missing standard PEM certificate boundaries.');
  }

  // Return strict TLS options. NEVER set rejectUnauthorized: false.
  return {
    rejectUnauthorized: true,
    ca: caContent.trim()
  };
}
