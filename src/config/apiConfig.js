/**
 * MedRemind Centralized API & Network Configuration
 * 
 * Supports seamless switching between:
 * - Production Deployed HTTPS Cloud Backend
 * - Local Development Preview (localhost)
 * - Offline Fallback Detection
 */

import { Capacitor } from '@capacitor/core';

// Production Cloud URL (Render Web Service)
// Can be customized via VITE_API_URL in .env or dynamically stored in app settings
export const DEFAULT_PRODUCTION_URL = 'https://medremind-backend.onrender.com';
export const LOCAL_DEV_URL = 'http://localhost:3001';

/**
 * Returns the active Backend Origin URL (without trailing slash)
 */
export function getBackendBaseUrl() {
  // 1. Explicit user/admin runtime override from localStorage
  const customOverride = localStorage.getItem('medremind_backend_url');
  if (customOverride && customOverride.trim() !== '') {
    return customOverride.trim().replace(/\/+$/, '');
  }

  // 2. Vite environment variable if injected at build time
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') {
    return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '');
  }

  // 3. Native device or production web builds default to production cloud endpoint
  if (Capacitor.isNativePlatform() || import.meta.env.PROD) {
    return DEFAULT_PRODUCTION_URL;
  }

  // 4. Local web development fallback
  return LOCAL_DEV_URL;
}

/**
 * Full API prefix for REST endpoints
 */
export function getApiBaseUrl() {
  return `${getBackendBaseUrl()}/api`;
}

/**
 * Check device network connectivity
 */
export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Network fetch wrapper with timeout and standardized error handling.
 * Prevents hanging requests or unhandled promise rejections.
 */
export async function apiFetch(endpoint, options = {}, timeoutMs = 25000) {
  const url = endpoint.startsWith('http') ? endpoint : `${getApiBaseUrl()}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  if (!isOnline()) {
    throw new Error('No internet connection. Please check your network and try again.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Attach auth token if available in localStorage
  const headers = { ...(options.headers || {}) };
  const token = localStorage.getItem('medremind_auth_token') || localStorage.getItem('token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Network request timed out. Please verify your connection.');
    }
    if (!isOnline()) {
      throw new Error('Connection lost. Please reconnect to the internet.');
    }
    throw new Error(err.message || 'Unable to connect to MedRemind cloud server.');
  }
}
