import { GoogleGenAI } from '@google/genai';
import { resolveBrandAndGeneric, parseDosageNotation, crossCheckStripMedicine } from './drugKnowledgeBase.js';
import { executeWithModelFallback, getVisionModelCandidates } from './geminiModels.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const PRESCRIPTION_SCHEMA = {
  type: 'object',
  properties: {
    documentClassification: {
      type: 'string',
      enum: ['MEDICATION_PRESCRIPTION', 'CLINICAL_CONSULTATION_NOTE', 'LAB_REPORT', 'MEDICAL_BILL', 'NON_MEDICAL_DOCUMENT']
    },
    classificationReason: { type: 'string' },
    patientName: { type: 'string', nullable: true },
    doctorName: { type: 'string', nullable: true },
    clinicName: { type: 'string', nullable: true },
    prescriptionDate: { type: 'string', nullable: true },
    hasSignature: { type: 'boolean' },
    numberedItemsCount: { type: 'integer' },
    medicines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          brandName: { type: 'string' },
          genericIngredient: { type: 'string' },
          strength: { type: 'string' },
          dosagePerAdministration: { type: 'string' },
          form: { type: 'string' },
          route: { type: 'string' },
          morningDose: { type: 'integer' },
          afternoonDose: { type: 'integer' },
          nightDose: { type: 'integer' },
          frequency: { type: 'string' },
          timing: { type: 'string' },
          duration: { type: 'string' },
          additionalInstructions: { type: 'string' },
          originalPrescriptionNotation: { type: 'string' },
          isUncertain: { type: 'boolean' },
          uncertainReasons: {
            type: 'array',
            items: { type: 'string' }
          },
          confidence: { type: 'number' }
        },
        required: [
          'brandName',
          'genericIngredient',
          'strength',
          'form',
          'morningDose',
          'afternoonDose',
          'nightDose',
          'frequency',
          'duration',
          'isUncertain'
        ]
      }
    }
  },
  required: ['documentClassification', 'medicines']
};

const GEMINI_PRESCRIPTION_PROMPT = `
You are a senior clinical pharmacist and medical document recognition specialist.
Analyze this medical document or prescription image with clinical rigor and optical precision.

CRITICAL CLINICAL EXTRACTION INSTRUCTIONS:
1. FIRST, scan and count the numbered or bulleted medication items on the prescription (set numberedItemsCount).
2. Carefully decipher doctor handwriting, especially Indian medical shorthand:
   - "1-0-1" = twice daily (morning & night, NOT 3 times).
   - "1-1-1" = 3 times daily.
   - "0-0-1" or "HS" = once daily at bedtime/night.
   - "OD" = once daily; "BD" or "BID" = twice daily; "TDS" or "TID" = 3 times daily; "QID" = 4 times daily.
   - "SOS" = as needed; "PC" = after food; "AC" = before food/empty stomach.
3. Keep Brand Name and Generic Ingredient together in ONE single medicine record (e.g. brand "Augmentin", generic "Amoxicillin + Clavulanic Acid"). Do NOT create duplicate records.
4. Extract duration precisely (e.g., "5 days", "14 days", "1 month", "ongoing").
5. STRICT SAFETY RULE: NEVER INVENT OR GUESS MEDICAL INFORMATION. If any handwriting is illegible or ambiguous, keep isUncertain: true and list the uncertainty reason in uncertainReasons rather than guessing a drug name.
6. If this is a clinical consultation note or lab report without medication orders, classify accordingly and set medicines to an empty array.
`;

const STRIP_SCHEMA = {
  type: 'object',
  properties: {
    isReadable: { type: 'boolean' },
    unreadableReason: { type: 'string', nullable: true },
    brandName: { type: 'string' },
    genericIngredient: { type: 'string' },
    strength: { type: 'string' },
    form: { type: 'string' },
    manufacturer: { type: 'string', nullable: true },
    batchNumber: { type: 'string', nullable: true },
    expiryDate: { type: 'string', nullable: true },
    storageNotes: { type: 'string', nullable: true },
    rxOnly: { type: 'boolean' },
    confidences: {
      type: 'object',
      properties: {
        brandName: { type: 'number' },
        genericIngredient: { type: 'number' },
        strength: { type: 'number' },
        form: { type: 'number' },
        expiryDate: { type: 'number' },
        batchNumber: { type: 'number' }
      }
    }
  },
  required: ['isReadable', 'brandName', 'genericIngredient', 'strength', 'form']
};

const GEMINI_STRIP_PROMPT = `
You are a senior clinical pharmacist and pharmaceutical packaging OCR specialist.
Analyze this image of a medicine strip, blister pack, vial, bottle, or medicine box with high clinical accuracy.

CRITICAL PHARMACEUTICAL RULES:
1. NEVER INVENT OR GUESS MEDICAL INFORMATION. If any field (especially brandName, genericIngredient, strength, or expiryDate) is unreadable, cut off, or blurry, leave it as "" or null, set its confidence below 0.5, and describe the issue in unreadableReason. If the entire image cannot be deciphered, set isReadable to false.
2. Distinguish Brand Name from Generic Composition. For example, "Dolo-650" is the Brand Name; "Paracetamol Tablets IP 650 mg" is the Generic Composition and Strength.
3. Check for Rx Warning ("SCHEDULE H PRESCRIPTION DRUG" or "Rx only") and set rxOnly accordingly.
4. Extract the Expiry Date ("EXP", "EXPIRY", "USE BEFORE") carefully. Do NOT confuse it with Manufacturing Date ("MFD", "MFG").
`;

const GEMINI_FOOD_PROMPT = `
You are a certified clinical nutritionist specializing in dietary analysis and regional Indian foods.
Given a food item description, quantity, and unit, calculate the estimated nutritional breakdown.

CRITICAL RULES:
1. Be realistic for home-cooked Indian and international foods (e.g. 1 medium roti = ~100-120 kcal, 3g protein; 1 cup cooked dal = ~150-180 kcal, 8-10g protein).
2. Numbers must be numeric (calories, protein, carbs, fat, fibre).
3. "estimated" must always be true.
`;

/**
 * Perform Multimodal Prescription Analysis with Gemini API and automatic fallback
 */
export async function analyzePrescriptionWithGemini(imageBuffer, mimeType = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }

  const base64Data = imageBuffer.toString('base64');
  const candidates = getVisionModelCandidates();

  const { result: rawResponse, modelUsed } = await executeWithModelFallback(apiKey, candidates, async (ai, model) => {
    return await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType || 'image/jpeg'
              }
            },
            {
              text: GEMINI_PRESCRIPTION_PROMPT
            }
          ]
        }
      ],
      config: {
        temperature: 0.1, // Low temperature to prevent hallucinations
        responseMimeType: 'application/json',
        responseSchema: PRESCRIPTION_SCHEMA
      }
    });
  });

  const rawOutput = rawResponse.text || '';
  let cleanJson = rawOutput.trim();
  if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
  if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
  if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
  cleanJson = cleanJson.trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    console.error('[Gemini Engine] Failed to parse JSON output:', cleanJson);
    throw new Error(`Invalid JSON returned from Gemini: ${err.message}`);
  }

  // Check if detected item count exceeds extracted items
  const detectedCount = parsed.numberedItemsCount || 0;
  const warnings = [];
  if (detectedCount > 0 && (parsed.medicines || []).length < detectedCount) {
    warnings.push(`Prescription appears to contain ${detectedCount} items, but only ${parsed.medicines.length} were clearly identified. Please review carefully.`);
  }

  // Cross-check and normalize medicines with Drug Catalog
  const normalizedMedicines = (parsed.medicines || []).map(med => {
    const resolvedIdentity = resolveBrandAndGeneric(med.brandName || med.genericIngredient);
    const parsedDosage = parseDosageNotation(med.originalPrescriptionNotation || med.frequency);

    const uncertainReasons = Array.isArray(med.uncertainReasons) ? [...med.uncertainReasons] : [];
    let isUncertain = !!med.isUncertain;

    // Cross-check with local catalog
    if (resolvedIdentity.isVerified && med.genericIngredient) {
      const catGeneric = resolvedIdentity.genericIngredient.toLowerCase();
      const gemGeneric = med.genericIngredient.toLowerCase();
      if (!catGeneric.includes(gemGeneric) && !gemGeneric.includes(catGeneric)) {
        uncertainReasons.push(`Generic composition differs between catalog (${resolvedIdentity.genericIngredient}) and recognition (${med.genericIngredient}).`);
        isUncertain = true;
      }
    }

    return {
      brandName: med.brandName || resolvedIdentity.brandName,
      genericIngredient: med.genericIngredient || resolvedIdentity.genericIngredient,
      interpretedName: `${med.brandName || resolvedIdentity.brandName} (${med.genericIngredient || resolvedIdentity.genericIngredient})`,
      rawRecognizedName: med.brandName || med.genericIngredient,
      strength: med.strength || resolvedIdentity.defaultStrength || 'As Prescribed',
      dosage: med.dosagePerAdministration || '1 Tablet',
      form: med.form || resolvedIdentity.form || 'Tablet',
      route: med.route || 'Oral',
      morningDose: med.morningDose !== undefined ? med.morningDose : parsedDosage.morningDose,
      afternoonDose: med.afternoonDose !== undefined ? med.afternoonDose : parsedDosage.afternoonDose,
      nightDose: med.nightDose !== undefined ? med.nightDose : parsedDosage.nightDose,
      frequency: med.frequency || parsedDosage.frequency,
      timing: med.timing || 'Take with water',
      timeSlots: parsedDosage.timeSlots,
      times: parsedDosage.times,
      duration: med.duration || '7 days',
      instructions: med.additionalInstructions || `${med.timing || 'After meals'}. Take with water.`,
      originalPrescriptionNotation: med.originalPrescriptionNotation || parsedDosage.frequency || '',
      isUncertain,
      uncertainReasons,
      confidence: med.confidence || 0.95,
      engine: 'GEMINI'
    };
  });

  return {
    engine: 'GEMINI',
    isFallback: false,
    model: modelUsed,
    classification: parsed.documentClassification || 'MEDICATION_PRESCRIPTION',
    classificationReason: parsed.classificationReason || 'Prescription evaluated by Gemini multimodal vision.',
    patientName: parsed.patientName || null,
    warnings,
    evidence: {
      doctorName: parsed.doctorName || 'Prescribing Physician',
      clinicName: parsed.clinicName || 'Medical Center / Clinic',
      rxDate: parsed.prescriptionDate || new Date().toISOString().split('T')[0],
      hasSignature: !!parsed.hasSignature
    },
    medicines: normalizedMedicines,
    qualityStatus: 'OPTIMAL',
    format: 'MIXED'
  };
}

/**
 * Perform Multimodal Medicine Strip & Blister Pack Analysis with Gemini API
 */
export async function analyzeStripWithGemini(imageBuffer, mimeType = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }

  const base64Data = imageBuffer.toString('base64');
  const candidates = getVisionModelCandidates();

  const { result: rawResponse, modelUsed } = await executeWithModelFallback(apiKey, candidates, async (ai, model) => {
    return await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType || 'image/jpeg'
              }
            },
            {
              text: GEMINI_STRIP_PROMPT
            }
          ]
        }
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: STRIP_SCHEMA
      }
    });
  });

  const rawOutput = rawResponse.text || '';
  let cleanJson = rawOutput.trim();
  if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
  if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
  if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
  cleanJson = cleanJson.trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    console.error('[Gemini Engine] Failed to parse strip JSON output:', cleanJson);
    throw new Error(`Invalid JSON returned from Gemini: ${err.message}`);
  }

  const crossCheck = crossCheckStripMedicine({
    brandName: parsed.brandName,
    genericIngredient: parsed.genericIngredient,
    strength: parsed.strength,
    form: parsed.form
  });

  return {
    engine: 'GEMINI',
    model: modelUsed,
    isReadable: parsed.isReadable !== false,
    unreadableReason: parsed.unreadableReason || null,
    brandName: (parsed.brandName || '').trim(),
    genericIngredient: (parsed.genericIngredient || '').trim(),
    strength: (parsed.strength || '').trim(),
    form: parsed.form || 'Tablet',
    manufacturer: parsed.manufacturer || null,
    batchNumber: parsed.batchNumber || null,
    expiryDate: parsed.expiryDate || null,
    storageNotes: parsed.storageNotes || null,
    rxOnly: !!parsed.rxOnly,
    confidences: parsed.confidences || {
      brandName: 0.9,
      genericIngredient: 0.85,
      strength: 0.9,
      form: 0.9,
      expiryDate: 0.8,
      batchNumber: 0.8
    },
    crossCheck
  };
}

/**
 * Estimate nutritional breakdown of a food item with Gemini API
 */
export async function estimateFoodNutritionWithGemini(foodName, quantity = 1, unit = 'serving') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY_NOT_CONFIGURED');
  }

  const userQuery = `Food item: "${foodName}", Quantity: ${quantity}, Unit: "${unit}". Calculate realistic nutrition.`;
  const candidates = getVisionModelCandidates();

  const { result: rawResponse } = await executeWithModelFallback(apiKey, candidates, async (ai, model) => {
    return await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: GEMINI_FOOD_PROMPT },
            { text: userQuery }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    });
  });

  const rawOutput = rawResponse.text || '';
  let cleanJson = rawOutput.trim();
  if (cleanJson.startsWith('```json')) cleanJson = cleanJson.slice(7);
  if (cleanJson.startsWith('```')) cleanJson = cleanJson.slice(3);
  if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);
  cleanJson = cleanJson.trim();

  let parsed = null;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    console.error('[Gemini Engine] Failed to parse food nutrition JSON:', cleanJson);
    throw new Error(`Invalid nutrition data returned from Gemini: ${err.message}`);
  }

  return {
    name: parsed.name || foodName,
    servingDescription: parsed.servingDescription || `${quantity} ${unit}`,
    calories: Math.round(Number(parsed.calories) || 0),
    protein: Math.round((Number(parsed.protein) || 0) * 10) / 10,
    carbs: Math.round((Number(parsed.carbs) || 0) * 10) / 10,
    fat: Math.round((Number(parsed.fat) || 0) * 10) / 10,
    fibre: Math.round((Number(parsed.fibre) || 0) * 10) / 10,
    estimated: true,
    source: 'gemini',
    notes: parsed.notes || 'Nutritional values estimated by Gemini'
  };
}
