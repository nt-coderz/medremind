/**
 * MedRemind Prescription Backend Service
 * Connects frontend scanner and verification flow with the Level 2 backend API.
 * Uses centralized apiConfig: production HTTPS cloud endpoint when deployed or native,
 * and local dev preview when on localhost.
 */

import { getApiBaseUrl, apiFetch } from '../config/apiConfig';

/**
 * Fetch recognition engine status (Gemini + Tesseract)
 */
export async function getEngineStatus() {
  try {
    const res = await apiFetch('/engine-status', {}, 10000);
    if (!res.ok) throw new Error('Status unavailable');
    return await res.json();
  } catch (e) {
    return {
      primaryEngine: 'GEMINI',
      geminiConfigured: false,
      fallbackEngine: 'TESSERACT',
      tesseractAvailable: true,
      offlineSupported: true
    };
  }
}

/**
 * Scan multiple prescriptions in one submission (JPG, JPEG, PNG, PDF)
 * Supports Online (Gemini primary) or Offline (Tesseract) modes
 */
export async function scanPrescriptionsBatch({ files, patientId = 'patient-alex', mode = 'online' }) {
  try {
    const response = await apiFetch('/scan-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, patientId, mode })
    }, 60000); // 60s timeout for heavy multimodal OCR

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error (${response.status})`);
    }

    return await response.json();
  } catch (err) {
    console.error('Batch prescription scan failed:', err);
    throw err;
  }
}

/**
 * Explicit patient approval of batch prescription documents
 */
export async function approvePrescriptionsBatch({ batchId, patientId = 'patient-alex', documents }) {
  try {
    const response = await apiFetch('/approve-prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId, patientId, documents })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Approval failed with status ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('Batch approval failed:', err);
    throw err;
  }
}

/**
 * Scan a medicine strip, blister pack, or medicine packaging image
 */
export async function scanMedicineStrip({ imageBase64, file, mode = 'online', patientId = 'patient-alex' }) {
  try {
    let response;
    if (file) {
      const formData = new FormData();
      formData.append('stripImage', file);
      formData.append('mode', mode);
      formData.append('patientId', patientId);
      response = await apiFetch('/scan-strip', {
        method: 'POST',
        body: formData
      }, 60000);
    } else if (imageBase64) {
      response = await apiFetch('/scan-strip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mode, patientId })
      }, 60000);
    } else {
      throw new Error('No strip image file or base64 provided');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('Medicine strip scan failed:', err);
    throw err;
  }
}

/**
 * Scan a single prescription image (backward compatibility)
 */
export async function scanPrescription({ imageBase64, file, patientId = 'patient-default' }) {
  try {
    let response;
    if (file) {
      const formData = new FormData();
      formData.append('prescriptionImage', file);
      formData.append('patientId', patientId);
      response = await apiFetch('/scan-medicine', {
        method: 'POST',
        body: formData
      }, 60000);
    } else if (imageBase64) {
      response = await apiFetch('/scan-medicine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, patientId })
      }, 60000);
    } else {
      throw new Error('No image file or base64 provided');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('Prescription scan failed:', err);
    throw err;
  }
}

/**
 * Fetch prescription processing result by ID
 */
export async function getPrescriptionResult(id) {
  try {
    const response = await apiFetch(`/get-prescription-result/${id}`);
    if (!response.ok) throw new Error(`Prescription not found (${response.status})`);
    return await response.json();
  } catch (err) {
    console.error('Fetch prescription result error:', err);
    throw err;
  }
}

/**
 * Explicit patient approval of single prescription (backward compatibility)
 */
export async function approvePrescriptionAPI({ prescriptionId, patientId, approvedMedicines }) {
  try {
    const response = await apiFetch('/approve-prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prescriptionId, patientId, approvedMedicines })
    });
    if (!response.ok) throw new Error(`Approval failed with status ${response.status}`);
    return await response.json();
  } catch (err) {
    console.error('Approval API error:', err);
    throw err;
  }
}

/**
 * Reject prescription
 */
export async function rejectPrescriptionAPI({ prescriptionId, reason }) {
  try {
    const response = await apiFetch('/reject-prescription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prescriptionId, reason })
    });
    return await response.json();
  } catch (err) {
    console.error('Reject API error:', err);
    throw err;
  }
}

/**
 * Drug safety lookup
 */
export async function lookupMedicine(name) {
  try {
    const response = await apiFetch(`/lookup-medicine?name=${encodeURIComponent(name)}`);
    return await response.json();
  } catch (err) {
    console.warn('Medicine lookup error:', err);
    return null;
  }
}
