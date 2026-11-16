/**
 * MedRemind Greeting & User Name Utility
 * 
 * Strict specifications:
 * - Good Morning:   5:00 AM – 11:59 AM
 * - Good Afternoon: 12:00 PM – 4:59 PM
 * - Good Evening:   5:00 PM – 4:59 AM
 * - Default name if unavailable: "there"
 */

/**
 * Returns greeting text based on device local time
 * @param {Date} date 
 * @returns {"Good Morning" | "Good Afternoon" | "Good Evening"}
 */
export function getTimeBasedGreeting(date = new Date()) {
  const hour = date.getHours(); // 0 to 23
  if (hour >= 5 && hour < 12) {
    return 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good Afternoon';
  } else {
    return 'Good Evening';
  }
}

/**
 * Extracts clean user display name.
 * Uses "there" if user or name is unavailable.
 * @param {Object|null|undefined} user 
 * @returns {string}
 */
export function getUserDisplayName(user) {
  if (!user) return 'there';
  const name = typeof user === 'string' ? user : user.name;
  if (!name || typeof name !== 'string') return 'there';
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'there';
}

/**
 * Extracts user first name for friendly greetings.
 * Uses "there" if name is unavailable.
 * @param {Object|null|undefined} user 
 * @returns {string}
 */
export function getUserFirstName(user) {
  const full = getUserDisplayName(user);
  if (full === 'there') return 'there';
  const first = full.split(/\s+/)[0];
  return first || 'there';
}

/**
 * Generates dynamic 2-character avatar initials from user's actual name
 * @param {string|null|undefined} name 
 * @returns {string}
 */
export function getUserInitials(name) {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
