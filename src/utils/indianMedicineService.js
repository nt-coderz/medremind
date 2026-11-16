/**
 * MedRemind Indian Government Medical Database Service
 * 
 * Powered by the official Indian pharmaceutical dataset of 250,000+ medicines.
 * Offline-first: Instant in-memory search over top Indian brands + online full dataset search.
 */

import offlineCatalog from '../data/indianMedicinesCatalog.json';
import { apiFetch, isOnline } from '../config/apiConfig';

/**
 * Search the Indian medicine database
 * @param {string} query Search term (brand name, generic ingredient, or manufacturer)
 * @param {number} limit Maximum results to return
 * @returns {Promise<Array>} List of matching medicines
 */
export async function searchIndianMedicines(query, limit = 20) {
  if (!query || typeof query !== 'string') return [];
  const clean = query.trim().toLowerCase();
  if (clean.length < 2) return [];

  // 1. Client-Side Offline In-Memory Search (Instant)
  const localMatches = [];
  for (const item of offlineCatalog) {
    const brand = (item.brand || '').toLowerCase();
    const generic = (item.generic || '').toLowerCase();
    const mfr = (item.mfr || '').toLowerCase();

    if (brand.startsWith(clean)) {
      localMatches.unshift(item); // Prefix matches first
    } else if (brand.includes(clean) || generic.includes(clean) || mfr.includes(clean)) {
      localMatches.push(item);
    }

    if (localMatches.length >= limit * 2) break;
  }

  // 2. If online and need deeper results from the 253,000+ full backend database
  if (isOnline()) {
    try {
      const res = await apiFetch(`/indian-medicines?search=${encodeURIComponent(clean)}&limit=${limit}`, {}, 3000);
      if (res && res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.medicines) && data.medicines.length > 0) {
          // Merge and deduplicate by brand name
          const seen = new Set(data.medicines.map(m => m.brand.toLowerCase()));
          const extra = localMatches.filter(m => !seen.has(m.brand.toLowerCase()));
          return [...data.medicines, ...extra].slice(0, limit);
        }
      }
    } catch (e) {
      // Backend request timed out or offline, fall back to localMatches
    }
  }

  return localMatches.slice(0, limit);
}

/**
 * Format medicine item for prefilling AddEditMedicinePage
 */
export function formatMedicineForPrefill(med) {
  if (!med) return null;
  return {
    name: med.brand,
    genericIngredient: med.generic || '',
    strength: med.strength || '',
    dosage: med.strength ? `1 ${med.form || 'Tablet'} (${med.strength})` : `1 ${med.form || 'Tablet'}`,
    form: med.form || 'Tablet',
    frequency: 'Once daily',
    instructions: med.class ? `Class: ${med.class}. Take as prescribed.` : 'Take as directed by doctor.',
    prescribedBy: med.mfr ? `Mfr: ${med.mfr}` : '',
    price: med.price || null
  };
}
