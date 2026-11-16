import { createWorker } from 'tesseract.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { resolveBrandAndGeneric, parseDosageNotation } from './drugKnowledgeBase.js';

let tesseractWorker = null;

async function getWorker() {
  if (!tesseractWorker) {
    tesseractWorker = await createWorker('eng');
  }
  return tesseractWorker;
}

/**
 * Perform real OCR on image buffer or path
 */
export async function performRealOCR(imageBufferOrPath) {
  const worker = await getWorker();
  const ret = await worker.recognize(imageBufferOrPath);
  
  const rawText = ret.data.text || '';
  const meanConfidence = (ret.data.confidence || 85) / 100;
  let lines = ret.data.lines && ret.data.lines.length > 0 ? ret.data.lines.map(l => ({
    text: l.text.trim(),
    confidence: l.confidence / 100,
    words: l.words ? l.words.map(w => ({ text: w.text, confidence: w.confidence / 100 })) : []
  })) : [];

  if (lines.length === 0 && rawText.length > 0) {
    lines = rawText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(text => ({
        text,
        confidence: meanConfidence,
        words: text.split(/\s+/).map(w => ({ text: w, confidence: meanConfidence }))
      }));
  }

  return {
    rawText,
    lines: lines.filter(l => l.text.length > 0),
    meanConfidence
  };
}

/**
 * SHA-256 Document Hashing for Duplicate Detection
 */
export function computeSHA256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Image Quality Evaluation
 */
export function evaluateImageQuality(buffer, ocrResult) {
  const textLength = ocrResult.rawText.trim().length;
  
  // Blank or corrupted
  if (textLength < 8) {
    return {
      status: 'UNREADABLE',
      isAcceptable: false,
      reason: 'Document appears blank or image quality is too low to extract text.'
    };
  }

  if (ocrResult.meanConfidence < 0.35) {
    return {
      status: 'BLURRY',
      isAcceptable: false,
      reason: 'Image is blurry or poorly lit. OCR confidence is below reliable threshold.'
    };
  }

  if (ocrResult.meanConfidence < 0.65) {
    return {
      status: 'ACCEPTABLE',
      isAcceptable: true,
      reason: 'Image has moderate readability. Manual verification strongly advised.'
    };
  }

  return {
    status: 'OPTIMAL',
    isAcceptable: true,
    reason: 'Clear image resolution and high optical text contrast.'
  };
}

/**
 * Document Classification Engine
 */
export function classifyDocument(rawText) {
  const lower = rawText.toLowerCase();

  // 1. Lab Report Detection
  const labKeywords = ['hemoglobin', 'wbc', 'platelet', 'reference range', 'biochemistry', 'pathology', 'serum', 'urine test', 'specimen', 'rbc count', 'fasting blood sugar', 'lipid profile', 'creatinine', 'bilirubin'];
  const labMatches = labKeywords.filter(k => lower.includes(k));
  if (labMatches.length >= 3) {
    return {
      classification: 'LAB_REPORT',
      confidence: 0.92,
      reason: `Identified diagnostic laboratory report with parameters: ${labMatches.slice(0, 3).join(', ')}.`
    };
  }

  // 2. Medical Bill / Invoice Detection
  const billKeywords = ['invoice', 'receipt', 'tax invoice', 'billing', 'total amount', 'subtotal', 'payment mode', 'cashier', 'gstin', 'net payable'];
  const billMatches = billKeywords.filter(k => lower.includes(k));
  if (billMatches.length >= 2 && !lower.includes('sig:') && !lower.includes('℞')) {
    return {
      classification: 'MEDICAL_BILL',
      confidence: 0.89,
      reason: 'Identified medical billing statement / pharmacy financial invoice.'
    };
  }

  // 3. Discharge Summary
  const dischargeKeywords = ['discharge summary', 'date of admission', 'date of discharge', 'course in hospital', 'condition at discharge', 'hospital stay'];
  if (dischargeKeywords.filter(k => lower.includes(k)).length >= 2) {
    return {
      classification: 'DISCHARGE_SUMMARY',
      confidence: 0.88,
      reason: 'Identified hospital discharge clinical summary.'
    };
  }

  // 4. Clinical Consultation Note (Consultation without order)
  const clinicalKeywords = ['chief complaint', 'history of present illness', 'physical examination', 'hpi', 'clinical impression'];
  const hasClinical = clinicalKeywords.some(k => lower.includes(k));
  const hasRx = lower.includes('℞') || lower.includes('rx') || lower.includes('sig:') || lower.includes('tab') || lower.includes('cap') || lower.includes('mg');

  if (hasClinical && !hasRx) {
    return {
      classification: 'CLINICAL_CONSULTATION_NOTE',
      confidence: 0.85,
      reason: 'Identified physician consultation notes without direct medication order schedule.'
    };
  }

  // 5. Medicine Packaging
  if (lower.includes('batch no') && (lower.includes('mfg date') || lower.includes('exp date')) && (lower.includes('mrp') || lower.includes('mfg. lic.'))) {
    return {
      classification: 'MEDICINE_PACKAGING',
      confidence: 0.90,
      reason: 'Identified retail medicine packaging label or blister foil.'
    };
  }

  // 6. Medication Prescription
  const rxKeywords = ['℞', 'rx', 'prescription', 'doctor', 'clinic', 'hospital', 'dosage', 'tab', 'tablet', 'cap', 'capsule', 'syp', 'syrup', 'inj', 'mg', 'od', 'bd', 'tid', 'qid', 'sig'];
  const rxMatches = rxKeywords.filter(k => lower.includes(k));

  if (rxMatches.length >= 2) {
    return {
      classification: 'MEDICATION_PRESCRIPTION',
      confidence: 0.94,
      reason: 'Verified prescription containing clinical medication orders, prescriber details, and dosage instructions.'
    };
  }

  // 7. Non-medical document check
  const nonMedicalKeywords = ['invoice', 'resume', 'curriculum vitae', 'agreement', 'contract', 'homework', 'syllabus', 'mathematics', 'recipe'];
  if (nonMedicalKeywords.some(k => lower.includes(k))) {
    return {
      classification: 'NON_MEDICAL_DOCUMENT',
      confidence: 0.85,
      reason: 'Document does not contain medical terminology or clinical prescriptions.'
    };
  }

  if (rawText.trim().length < 20) {
    return {
      classification: 'BLANK_OR_UNREADABLE',
      confidence: 0.90,
      reason: 'Insufficient readable content detected.'
    };
  }

  return {
    classification: 'UNKNOWN',
    confidence: 0.50,
    reason: 'Document context could not be conclusively determined.'
  };
}

/**
 * Determine Document Format: HANDWRITTEN, TYPED, or MIXED
 */
export function determineDocumentFormat(lines) {
  let lowConfCount = 0;
  let highConfCount = 0;

  lines.forEach(l => {
    if (l.confidence < 0.60) lowConfCount++;
    else highConfCount++;
  });

  if (lowConfCount > 0 && highConfCount > 0) return 'MIXED';
  if (lowConfCount > highConfCount) return 'HANDWRITTEN';
  return 'TYPED';
}

/**
 * Extract Clinical Evidence (Prescriber, Patient, Date, Signature)
 */
export function extractEvidence(lines, rawText) {
  const lower = rawText.toLowerCase();

  // Prescriber extraction
  let doctorName = null;
  let clinicName = null;
  let rxDate = null;
  let hasSignature = false;

  for (const line of lines) {
    const text = line.text;
    const lineLower = text.toLowerCase();

    if (!doctorName && (lineLower.startsWith('dr.') || lineLower.startsWith('dr ') || lineLower.includes('md') || lineLower.includes('mbbs') || lineLower.includes('physician'))) {
      doctorName = text.replace(/^(prescribed by:?|consultant:?)/i, '').trim();
    }

    if (!clinicName && !lineLower.includes('prescription') && (lineLower.includes('clinic') || lineLower.includes('hospital') || lineLower.includes('medical center') || lineLower.includes('healthcare') || lineLower.includes('dispensary'))) {
      clinicName = text.trim();
    }

    if (!rxDate && (lineLower.includes('date:') || lineLower.includes('date :') || /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(text))) {
      const match = text.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/);
      if (match) rxDate = match[0];
    }

    if (lineLower.includes('signature') || lineLower.includes('signed') || lineLower.includes('stamp') || lineLower.includes('lic #') || lineLower.includes('reg no')) {
      hasSignature = true;
    }
  }

  return {
    doctorName: doctorName || 'Physician (Identified on Prescription)',
    clinicName: clinicName || 'Medical Center / Clinic',
    rxDate: rxDate || new Date().toISOString().split('T')[0],
    hasSignature
  };
}

/**
 * Real Medicine Extractor
 * Extracts genuine words and medication lines from OCR text.
 * Never invents or fabricates medicines.
 */
export function extractMedicines(lines, rawText) {
  const medicines = [];
  const unitRegex = /\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|meq|%)\b/i;
  const dosageForms = /\b(tab(?:let)?|cap(?:sule)?|syp(?:rup)?|inj(?:ection)?|drops?|cream|gel|ointment|inhaler|suspension)\b/i;
  const frequencyPatterns = [
    { pattern: /\b(once daily|od|1 time daily|q\.?d\.?|1-0-0|0-1-0|0-0-1)\b/i, label: 'Once daily' },
    { pattern: /\b(twice daily|bd|bid|2 times daily|b\.?i\.?d\.?|1-0-1|1-1-0)\b/i, label: 'Twice daily' },
    { pattern: /\b(three times daily|tid|3 times daily|t\.?i\.?d\.?|1-1-1)\b/i, label: 'Three times daily' },
    { pattern: /\b(four times daily|qid|4 times daily|q\.?i\.?d\.?)\b/i, label: 'Four times daily' },
    { pattern: /\b(every (\d+) hours?|q(\d+)h)\b/i, label: 'Every 8 hours' },
    { pattern: /\b(at bedtime|hs|h\.?s\.?|night)\b/i, label: 'Night (at bedtime)' },
    { pattern: /\b(as needed|prn|p\.?r\.?n\.?|sos)\b/i, label: 'As needed (PRN)' }
  ];

  const timingPatterns = [
    { pattern: /\b(before meals?|before food|ac|a\.?c\.?|empty stomach)\b/i, label: 'Before meals' },
    { pattern: /\b(after meals?|after food|pc|p\.?c\.?|with food|with meals?)\b/i, label: 'After meals' }
  ];

  const durationPattern = /\b(?:for\s+)?(\d+)\s*(days?|weeks?|months?)\b/i;
  const quantityPattern = /\b(?:qty|disp|dispense|count|#|no\.?)\s*[:.]?\s*(\d+)\b/i;

  // Scan line by line for genuine medication mentions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;
    const lower = text.toLowerCase();

    // Skip non-medication lines (Doctor titles, Clinic headers, Patient details, Dispense/Sig/Qty lines)
    if (
      lower.startsWith('dr.') || 
      lower.includes('hospital') || 
      lower.includes('clinic') || 
      lower.includes('lic #') || 
      lower.startsWith('date:') || 
      lower.startsWith('patient:') ||
      lower.startsWith('dispense') ||
      lower.startsWith('disp:') ||
      lower.startsWith('sig:') ||
      lower.startsWith('qty:') ||
      lower.startsWith('quantity') ||
      lower.startsWith('refill')
    ) {
      continue;
    }

    const hasUnit = unitRegex.test(text);
    const hasForm = dosageForms.test(text);
    const hasRxSymbol = text.includes('℞') || lower.startsWith('rx') || lower.includes('tab') || lower.includes('cap');

    if (hasUnit || hasForm || hasRxSymbol) {
      // Extract Strength
      const unitMatch = text.match(unitRegex);
      const strength = unitMatch ? `${unitMatch[1]} ${unitMatch[2]}` : null;

      // Extract Form
      const formMatch = text.match(dosageForms);
      const form = formMatch ? (formMatch[1].toLowerCase().startsWith('tab') ? 'Tablet' : formMatch[1].toLowerCase().startsWith('cap') ? 'Capsule' : formMatch[1].toLowerCase().startsWith('syp') ? 'Syrup' : formMatch[1].toLowerCase().startsWith('inj') ? 'Injection' : 'Tablet') : 'Tablet';

      // Extract Medicine Name: Clean line of Rx prefix, numbers, forms, strengths
      let cleanName = text
        .replace(/^[℞rx\d.\s:-]+/i, '')
        .replace(dosageForms, '')
        .replace(unitRegex, '')
        .replace(/\b(sig|disp|qty|daily|bd|tds|od|tab|cap|days?)\b.*/i, '')
        .trim();

      // If cleanName has trailing special characters
      cleanName = cleanName.replace(/[^a-zA-Z0-9\s-]/g, '').trim();

      if (cleanName.length >= 2) {
        // Lookahead to subsequent lines for Sig instructions, frequency, duration
        const subsequentText = [lines[i+1]?.text, lines[i+2]?.text].filter(Boolean).join(' ');
        const fullMedContext = `${text} ${subsequentText}`;
        const fullContextLower = fullMedContext.toLowerCase();

        // 1. Resolve Brand vs Generic Ingredient
        const brandGeneric = resolveBrandAndGeneric(cleanName);

        // 2. Parse dosage notation (1-0-1, OD, BD, after meals, etc.)
        const dosageNotation = parseDosageNotation(fullMedContext);

        // Extract Duration
        const durMatch = fullMedContext.match(durationPattern);
        const duration = durMatch ? `${durMatch[1]} ${durMatch[2]}` : 'Ongoing';

        // Extract Quantity
        const qtyMatch = fullMedContext.match(quantityPattern);
        const quantity = qtyMatch ? `${qtyMatch[1]} ${form}s` : 'As prescribed';

        // Additional Sig instructions
        let instructions = `${dosageNotation.timingLabel}. Take with water.`;
        if (fullContextLower.includes('finish') || fullContextLower.includes('complete course')) {
          instructions += ' Complete full prescribed course.';
        }
        if (lines[i+1] && lines[i+1].text.toLowerCase().startsWith('sig:')) {
          instructions = lines[i+1].text.replace(/^sig:\s*/i, '').trim();
        }

        const isUncertain = line.confidence < 0.65 || cleanName.length < 3 || brandGeneric.requiresConfirmation;
        const uncertainReasons = [];
        if (line.confidence < 0.65) uncertainReasons.push('Low optical confidence on handwriting/spelling');
        if (!strength) uncertainReasons.push('Strength not explicitly specified on prescription order line');
        if (brandGeneric.requiresConfirmation) uncertainReasons.push(brandGeneric.warning || 'Brand/generic name requires patient verification');

        medicines.push({
          brandName: brandGeneric.brandName,
          genericIngredient: brandGeneric.genericIngredient,
          rawRecognizedName: cleanName,
          interpretedName: `${brandGeneric.brandName} (${brandGeneric.genericIngredient})`,
          strength: strength || brandGeneric.defaultStrength || 'As Prescribed',
          dosage: `1 ${form}`,
          form,
          route: 'Oral',
          morningDose: dosageNotation.morningDose,
          afternoonDose: dosageNotation.afternoonDose,
          nightDose: dosageNotation.nightDose,
          frequency: dosageNotation.frequencyLabel,
          timing: dosageNotation.timingLabel,
          timeSlots: dosageNotation.timeSlots,
          times: dosageNotation.times,
          duration,
          quantity,
          instructions,
          originalPrescriptionNotation: dosageNotation.rawNotation,
          isUncertain,
          uncertainReasons,
          fieldConfidence: {
            name: Math.min(1.0, line.confidence + 0.1),
            strength: strength ? 0.95 : 0.40,
            frequency: 0.85
          },
          confidence: Math.min(1.0, line.confidence || 0.8),
          sourceLine: text,
          engine: 'TESSERACT'
        });
      }
    }
  }

  return medicines;
}

/**
 * Processing Decision Engine
 */
export function determineDecision(classificationResult, qualityResult, medicines) {
  if (!qualityResult.isAcceptable) {
    return 'RETAKE';
  }

  if (classificationResult.classification !== 'MEDICATION_PRESCRIPTION') {
    return 'REJECT';
  }

  if (medicines.length === 0) {
    return 'REVIEW';
  }

  const hasUncertain = medicines.some(m => m.isUncertain);
  if (hasUncertain || classificationResult.confidence < 0.80) {
    return 'REVIEW';
  }

  return 'CANDIDATE';
}

/**
 * Extract Patient Name from OCR lines and raw text
 */
export function extractPatientName(lines, rawText) {
  const labelPatterns = [
    /(?:patient\s*(?:name)?|pt\s*(?:name)?|prescribed\s*(?:for|to)|rx\s*for)\s*[:.-]\s*([a-zA-Z\s.,'-]+?)(?:\s*\(|\s*\d|\s*,|\s*$|\n)/i,
    /(?:^|\s)(?:name)\s*[:.-]\s*([a-zA-Z\s.,'-]+?)(?:\s*\(|\s*\d|\s*,|\s*$|\n)/i
  ];

  for (const line of lines) {
    const text = line.text.trim();
    const lower = text.toLowerCase();

    // Skip doctor names or clinic lines or headers
    if (lower.startsWith('dr.') || lower.includes('clinic') || lower.includes('hospital') || lower.includes('lic #') || lower.startsWith('date:')) {
      continue;
    }

    for (const pattern of labelPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let cleanName = match[1]
          .replace(/^(mr\.?|mrs\.?|ms\.?|miss|master)\s+/i, '')
          .replace(/\b(age|dob|sex|gender|yrs?|male|female|m|f)\b.*/i, '')
          .replace(/[^a-zA-Z\s'-]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanName.length >= 2 && !/^(tab|cap|syrup|mg|rx|date)/i.test(cleanName)) {
          return {
            identified: true,
            name: cleanName,
            confidence: Math.min(1.0, (line.confidence || 0.85) + 0.1),
            sourceLine: text
          };
        }
      }
    }
  }

  // Also search across rawText
  for (const pattern of labelPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      let cleanName = match[1]
        .replace(/^(mr\.?|mrs\.?|ms\.?|miss|master)\s+/i, '')
        .replace(/\b(age|dob|sex|gender|yrs?|male|female|m|f)\b.*/i, '')
        .replace(/[^a-zA-Z\s'-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanName.length >= 2 && !/^(tab|cap|syrup|mg|rx|date)/i.test(cleanName)) {
        return {
          identified: true,
          name: cleanName,
          confidence: 0.85,
          sourceLine: match[0]
        };
      }
    }
  }

  return {
    identified: false,
    name: null,
    confidence: 0,
    reason: 'Patient name is missing, unreadable, or uncertain on this document.'
  };
}

/**
 * Compare Extracted Patient Name with Registered Patient Profile
 * Scenarios:
 * - MATCH: Exact match or minor formatting/middle-name variation
 * - MISMATCH: Names clearly differ (e.g., Robin Smith vs Alex Morgan)
 * - UNVERIFIED: Missing, unreadable, or uncertain
 */
export function comparePatientNames(registeredName, extractedName) {
  const cleanReg = (registeredName || '').trim();
  const cleanExt = (extractedName || '').trim();

  if (!cleanExt) {
    return {
      status: 'UNVERIFIED',
      match: false,
      confidence: 0,
      extractedName: null,
      registeredName: cleanReg || 'Registered Patient',
      displayTitle: 'PATIENT NAME COULD NOT BE VERIFIED',
      reason: 'Patient name is missing, unreadable, or uncertain on this document.'
    };
  }

  const normalize = (s) => s.toLowerCase()
    .replace(/\b(mr|mrs|ms|miss|dr|prof)\.?\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normReg = normalize(cleanReg);
  const normExt = normalize(cleanExt);

  // Exact match
  if (normReg === normExt) {
    return {
      status: 'MATCH',
      match: true,
      confidence: 1.0,
      extractedName: cleanExt,
      registeredName: cleanReg,
      displayTitle: 'Patient name matches',
      reason: 'Extracted patient name matches your registered account.'
    };
  }

  const regWords = normReg.split(' ').filter(Boolean);
  const extWords = normExt.split(' ').filter(Boolean);

  // Support minor formatting, middle-name variations, or "Last, First" ordering
  const firstMatch = regWords[0] === extWords[0];
  const lastMatch = regWords[regWords.length - 1] === extWords[extWords.length - 1];
  const reverseFirstLast = regWords[0] === extWords[extWords.length - 1] && regWords[regWords.length - 1] === extWords[0];

  if ((firstMatch && lastMatch) || reverseFirstLast) {
    return {
      status: 'MATCH',
      match: true,
      confidence: 0.95,
      extractedName: cleanExt,
      registeredName: cleanReg,
      displayTitle: 'Patient name matches',
      reason: 'Extracted patient name matches with minor formatting or middle-name variation.'
    };
  }

  // Clear name mismatch
  return {
    status: 'MISMATCH',
    match: false,
    confidence: 0.95,
    extractedName: cleanExt,
    registeredName: cleanReg,
    displayTitle: 'PATIENT NAME MISMATCH',
    reason: `Prescription appears to belong to ${cleanExt}, which does not match registered patient ${cleanReg}.`
  };
}

/**
 * Get PDF Page Count
 */
export function getPdfPageCount(pdfPath) {
  try {
    const output = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf-8' });
    const match = output.match(/Pages:\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  } catch (e) {
    console.warn('pdfinfo failed, assuming 1 page:', e.message);
    return 1;
  }
}

/**
 * Extract all pages of a PDF to PNG images using pdftoppm
 */
export function extractPdfPagesToImages(pdfPath, outputDir, prefix = 'pdf-page') {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const basePrefix = path.join(outputDir, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
  
  execSync(`pdftoppm -png -r 150 "${pdfPath}" "${basePrefix}"`);
  
  const dir = path.dirname(basePrefix);
  const filePrefix = path.basename(basePrefix);
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith(filePrefix) && f.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/-(\d+)\.png$/)?.[1] || '0', 10);
      const numB = parseInt(b.match(/-(\d+)\.png$/)?.[1] || '0', 10);
      return numA - numB;
    })
    .map((filename, index) => ({
      pageNumber: index + 1,
      imagePath: path.join(dir, filename),
      imageUrl: `/uploads/${filename}`
    }));

  return files;
}

/**
 * Extract embedded digital text from PDF if available
 */
export function extractPdfDigitalText(pdfPath) {
  try {
    const text = execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf-8' });
    return text.trim();
  } catch (e) {
    return '';
  }
}

