/**
 * Unique User ID Generator
 * Complies with UUID v4 format: USR-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * Provides fallback if crypto.randomUUID() is unavailable in legacy browser runtimes.
 */
export function generateUserId(prefix = 'USR') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  // RFC 4122 v4 compliant fallback generator
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  return `${prefix}-${uuid}`;
}

/**
 * Format user ID for clean visual display in mobile views
 * e.g., USR-4a2b...9f81
 */
export function formatShortUserId(id) {
  if (!id) return '';
  if (id.length <= 16) return id;
  const parts = id.split('-');
  if (parts.length >= 2) {
    const prefix = parts[0];
    const uuid = parts.slice(1).join('-');
    return `${prefix}-${uuid.slice(0, 4)}...${uuid.slice(-4)}`;
  }
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

export function generateId(prefix = 'ID') {
  return generateUserId(prefix);
}
