/**
 * Time Utilities for MedRemind
 * Robust 12-hour (AM/PM) to 24-hour (HH:MM:SS) normalization.
 */

/**
 * Normalizes a time string into standard 24-hour PostgreSQL TIME format (HH:MM:SS).
 * Correctly handles:
 *  - 12:00 AM -> 00:00:00
 *  - 12:30 AM -> 00:30:00
 *  - 08:00 AM / 8:00 AM -> 08:00:00
 *  - 12:00 PM -> 12:00:00
 *  - 12:45 PM -> 12:45:00
 *  - 01:00 PM / 1:00 PM -> 13:00:00
 *  - 08:00 PM / 8:00 PM -> 20:00:00
 *  - 11:59 PM -> 23:59:00
 *  - Already-normalized 24h: "08:00", "08:00:00", "13:00", "20:00:00", "00:00:00"
 * 
 * Throws a descriptive Error on invalid or unparseable input.
 * NEVER silently substitutes a fallback default time.
 *
 * @param {string} timeStr - The time string to normalize
 * @returns {string} - "HH:MM:SS" formatted string
 */
export function normalizeTimeTo24Hour(timeStr) {
  if (timeStr === null || timeStr === undefined || typeof timeStr !== 'string') {
    throw new Error(`Invalid time input: expected non-empty string, got ${timeStr === null ? 'null' : typeof timeStr}`);
  }

  const clean = timeStr.trim();
  if (clean === '') {
    throw new Error('Invalid time input: string is empty or whitespace only');
  }

  // 1. Check for 12-hour format with AM/PM (e.g. "08:00 AM", "8:00 AM", "12:00 PM", "01:15 pm")
  const match12 = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const seconds = match12[3] ? parseInt(match12[3], 10) : 0;
    const meridian = match12[4].toUpperCase();

    if (hours < 1 || hours > 12) {
      throw new Error(`Invalid 12-hour time: hour must be between 1 and 12, got ${hours} in "${timeStr}"`);
    }
    if (minutes < 0 || minutes > 59) {
      throw new Error(`Invalid minutes: must be between 0 and 59, got ${minutes} in "${timeStr}"`);
    }
    if (seconds < 0 || seconds > 59) {
      throw new Error(`Invalid seconds: must be between 0 and 59, got ${seconds} in "${timeStr}"`);
    }

    if (meridian === 'AM') {
      if (hours === 12) {
        hours = 0; // 12:00 AM -> 00:00:00
      }
    } else { // PM
      if (hours !== 12) {
        hours += 12; // 1:00 PM -> 13:00:00, 8:00 PM -> 20:00:00, 12:00 PM -> 12:00:00
      }
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // 2. Check for 24-hour format (e.g. "08:00", "08:00:00", "13:00", "20:00:00", "00:00:00")
  const match24 = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    const seconds = match24[3] ? parseInt(match24[3], 10) : 0;

    if (hours < 0 || hours > 23) {
      throw new Error(`Invalid 24-hour time: hour must be between 0 and 23, got ${hours} in "${timeStr}"`);
    }
    if (minutes < 0 || minutes > 59) {
      throw new Error(`Invalid minutes: must be between 0 and 59, got ${minutes} in "${timeStr}"`);
    }
    if (seconds < 0 || seconds > 59) {
      throw new Error(`Invalid seconds: must be between 0 and 59, got ${seconds} in "${timeStr}"`);
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  throw new Error(`Unrecognized time format: "${timeStr}". Expected formats: "HH:MM AM/PM", "H:MM AM/PM", or "HH:MM:SS"`);
}
