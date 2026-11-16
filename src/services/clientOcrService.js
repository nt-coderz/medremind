/**
 * MedRemind Client-Side Offline OCR Service
 * 
 * Powered by Tesseract.js using bundled local assets.
 * Operates 100% offline without internet or backend server dependency.
 */

import { createWorker } from 'tesseract.js';
import { 
  resolveBrandAndGeneric, 
  parseDosageNotation, 
  DRUG_CATALOG, 
  isNonPrescriptionDocument,
  crossCheckStripMedicine
} from '../utils/drugKnowledgeBase';
import { processPdfDocument } from './pdfService';

let cachedWorker = null;

/**
 * Initializes and returns a cached Tesseract.js worker with offline configuration.
 */
async function getOfflineWorker(onProgress) {
  if (cachedWorker) {
    return cachedWorker;
  }

  // Configure worker using local bundled assets in /tesseract/
  const worker = await createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract',
    langPath: '/tesseract',
    gzip: false,
    logger: (m) => {
      if (typeof onProgress === 'function' && m.status) {
        const percent = Math.round((m.progress || 0) * 100);
        onProgress(`OCR: ${m.status} ${percent > 0 ? `(${percent}%)` : ''}`);
      }
    }
  });

  try {
    // PSM 6: Single uniform block of text (far superior for prescriptions than default 3)
    await worker.setParameters({
      tessedit_pageseg_mode: '6'
    });
  } catch (err) {
    console.warn('[Offline OCR] Worker parameter setup notice:', err);
  }

  cachedWorker = worker;
  return worker;
}

/**
 * Preprocesses image using HTML5 Canvas:
 * 1. Computes luminance distribution
 * 2. Detects blank / nearly blank pages
 * 3. Detects dark / underexposed pages
 * 4. Applies contrast enhancement and normalization for OCR clarity
 */
export async function preprocessImage(imageDataUrl) {
  return new Promise((resolve) => {
    // If running in headless test without DOM, resolve safely
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve({
        preprocessedDataUrl: imageDataUrl,
        isBlank: false,
        isDark: false,
        qualityNotes: []
      });
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // 1. Rescale small images so the long edge is ~1600-2200px for optimal OCR recognition
        const maxEdge = Math.max(img.width, img.height);
        let scale = 1;
        if (maxEdge < 1600 && maxEdge > 0) {
          scale = Math.min(2000 / maxEdge, 2.5);
        } else if (maxEdge > 2600) {
          scale = 2200 / maxEdge;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const numPixels = canvas.width * canvas.height;

        // Build luminance histogram for Otsu thresholding and statistics
        const hist = new Array(256).fill(0);
        let totalLuminance = 0;

        for (let i = 0; i < data.length; i += 4) {
          const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          hist[lum]++;
          totalLuminance += lum;
        }

        const avgLuminance = totalLuminance / numPixels;

        // Compute Otsu's optimal binarization/contrast threshold
        let sum = 0;
        for (let t = 0; t < 256; t++) sum += t * hist[t];
        let sumB = 0;
        let wB = 0;
        let wF = 0;
        let varMax = 0;
        let otsuThreshold = 128;

        for (let t = 0; t < 256; t++) {
          wB += hist[t];
          if (wB === 0) continue;
          wF = numPixels - wB;
          if (wF === 0) break;
          sumB += t * hist[t];
          const mB = sumB / wB;
          const mF = (sum - sumB) / wF;
          const varBetween = wB * wF * (mB - mF) * (mB - mF);
          if (varBetween > varMax) {
            varMax = varBetween;
            otsuThreshold = t;
          }
        }

        // Variance / std dev
        let sumSqDiff = 0;
        const step = Math.max(1, Math.floor(numPixels / 10000));
        let sampleCount = 0;
        for (let i = 0; i < data.length; i += 4 * step) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          sumSqDiff += Math.pow(lum - avgLuminance, 2);
          sampleCount++;
        }
        const stdDev = Math.sqrt(sumSqDiff / sampleCount);

        const isBlank = avgLuminance > 248 && stdDev < 8;
        const isDark = avgLuminance < 28;

        const qualityNotes = [];
        if (isBlank) qualityNotes.push('Blank or near-empty page detected');
        if (isDark) qualityNotes.push('Underexposed or very dark image');

        // Apply adaptive Otsu contrast stretching & stroke sharpening
        const contrastFactor = 1.35;
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          let adjusted = lum;
          if (lum < otsuThreshold) {
            // Dark stroke (doctor handwriting / printed ink): enhance darkness for crisp contours
            adjusted = Math.max(0, lum * 0.75);
          } else {
            // Background paper: stretch towards clean white
            adjusted = Math.min(255, ((lum - otsuThreshold) * contrastFactor) + otsuThreshold + 10);
          }

          data[i] = adjusted;
          data[i + 1] = adjusted;
          data[i + 2] = adjusted;
        }

        ctx.putImageData(imgData, 0, 0);

        resolve({
          preprocessedDataUrl: canvas.toDataURL('image/jpeg', 0.92),
          isBlank,
          isDark,
          avgLuminance,
          stdDev,
          otsuThreshold,
          qualityNotes
        });
      } catch (err) {
        console.warn('[Canvas Preprocessing] Warning:', err);
        resolve({
          preprocessedDataUrl: imageDataUrl,
          isBlank: false,
          isDark: false,
          qualityNotes: []
        });
      }
    };

    img.onerror = () => {
      resolve({
        preprocessedDataUrl: imageDataUrl,
        isBlank: false,
        isDark: false,
        qualityNotes: []
      });
    };

    img.src = imageDataUrl;
  });
}

/**
 * Clean and normalize text strings
 */
function cleanText(str) {
  return (str || '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Verify patient name match
 */
function verifyPatientMatch(extractedName, registeredName) {
  if (!extractedName || !extractedName.trim()) {
    return {
      status: 'ABSENT',
      match: true,
      displayTitle: 'No Patient Name Detected',
      reason: 'No explicit patient name identified on prescription.'
    };
  }

  const cExt = cleanText(extractedName).toLowerCase();
  const cReg = cleanText(registeredName).toLowerCase();

  if (cExt === cReg || cExt.includes(cReg) || cReg.includes(cExt)) {
    return {
      status: 'MATCH',
      match: true,
      displayTitle: 'Patient Name Matches Account',
      reason: `Prescription patient "${extractedName}" matches account profile.`
    };
  }

  return {
    status: 'MISMATCH',
    match: false,
    displayTitle: 'PATIENT NAME MISMATCH',
    reason: `Prescription appears to be for "${extractedName}", differing from account name "${registeredName}".`
  };
}

/**
 * Levenshtein distance for fuzzy drug catalog matching
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Extract duration from prescription text line (e.g. "x 5 days", "for 14 days")
 */
export function extractDuration(line) {
  const match = line.match(/(?:x|for)\s*(\d+)\s*(days?|weeks?|months?)/i) ||
                line.match(/\b(\d+)\s*(days?|weeks?|months?)\b/i);
  return match ? `${match[1]} ${match[2].toLowerCase()}` : '7 days';
}

const NON_MED_WORDS = new Set(['rx', 'rx:', 'dr', 'doctor', 'clinic', 'hospital', 'patient', 'name', 'age', 'sex', 'date']);

/**
 * Extracts structured medication items from raw OCR text
 * Combines full catalog matching (exact & Levenshtein fuzzy) with generic line parsing
 * across multiple lines per page with intelligent deduplication.
 */
export function extractMedicationsFromText(rawText) {
  if (!rawText) return [];
  const rawLines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const medications = [];
  const matchedLineIndices = new Set();
  const seenGenerics = new Set();

  // Sort catalog keys by length descending (longest phrases matched first)
  const sortedCatalogEntries = Object.entries(DRUG_CATALOG).sort((a, b) => b[0].length - a[0].length);

  const parsedLines = rawLines.map((original, idx) => {
    // Strip leading numbering or bullet markers (e.g. "1.", "2)", "-", "•")
    const clean = original.replace(/^[-*•\d.)\s]+/, '')
      .replace(/[^\w\s-./]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      index: idx,
      original,
      clean,
      lower: clean.toLowerCase()
    };
  }).filter(({ lower }) => !NON_MED_WORDS.has(lower) && !lower.startsWith('dr.') && !lower.startsWith('patient') && !lower.startsWith('pt:'));

  // Step 1: Catalog match (exact & fuzzy) across all lines
  for (const lineObj of parsedLines) {
    const { original, lower, index } = lineObj;
    const words = lower.split(/\s+/).filter(w => w.length > 0);

    let bestMatch = null;

    for (const [key, drug] of sortedCatalogEntries) {
      const keyWords = key.split(' ');
      let isMatch = false;
      let isFuzzy = false;
      let matchedPhrase = key;

      // Exact phrase match with word boundary
      const exactRegex = new RegExp(`(^|\\s)${key.replace('+', '\\+')}(\\s|$)`, 'i');
      if (exactRegex.test(lower)) {
        isMatch = true;
      } else if (keyWords.length === 1 && key.length >= 5) {
        // Fuzzy match single-word key against single words in line
        const maxDist = key.length <= 7 ? 1 : 2;
        for (const w of words) {
          if (/^\d+/.test(w) || w === 'tab' || w === 'cap' || w === 'syp') continue;
          if (Math.abs(w.length - key.length) > maxDist) continue;
          const dist = levenshteinDistance(w, key);
          if (dist <= maxDist && dist > 0) {
            isMatch = true;
            isFuzzy = true;
            matchedPhrase = w;
            break;
          }
        }
      }

      if (isMatch) {
        bestMatch = { key, drug, isFuzzy, matchedPhrase };
        break;
      }
    }

    if (bestMatch) {
      matchedLineIndices.add(index);
      const { key, drug, isFuzzy, matchedPhrase } = bestMatch;
      const genericKey = drug.generic.toLowerCase();

      if (!seenGenerics.has(genericKey)) {
        seenGenerics.add(genericKey);
        const dosageParsed = parseDosageNotation(original);
        const strengthMatch = original.match(/(\d+\s*(?:mg|mcg|gm|ml|iu))/i);
        const strength = strengthMatch ? strengthMatch[1].trim() : drug.defaultStrength;
        const duration = extractDuration(original);

        medications.push({
          rawRecognizedName: original,
          interpretedName: drug.generic,
          brandName: key.toUpperCase(),
          genericIngredient: drug.generic,
          strength,
          dosage: `1 ${drug.form}`,
          form: drug.form,
          route: 'Oral',
          morningDose: dosageParsed.morningDose,
          afternoonDose: dosageParsed.afternoonDose,
          nightDose: dosageParsed.nightDose,
          frequency: dosageParsed.frequency,
          timeSlots: dosageParsed.timeSlots,
          times: dosageParsed.times,
          instructions: dosageParsed.instructions,
          duration,
          isUncertain: isFuzzy,
          uncertainReasons: isFuzzy ? [`Fuzzy matched "${matchedPhrase}" to catalog drug "${key}"`] : []
        });
      }
    }
  }

  // Step 2: Generic line parser for all lines not matched in Step 1
  for (const lineObj of parsedLines) {
    if (matchedLineIndices.has(lineObj.index)) continue;
    const { original, lower } = lineObj;

    const isMedLine = /^(?:rx|tab|cap|syp|syr|inj)\b/i.test(lower) ||
                      /\b(?:\d+\s*mg|\d+\s*mcg|\d+\s*ml|\d+\s*tablet|\d+\s*cap)\b/i.test(lower) ||
                      /\b(?:1-0-1|1-1-1|0-1-0|0-0-1|1-0-0|od|bd|tds|qid|hs|sos)\b/i.test(lower);

    if (isMedLine) {
      const lineWithoutPrefix = lower.replace(/^(?:rx|tab\.?|cap\.?|syp\.?|syr\.?|inj\.?)\s*/i, '').trim();
      const tokens = lineWithoutPrefix.split(/\s+/);
      const potentialName = tokens[0] || 'Unknown';
      if (potentialName.length < 3 || /^\d+/.test(potentialName)) continue;

      const resolved = resolveBrandAndGeneric(original);
      const dosageParsed = parseDosageNotation(original);
      const strengthMatch = original.match(/(\d+\s*(?:mg|mcg|gm|ml|iu))/i);
      const strength = strengthMatch ? strengthMatch[1].trim() : (resolved.defaultStrength || 'As prescribed');
      const duration = extractDuration(original);

      const brand = resolved.brandName !== original ? resolved.brandName : (potentialName.charAt(0).toUpperCase() + potentialName.slice(1));
      const generic = resolved.genericIngredient !== original ? resolved.genericIngredient : brand;
      const genericKey = generic.toLowerCase();

      if (!seenGenerics.has(genericKey)) {
        seenGenerics.add(genericKey);
        medications.push({
          rawRecognizedName: original,
          interpretedName: resolved.genericIngredient ? `${brand} (${resolved.genericIngredient})` : brand,
          brandName: brand,
          genericIngredient: generic,
          strength,
          dosage: `1 ${resolved.form || 'Tablet'}`,
          form: resolved.form || 'Tablet',
          route: 'Oral',
          morningDose: dosageParsed.morningDose,
          afternoonDose: dosageParsed.afternoonDose,
          nightDose: dosageParsed.nightDose,
          frequency: dosageParsed.frequency,
          timeSlots: dosageParsed.timeSlots,
          times: dosageParsed.times,
          instructions: dosageParsed.instructions,
          duration,
          isUncertain: !resolved.isVerified,
          uncertainReasons: resolved.isVerified ? [] : ['Parsed from prescription pattern without catalog match']
        });
      }
    }
  }

  return medications;
}

/**
 * Execute client-side offline OCR on selected files
 */
export async function runClientOfflineOcr({ files, patientName = 'Patient', onProgress }) {
  if (!files || files.length === 0) {
    throw new Error('No files provided for offline OCR.');
  }

  onProgress?.('Initializing offline recognition engine...');
  const worker = await getOfflineWorker(onProgress);

  const documents = [];
  const batchId = `offline-batch-${Date.now()}`;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(`Processing document ${i + 1} of ${files.length}: ${file.name}...`);

    let rawText = '';
    let confidence = 80;
    let pagePreviews = [];
    let isBlank = false;
    let isDark = false;

    if (file.isPdf || file.type === 'application/pdf') {
      // Process PDF
      onProgress?.(`Extracting PDF pages for ${file.name}...`);
      const pdfRes = await processPdfDocument(file.dataUrl);
      pagePreviews = pdfRes.pages.map(p => ({
        pageNumber: p.pageNumber,
        imageUrl: p.dataUrl
      }));

      // Combine embedded digital text if present
      rawText += pdfRes.text + '\n';

      // OCR rendered pages
      for (const page of pdfRes.pages) {
        onProgress?.(`Preprocessing page ${page.pageNumber}...`);
        const preprocessed = await preprocessImage(page.dataUrl);
        if (preprocessed.isBlank) isBlank = true;
        if (preprocessed.isDark) isDark = true;

        onProgress?.(`Reading PDF page ${page.pageNumber}...`);
        const ocrRes = await worker.recognize(preprocessed.preprocessedDataUrl || page.dataUrl);
        rawText += (ocrRes.data?.text || '') + '\n';
        confidence = Math.round(ocrRes.data?.confidence || confidence);
      }
    } else {
      // Image file: apply canvas preprocessing
      onProgress?.(`Preprocessing image ${file.name}...`);
      const preprocessed = await preprocessImage(file.dataUrl);
      isBlank = preprocessed.isBlank;
      isDark = preprocessed.isDark;

      onProgress?.(`Reading document text with Tesseract...`);
      const ocrRes = await worker.recognize(preprocessed.preprocessedDataUrl || file.dataUrl);
      rawText = ocrRes.data?.text || '';
      confidence = Math.round(ocrRes.data?.confidence || 80);
      pagePreviews = [{ pageNumber: 1, imageUrl: preprocessed.preprocessedDataUrl || file.dataUrl }];
    }

    const cleanRaw = rawText.trim();

    // Check for patient name in text (e.g. "Patient: John Doe" or "Name: John Doe")
    let detectedPatient = null;
    const patMatch = cleanRaw.match(/(?:patient|pt|name|for):\s*([a-zA-Z\s.]+)/i);
    if (patMatch) {
      detectedPatient = patMatch[1].split(/[\n,;]/)[0].trim();
    }

    // Check for doctor/clinic
    let detectedDoctor = 'Licensed Physician';
    const docMatch = cleanRaw.match(/(?:dr\.|doctor)\s*([a-zA-Z\s.]+)/i);
    if (docMatch) {
      detectedDoctor = `Dr. ${docMatch[1].split(/[\n,;]/)[0].trim()}`;
    }

    const patientVerification = verifyPatientMatch(detectedPatient, patientName);
    const medicines = extractMedicationsFromText(cleanRaw);

    // Non-Prescription Document Rejection Check
    const isNonRx = isNonPrescriptionDocument(cleanRaw);

    let qualityStatus = 'OPTIMAL';
    let documentClassification = 'MEDICATION_PRESCRIPTION';
    let overallStatus = 'APPROVED';
    let processingDecision = 'CANDIDATE';
    const warnings = [];

    if (isBlank) {
      qualityStatus = 'BLANK_PAGE';
      documentClassification = 'BLANK_DOCUMENT';
      overallStatus = 'REJECTED';
      processingDecision = 'REJECT';
      warnings.push('Blank or near-empty page detected. Please scan a clear prescription.');
    } else if (isDark) {
      qualityStatus = 'DARK_PAGE';
      warnings.push('Image is dark or underexposed. Results may have reduced accuracy.');
    } else if (isNonRx) {
      documentClassification = 'NON_PRESCRIPTION_DOCUMENT';
      overallStatus = 'REJECTED';
      processingDecision = 'REJECT';
      warnings.push('Non-prescription document detected (e.g. bill, invoice, statement). Please upload an official doctor prescription.');
    } else if (confidence < 60) {
      qualityStatus = 'LOW_CONFIDENCE';
      warnings.push(`Low OCR confidence (${confidence}%). Please double-check recognized medicines.`);
    }

    if (medicines.length === 0 && !isBlank && !isNonRx) {
      documentClassification = 'CLINICAL_CONSULTATION_NOTE';
      overallStatus = 'PENDING_REVIEW';
      processingDecision = 'REVIEW';
    }

    documents.push({
      documentId: file.id || `doc-${Date.now()}-${i}`,
      fileName: file.name,
      fileType: file.type || 'image/jpeg',
      format: file.isPdf ? 'PDF' : 'IMAGE',
      pageCount: pagePreviews.length || 1,
      pages: pagePreviews,
      imageUrl: pagePreviews[0]?.imageUrl || file.dataUrl,
      sha256: file.sha256,
      documentClassification,
      qualityStatus,
      confidence,
      processingDecision,
      overallStatus,
      warnings,
      patientVerification,
      evidence: {
        doctorName: detectedDoctor,
        clinic: 'Medical Health Clinic',
        date: new Date().toISOString().split('T')[0],
        patientNameText: detectedPatient || 'None detected'
      },
      rawOcrText: cleanRaw,
      medicines,
      medicinesCount: medicines.length,
      engine: 'LOCAL_TESSERACT_OFFLINE'
    });
  }

  return {
    success: true,
    batchId,
    mode: 'OFFLINE',
    engine: 'LOCAL_TESSERACT',
    totalDocuments: documents.length,
    documents
  };
}

/**
 * Execute client-side offline OCR on a medicine strip or packaging image
 */
export async function runClientOfflineStripOcr({ imageDataUrl, onProgress }) {
  if (!imageDataUrl) {
    throw new Error('No strip image provided for offline OCR.');
  }

  onProgress?.('Initializing local OCR engine...');
  const worker = await getOfflineWorker(onProgress);

  onProgress?.('Enhancing packaging contrast...');
  const preprocessed = await preprocessImage(imageDataUrl);

  onProgress?.('Extracting packaging text with Tesseract...');
  const ocrRes = await worker.recognize(preprocessed.preprocessedDataUrl || imageDataUrl);
  const rawText = ocrRes.data?.text || '';
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // Extract strength
  const strengthMatch = rawText.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%))\b/i);
  const strength = strengthMatch ? strengthMatch[1] : '';

  // Extract form
  const formMatch = rawText.match(/\b(tablets?|capsules?|syrup|drops?|suspension|ointment|cream|gel|injection|cap|tab)\b/i);
  let form = 'Tablet';
  if (formMatch) {
    const rawForm = formMatch[1].toLowerCase();
    if (rawForm.startsWith('cap')) form = 'Capsule';
    else if (rawForm.startsWith('syr') || rawForm.includes('susp')) form = 'Syrup';
    else if (rawForm.startsWith('drop')) form = 'Drops';
    else if (rawForm.includes('oint') || rawForm.includes('gel') || rawForm.includes('cream')) form = 'Ointment';
    else if (rawForm.includes('inj')) form = 'Injection';
    else form = 'Tablet';
  }

  // Extract batch number
  const batchMatch = rawText.match(/\b(?:b(?:atch)?\.?\s*(?:no\.?|num)?|lot\.?\s*(?:no\.?)?)\s*[:.-]?\s*([a-zA-Z0-9/-]{3,20})\b/i);
  const batchNumber = batchMatch ? batchMatch[1] : '';

  // Extract expiry date
  const expMatch = rawText.match(/\b(?:exp(?:iry)?\.?\s*(?:date)?|use\s*before|val\b|valid\s*till)\s*[:.-]?\s*([0-9]{1,2}[/-][0-9]{2,4}|[A-Za-z]{3,9}[\s/-]*[0-9]{2,4}|[0-9]{4}[/-][0-9]{1,2})\b/i);
  const expiryDate = expMatch ? expMatch[1] : '';

  // Extract manufacturer
  const mfgMatch = rawText.match(/\b(?:mfg\.?\s*by|marketed\s*by|manufactured\s*by|mfd\s*by)\s*[:.-]?\s*([A-Za-z0-9\s.,&-]{3,40})/i);
  let manufacturer = mfgMatch ? mfgMatch[1].trim() : '';

  // Check storage notes
  const storageMatch = rawText.match(/store\s*(?:below|in|at|protected)[^\n.]{5,60}/i);
  const storageNotes = storageMatch ? storageMatch[0].trim() : '';

  // Check Rx Only
  const rxOnly = /schedule\s*h|rx\s*only|\brx\b/i.test(rawText);

  // Identify Brand and Generic
  let brandName = '';
  let genericIngredient = '';

  for (const line of lines) {
    const resolved = resolveBrandAndGeneric(line);
    if (resolved.isVerified) {
      brandName = resolved.brandName;
      genericIngredient = resolved.genericIngredient;
      if (!strength && resolved.defaultStrength) {
        // use catalog strength only if not extracted
      }
      break;
    }
  }

  // If brand not found via catalog line match, search catalog names in full text
  if (!brandName) {
    for (const [key, entry] of Object.entries(DRUG_CATALOG)) {
      if (rawText.toLowerCase().includes(key)) {
        brandName = key.charAt(0).toUpperCase() + key.slice(1);
        genericIngredient = entry.generic;
        break;
      }
    }
  }

  // Fallback: If still not identified, look for words near strength
  if (!brandName && strengthMatch && strengthMatch.index > 0) {
    const preceding = rawText.substring(Math.max(0, strengthMatch.index - 40), strengthMatch.index);
    const cleanWord = preceding.split(/[\n,;:]+/).pop()?.trim();
    if (cleanWord && cleanWord.length > 2 && !cleanWord.match(/batch|exp|mfg|tablet|capsule/i)) {
      brandName = cleanWord;
    }
  }

  const crossCheck = crossCheckStripMedicine({ brandName, genericIngredient, strength, form });

  const isReadable = lines.length > 0 && (brandName.length > 0 || genericIngredient.length > 0 || strength.length > 0);

  return {
    engine: 'LOCAL_TESSERACT_OFFLINE',
    isReadable,
    unreadableReason: isReadable ? null : 'Text on packaging could not be clearly resolved. Please check camera focus or enter manually.',
    brandName,
    genericIngredient,
    strength,
    form,
    manufacturer,
    batchNumber,
    expiryDate,
    storageNotes,
    rxOnly,
    confidences: {
      brandName: brandName ? (crossCheck.matched ? 0.85 : 0.6) : 0.2,
      genericIngredient: genericIngredient ? 0.8 : 0.2,
      strength: strength ? 0.85 : 0.2,
      form: 0.8,
      expiryDate: expiryDate ? 0.75 : 0.2,
      batchNumber: batchNumber ? 0.75 : 0.2
    },
    crossCheck,
    rawOcrText: rawText
  };
}

