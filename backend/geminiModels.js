/**
 * MedRemind Gemini Model Fallback and Cooldown Manager
 * Automatically falls back across specified models on 429 (quota), 503 (overload), or 404 (unavailable).
 * Caches model failures with a 5-minute cooldown to avoid hammering rate-limited endpoints.
 */

import { GoogleGenAI } from '@google/genai';

// In-memory model cooldown tracking (modelName -> expiry timestamp)
const modelCooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns whether a model is currently in cooldown
 */
function isModelInCooldown(modelName) {
  const expiry = modelCooldowns.get(modelName);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    modelCooldowns.delete(modelName);
    return false;
  }
  return true;
}

/**
 * Marks a model as in cooldown
 */
export function markModelCooldown(modelName) {
  modelCooldowns.set(modelName, Date.now() + COOLDOWN_MS);
  console.warn(`[Gemini Fallback] Model "${modelName}" entered cooldown for 5 minutes.`);
}

/**
 * Clears expired cooldowns
 */
export function cleanupCooldowns() {
  const now = Date.now();
  for (const [model, expiry] of modelCooldowns.entries()) {
    if (now > expiry) modelCooldowns.delete(model);
  }
}

/**
 * Resolves list of candidate chat models
 */
export function getChatModelCandidates() {
  cleanupCooldowns();
  const configured = process.env.GEMINI_CHAT_MODELS
    ? process.env.GEMINI_CHAT_MODELS.split(',').map(m => m.trim()).filter(Boolean)
    : [];

  const defaults = [
    process.env.GEMINI_CHAT_MODEL,
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ].filter(Boolean);

  const set = new Set([...configured, ...defaults]);
  return Array.from(set);
}

/**
 * Resolves list of candidate vision / OCR models
 */
export function getVisionModelCandidates() {
  cleanupCooldowns();
  const configured = process.env.GEMINI_VISION_MODELS
    ? process.env.GEMINI_VISION_MODELS.split(',').map(m => m.trim()).filter(Boolean)
    : [];

  const defaults = [
    process.env.GEMINI_VISION_MODEL,
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ].filter(Boolean);

  const set = new Set([...configured, ...defaults]);
  return Array.from(set);
}

/**
 * Checks if an error warrants a model fallback (quota, rate limit, overload, not found)
 */
export function isRetryableModelError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const status = error.status || error.code || 0;

  if (status === 429 || status === 503 || status === 404 || status === 500) return true;
  if (msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('rate limit')) return true;
  if (msg.includes('overloaded') || msg.includes('unavailable') || msg.includes('not found')) return true;
  if (msg.includes('model not supported') || msg.includes('deprecated')) return true;

  return false;
}

/**
 * Executes a Gemini request with automatic multi-model fallback chain
 */
export async function executeWithModelFallback(apiKey, candidates, executeFn) {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Prioritize models not in cooldown
  let availableModels = candidates.filter(m => !isModelInCooldown(m));
  if (availableModels.length === 0) {
    // If all are in cooldown, reset and try all candidates
    console.warn('[Gemini Fallback] All candidate models were in cooldown. Resetting cooldowns.');
    availableModels = [...candidates];
  }

  let lastError = null;

  for (const model of availableModels) {
    try {
      console.log(`[Gemini Fallback] Executing with model: ${model}...`);
      const result = await executeFn(ai, model);
      return { result, modelUsed: model };
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini Fallback] Model "${model}" failed: ${err.message}`);

      if (isRetryableModelError(err)) {
        markModelCooldown(model);
        continue; // Try next candidate model
      } else {
        // Non-retryable error (e.g. invalid API key or bad request)
        throw err;
      }
    }
  }

  throw lastError || new Error('All configured Gemini models failed.');
}
