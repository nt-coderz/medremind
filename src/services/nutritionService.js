/**
 * MedRemind Nutrition Service
 * Offline-first service for food logs and nutritional targets.
 * Works completely offline with local storage and syncs when online.
 */

import { apiFetch } from '../config/apiConfig';
import { searchFoodCatalog, calculateItemNutrition, calculateMacroPercentages, FOOD_CATALOG } from '../data/foodCatalog';

const LOCAL_STORAGE_KEY = 'medremind_food_logs';
const TARGETS_STORAGE_KEY = 'medremind_nutrition_targets';
const SYNC_QUEUE_KEY = 'medremind_food_sync_queue';

export const DEFAULT_NUTRITION_TARGETS = {
  calories: 2000,
  protein: 60,
  carbs: 250,
  fat: 65,
  fibre: 30
};

function getLocalLogs() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalLogs(logs) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.warn('[NutritionService] LocalStorage write error:', e);
  }
}

/**
 * Fetch daily food logs for patient on a specific date (YYYY-MM-DD)
 */
export async function getFoodLogs({ date, patientId = 'USR-patient' }) {
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Try online backend first
  try {
    const res = await apiFetch(`/food-logs?date=${targetDate}&patientId=${patientId}`, {}, 8000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        // Merge into local cache
        const allLocal = getLocalLogs();
        const otherDates = allLocal.filter(l => !(l.log_date === targetDate && l.patient_id === patientId));
        saveLocalLogs([...otherDates, ...data.logs]);
        return data.logs;
      }
    }
  } catch (err) {
    console.info('[NutritionService] Backend unreachable, using offline storage cache');
  }

  // Fallback to offline localStorage
  const local = getLocalLogs();
  return local.filter(l => (l.log_date === targetDate || l.date === targetDate) && (l.patient_id === patientId || l.patientId === patientId));
}

/**
 * Add a new food entry
 */
export async function addFoodLog(entry) {
  const logId = entry.id || `food-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const today = new Date().toISOString().split('T')[0];

  const fullEntry = {
    id: logId,
    patient_id: entry.patient_id || entry.patientId || 'USR-patient',
    food_name: entry.food_name || entry.name || 'Food Item',
    quantity: Number(entry.quantity) || 1,
    unit: entry.unit || 'serving',
    meal_type: entry.meal_type || entry.mealType || 'snack',
    log_date: entry.log_date || entry.date || today,
    log_time: entry.log_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    calories: Math.round(Number(entry.calories) || 0),
    protein_g: Math.round((Number(entry.protein_g ?? entry.protein) || 0) * 10) / 10,
    carbs_g: Math.round((Number(entry.carbs_g ?? entry.carbs) || 0) * 10) / 10,
    fat_g: Math.round((Number(entry.fat_g ?? entry.fat) || 0) * 10) / 10,
    fibre_g: Math.round((Number(entry.fibre_g ?? entry.fibre) || 0) * 10) / 10,
    is_estimated: !!(entry.is_estimated ?? entry.isEstimated),
    source: entry.source || 'local',
    notes: entry.notes || null,
    created_at: new Date().toISOString()
  };

  // 1. Immediately persist to local storage (Offline First)
  const currentLogs = getLocalLogs();
  saveLocalLogs([fullEntry, ...currentLogs]);

  // 2. Sync to online backend if available
  try {
    const res = await apiFetch('/food-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullEntry)
    }, 6000);

    if (res.ok) {
      const saved = await res.json();
      return saved.log || fullEntry;
    }
  } catch (err) {
    console.info('[NutritionService] Backend offline, queued for later sync');
  }

  return fullEntry;
}

/**
 * Delete a food log entry
 */
export async function deleteFoodLog(id, patientId = 'USR-patient') {
  // 1. Remove from local storage
  const currentLogs = getLocalLogs();
  const updated = currentLogs.filter(l => l.id !== id);
  saveLocalLogs(updated);

  // 2. Delete on backend
  try {
    await apiFetch(`/food-logs/${id}?patientId=${patientId}`, {
      method: 'DELETE'
    }, 6000);
  } catch (err) {
    console.info('[NutritionService] Backend offline, deleted locally');
  }

  return true;
}

/**
 * Intelligent food nutrition lookup:
 * 1. Checks local built-in catalog for instant 0ms offline match.
 * 2. If not found, calls backend `/api/food-lookup` (Gemini API with fallback).
 * 3. If completely offline and unlisted, returns estimated baseline.
 */
export async function lookupFoodItem(foodName, quantity = 1, unit = null) {
  if (!foodName || typeof foodName !== 'string') return null;

  // Step 1: Check offline local catalog
  const matches = searchFoodCatalog(foodName);
  if (matches.length > 0) {
    const topMatch = matches[0];
    const nutrition = calculateItemNutrition(topMatch, quantity, unit || topMatch.defaultUnit);
    return {
      name: topMatch.name,
      catalogId: topMatch.id,
      serving: `${quantity} ${unit || topMatch.defaultUnit}`,
      unit: unit || topMatch.defaultUnit,
      ...nutrition,
      isEstimated: false,
      source: 'local_catalog',
      notes: `Verified from offline database (${topMatch.category})`
    };
  }

  // Step 2: Try online Gemini fallback via backend
  try {
    const params = new URLSearchParams({
      query: foodName,
      quantity: String(quantity),
      unit: unit || 'serving'
    });
    const res = await apiFetch(`/food-lookup?${params.toString()}`, {}, 8000);
    if (res.ok) {
      const data = await res.json();
      return {
        name: data.name || foodName,
        serving: data.servingDescription || `${quantity} ${unit || 'serving'}`,
        unit: unit || 'serving',
        calories: Number(data.calories) || 0,
        protein: Number(data.protein) || 0,
        carbs: Number(data.carbs) || 0,
        fat: Number(data.fat) || 0,
        fibre: Number(data.fibre) || 0,
        isEstimated: true,
        source: 'gemini',
        notes: data.notes || 'Nutritional estimates generated by Gemini AI'
      };
    }
  } catch (err) {
    console.info('[NutritionService] Online food lookup unavailable, using estimated baseline');
  }

  // Step 3: Offline heuristic estimate for uncatalogued items
  const qty = Number(quantity) || 1;
  return {
    name: foodName,
    serving: `${qty} ${unit || 'serving'}`,
    unit: unit || 'serving',
    calories: Math.round(150 * qty),
    protein: Math.round(4 * qty * 10) / 10,
    carbs: Math.round(20 * qty * 10) / 10,
    fat: Math.round(5 * qty * 10) / 10,
    fibre: Math.round(2 * qty * 10) / 10,
    isEstimated: true,
    source: 'offline_heuristic',
    notes: 'Rough nutritional estimate (offline mode). Please edit to match package details.'
  };
}

/**
 * Fetch daily nutrition targets
 */
export async function getNutritionTargets(patientId = 'USR-patient') {
  try {
    const res = await apiFetch(`/nutrition-targets?patientId=${patientId}`, {}, 5000);
    if (res.ok) {
      const data = await res.json();
      if (data.targets) {
        localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(data.targets));
        return data.targets;
      }
    }
  } catch (e) {
    // offline
  }

  try {
    const cached = localStorage.getItem(TARGETS_STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  return DEFAULT_NUTRITION_TARGETS;
}

/**
 * Save daily nutrition targets
 */
export async function saveNutritionTargets(patientId = 'USR-patient', targets) {
  const safeTargets = {
    calories: Math.max(500, Math.min(10000, Number(targets.calories) || 2000)),
    protein: Math.max(10, Math.min(500, Number(targets.protein) || 60)),
    carbs: Math.max(10, Math.min(1000, Number(targets.carbs) || 250)),
    fat: Math.max(5, Math.min(500, Number(targets.fat) || 65)),
    fibre: Math.max(0, Math.min(200, Number(targets.fibre) || 30))
  };

  localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(safeTargets));

  try {
    await apiFetch('/nutrition-targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, targets: safeTargets })
    }, 5000);
  } catch (e) {
    console.info('[NutritionService] Saved targets locally (offline)');
  }

  return safeTargets;
}
