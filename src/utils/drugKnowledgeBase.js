/**
 * MedRemind Intelligent Drug Reference & Dosage Interpretation Engine (Client-Side)
 * Resolves Brand Name <-> Generic Ingredient relationships and medical shorthand notations.
 * 100% Offline with zero external dependencies.
 */

export const DRUG_CATALOG = {
  // Paracetamol / Acetaminophen Brands
  'p-650': { generic: 'Paracetamol', defaultStrength: '650 mg', form: 'Tablet', class: 'Analgesic / Antipyretic' },
  'dolo 650': { generic: 'Paracetamol', defaultStrength: '650 mg', form: 'Tablet', class: 'Analgesic / Antipyretic' },
  'dolo': { generic: 'Paracetamol', defaultStrength: '650 mg', form: 'Tablet', class: 'Analgesic / Antipyretic' },
  'calpol': { generic: 'Paracetamol', defaultStrength: '500 mg', form: 'Tablet', class: 'Analgesic / Antipyretic' },
  'crocin': { generic: 'Paracetamol', defaultStrength: '500 mg', form: 'Tablet', class: 'Analgesic / Antipyretic' },
  'crocin 650': { generic: 'Paracetamol', defaultStrength: '650 mg', form: 'Tablet', class: 'Analgesic / Antipyretic' },
  'tylenol': { generic: 'Acetaminophen (Paracetamol)', defaultStrength: '500 mg', form: 'Tablet', class: 'Analgesic / Antipyretic' },
  'panadol': { generic: 'Paracetamol', defaultStrength: '500 mg', form: 'Tablet', class: 'Analgesic / Antipyretic' },
  'paracetamol': { generic: 'Paracetamol', defaultStrength: '500 mg', form: 'Tablet', class: 'Analgesic / Antipyretic' },

  // Antibiotics
  'augmentin': { generic: 'Amoxicillin + Potassium Clavulanate', defaultStrength: '625 mg', form: 'Tablet', class: 'Broad-Spectrum Penicillin Antibiotic' },
  'amoxil': { generic: 'Amoxicillin', defaultStrength: '500 mg', form: 'Capsule', class: 'Penicillin Antibiotic' },
  'amoxicillin': { generic: 'Amoxicillin', defaultStrength: '500 mg', form: 'Capsule', class: 'Penicillin Antibiotic' },
  'mox': { generic: 'Amoxicillin', defaultStrength: '500 mg', form: 'Capsule', class: 'Penicillin Antibiotic' },
  'zithromax': { generic: 'Azithromycin', defaultStrength: '500 mg', form: 'Tablet', class: 'Macrolide Antibiotic' },
  'azithral': { generic: 'Azithromycin', defaultStrength: '500 mg', form: 'Tablet', class: 'Macrolide Antibiotic' },
  'azithromycin': { generic: 'Azithromycin', defaultStrength: '500 mg', form: 'Tablet', class: 'Macrolide Antibiotic' },
  'cifran': { generic: 'Ciprofloxacin', defaultStrength: '500 mg', form: 'Tablet', class: 'Fluoroquinolone Antibiotic' },
  'ciprogut': { generic: 'Ciprofloxacin', defaultStrength: '500 mg', form: 'Tablet', class: 'Fluoroquinolone Antibiotic' },
  'ciprofloxacin': { generic: 'Ciprofloxacin', defaultStrength: '500 mg', form: 'Tablet', class: 'Fluoroquinolone Antibiotic' },
  'taxim-o': { generic: 'Cefixime', defaultStrength: '200 mg', form: 'Tablet', class: 'Cephalosporin Antibiotic' },
  'zifi': { generic: 'Cefixime', defaultStrength: '200 mg', form: 'Tablet', class: 'Cephalosporin Antibiotic' },
  'cefixime': { generic: 'Cefixime', defaultStrength: '200 mg', form: 'Tablet', class: 'Cephalosporin Antibiotic' },
  'doxycycline': { generic: 'Doxycycline', defaultStrength: '100 mg', form: 'Capsule', class: 'Tetracycline Antibiotic' },
  'doxicip': { generic: 'Doxycycline', defaultStrength: '100 mg', form: 'Capsule', class: 'Tetracycline Antibiotic' },
  'flagyl': { generic: 'Metronidazole', defaultStrength: '400 mg', form: 'Tablet', class: 'Antiprotozoal / Antibacterial' },
  'metrogyl': { generic: 'Metronidazole', defaultStrength: '400 mg', form: 'Tablet', class: 'Antiprotozoal / Antibacterial' },

  // Antidiabetic
  'glucophage': { generic: 'Metformin', defaultStrength: '500 mg', form: 'Tablet', class: 'Biguanide Antidiabetic' },
  'glycomet': { generic: 'Metformin', defaultStrength: '500 mg', form: 'Tablet', class: 'Biguanide Antidiabetic' },
  'glycomet gp': { generic: 'Metformin + Glimepiride', defaultStrength: '500 mg / 1 mg', form: 'Tablet', class: 'Antidiabetic Combination' },
  'metformin': { generic: 'Metformin', defaultStrength: '500 mg', form: 'Tablet', class: 'Biguanide Antidiabetic' },
  'amaryl': { generic: 'Glimepiride', defaultStrength: '2 mg', form: 'Tablet', class: 'Sulfonylurea Antidiabetic' },
  'glimepiride': { generic: 'Glimepiride', defaultStrength: '2 mg', form: 'Tablet', class: 'Sulfonylurea Antidiabetic' },
  'forxiga': { generic: 'Dapagliflozin', defaultStrength: '10 mg', form: 'Tablet', class: 'SGLT2 Inhibitor' },
  'dapagliflozin': { generic: 'Dapagliflozin', defaultStrength: '10 mg', form: 'Tablet', class: 'SGLT2 Inhibitor' },

  // Cardiovascular / Blood Pressure / Cholesterol
  'lipitor': { generic: 'Atorvastatin', defaultStrength: '20 mg', form: 'Tablet', class: 'HMG-CoA Reductase Inhibitor' },
  'atorva': { generic: 'Atorvastatin', defaultStrength: '20 mg', form: 'Tablet', class: 'HMG-CoA Reductase Inhibitor' },
  'atorvastatin': { generic: 'Atorvastatin', defaultStrength: '20 mg', form: 'Tablet', class: 'HMG-CoA Reductase Inhibitor' },
  'crestor': { generic: 'Rosuvastatin', defaultStrength: '10 mg', form: 'Tablet', class: 'HMG-CoA Reductase Inhibitor' },
  'rosuvas': { generic: 'Rosuvastatin', defaultStrength: '10 mg', form: 'Tablet', class: 'HMG-CoA Reductase Inhibitor' },
  'rosuvastatin': { generic: 'Rosuvastatin', defaultStrength: '10 mg', form: 'Tablet', class: 'HMG-CoA Reductase Inhibitor' },
  'norvasc': { generic: 'Amlodipine', defaultStrength: '5 mg', form: 'Tablet', class: 'Calcium Channel Blocker' },
  'amlong': { generic: 'Amlodipine', defaultStrength: '5 mg', form: 'Tablet', class: 'Calcium Channel Blocker' },
  'amlodipine': { generic: 'Amlodipine', defaultStrength: '5 mg', form: 'Tablet', class: 'Calcium Channel Blocker' },
  'telma': { generic: 'Telmisartan', defaultStrength: '40 mg', form: 'Tablet', class: 'Angiotensin Receptor Blocker' },
  'telmisartan': { generic: 'Telmisartan', defaultStrength: '40 mg', form: 'Tablet', class: 'Angiotensin Receptor Blocker' },
  'losar': { generic: 'Losartan', defaultStrength: '50 mg', form: 'Tablet', class: 'Angiotensin Receptor Blocker' },
  'losartan': { generic: 'Losartan', defaultStrength: '50 mg', form: 'Tablet', class: 'Angiotensin Receptor Blocker' },
  'betaloc': { generic: 'Metoprolol Succinate', defaultStrength: '25 mg', form: 'Tablet', class: 'Beta-1 Blocker' },
  'metoprolol': { generic: 'Metoprolol', defaultStrength: '25 mg', form: 'Tablet', class: 'Beta-1 Blocker' },
  'zestril': { generic: 'Lisinopril', defaultStrength: '10 mg', form: 'Tablet', class: 'ACE Inhibitor' },
  'lisinopril': { generic: 'Lisinopril', defaultStrength: '10 mg', form: 'Tablet', class: 'ACE Inhibitor' },

  // Gastrointestinal / Antacid / Reflux
  'pan 40': { generic: 'Pantoprazole', defaultStrength: '40 mg', form: 'Tablet', class: 'Proton Pump Inhibitor' },
  'pantocid': { generic: 'Pantoprazole', defaultStrength: '40 mg', form: 'Tablet', class: 'Proton Pump Inhibitor' },
  'pantoprazole': { generic: 'Pantoprazole', defaultStrength: '40 mg', form: 'Tablet', class: 'Proton Pump Inhibitor' },
  'prilosec': { generic: 'Omeprazole', defaultStrength: '20 mg', form: 'Delayed-Release Capsule', class: 'Proton Pump Inhibitor' },
  'omez': { generic: 'Omeprazole', defaultStrength: '20 mg', form: 'Capsule', class: 'Proton Pump Inhibitor' },
  'omeprazole': { generic: 'Omeprazole', defaultStrength: '20 mg', form: 'Capsule', class: 'Proton Pump Inhibitor' },
  'razo 20': { generic: 'Rabeprazole', defaultStrength: '20 mg', form: 'Tablet', class: 'Proton Pump Inhibitor' },
  'rabeprazole': { generic: 'Rabeprazole', defaultStrength: '20 mg', form: 'Tablet', class: 'Proton Pump Inhibitor' },
  'nexpro': { generic: 'Esomeprazole', defaultStrength: '40 mg', form: 'Tablet', class: 'Proton Pump Inhibitor' },
  'esomeprazole': { generic: 'Esomeprazole', defaultStrength: '40 mg', form: 'Tablet', class: 'Proton Pump Inhibitor' },
  'emeset': { generic: 'Ondansetron', defaultStrength: '4 mg', form: 'Tablet', class: 'Antiemetic' },
  'ondansetron': { generic: 'Ondansetron', defaultStrength: '4 mg', form: 'Tablet', class: 'Antiemetic' },

  // Pain / NSAID
  'combiflam': { generic: 'Ibuprofen + Paracetamol', defaultStrength: '400 mg / 325 mg', form: 'Tablet', class: 'NSAID / Analgesic Combination' },
  'brufen': { generic: 'Ibuprofen', defaultStrength: '400 mg', form: 'Tablet', class: 'NSAID' },
  'ibuprofen': { generic: 'Ibuprofen', defaultStrength: '400 mg', form: 'Tablet', class: 'NSAID' },
  'voveran': { generic: 'Diclofenac', defaultStrength: '50 mg', form: 'Tablet', class: 'NSAID' },
  'diclofenac': { generic: 'Diclofenac', defaultStrength: '50 mg', form: 'Tablet', class: 'NSAID' },
  'zerodol': { generic: 'Aceclofenac', defaultStrength: '100 mg', form: 'Tablet', class: 'NSAID' },
  'aceclofenac': { generic: 'Aceclofenac', defaultStrength: '100 mg', form: 'Tablet', class: 'NSAID' },

  // Allergy / Respiratory
  'cetzine': { generic: 'Cetirizine', defaultStrength: '10 mg', form: 'Tablet', class: 'Antihistamine' },
  'cetirizine': { generic: 'Cetirizine', defaultStrength: '10 mg', form: 'Tablet', class: 'Antihistamine' },
  'levocet': { generic: 'Levocetirizine', defaultStrength: '5 mg', form: 'Tablet', class: 'Second-Generation Antihistamine' },
  'levocetirizine': { generic: 'Levocetirizine', defaultStrength: '5 mg', form: 'Tablet', class: 'Second-Generation Antihistamine' },
  'montair': { generic: 'Montelukast', defaultStrength: '10 mg', form: 'Tablet', class: 'Leukotriene Receptor Antagonist' },
  'montelukast': { generic: 'Montelukast', defaultStrength: '10 mg', form: 'Tablet', class: 'Leukotriene Receptor Antagonist' },
  'asthalin': { generic: 'Salbutamol (Albuterol)', defaultStrength: '100 mcg', form: 'Inhaler', class: 'Bronchodilator' },
  'salbutamol': { generic: 'Salbutamol', defaultStrength: '4 mg', form: 'Tablet', class: 'Bronchodilator' },

  // Thyroid & Endocrine
  'thyronorm': { generic: 'Levothyroxine Sodium', defaultStrength: '50 mcg', form: 'Tablet', class: 'Synthetic Thyroid Hormone' },
  'eltroxin': { generic: 'Levothyroxine Sodium', defaultStrength: '50 mcg', form: 'Tablet', class: 'Synthetic Thyroid Hormone' },
  'levothyroxine': { generic: 'Levothyroxine', defaultStrength: '50 mcg', form: 'Tablet', class: 'Synthetic Thyroid Hormone' },

  // Vitamins & Supplements
  'calcirol': { generic: 'Cholecalciferol (Vitamin D3)', defaultStrength: '60000 IU', form: 'Granules', class: 'Vitamin D Supplement' },
  'vitamin d3': { generic: 'Cholecalciferol (Vitamin D3)', defaultStrength: '60000 IU', form: 'Capsule', class: 'Vitamin Supplement' },
  'shelcal': { generic: 'Calcium + Vitamin D3', defaultStrength: '500 mg / 250 IU', form: 'Tablet', class: 'Mineral Supplement' },
  'neurobion': { generic: 'Vitamin B-Complex + B12', defaultStrength: 'Standard', form: 'Tablet', class: 'B-Vitamin Supplement' },
  'limcee': { generic: 'Vitamin C (Ascorbic Acid)', defaultStrength: '500 mg', form: 'Chewable Tablet', class: 'Vitamin Supplement' }
};

/**
 * Non-prescription document identifiers (e.g. utility bills, invoices, banking statements)
 */
export const NON_PRESCRIPTION_KEYWORDS = [
  'tax invoice', 'invoice no', 'invoice date', 'bill to', 'electricity bill', 
  'water bill', 'telephone bill', 'bank statement', 'account statement', 
  'debit card', 'credit card', 'statement of account', 'salary slip', 
  'pay slip', 'boarding pass', 'flight ticket', 'booking confirmation', 
  'hotel reservation', 'delivery challan', 'gstin', 'pan card', 'aadhaar'
];

export function isNonPrescriptionDocument(rawText) {
  if (!rawText) return false;
  const lower = rawText.toLowerCase();

  // Count non-prescription matches
  let nonRxMatches = 0;
  for (const kw of NON_PRESCRIPTION_KEYWORDS) {
    if (lower.includes(kw)) nonRxMatches++;
  }

  // Count medical indicators
  const medicalMarkers = ['rx', 'dr.', 'doctor', 'clinic', 'hospital', 'patient', 'tablet', 'tab', 'cap', 'capsule', 'syrup', 'mg', 'mcg', 'dosage', 'diagnosis', 'dispense'];
  let medMatches = 0;
  for (const marker of medicalMarkers) {
    if (new RegExp(`\\b${marker}\\b`, 'i').test(lower)) medMatches++;
  }

  // If contains non-rx keywords and minimal or no medical markers -> Non-prescription
  return nonRxMatches >= 2 && medMatches <= 1;
}

export function resolveBrandAndGeneric(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      brandName: 'Unknown Medication',
      genericIngredient: 'Unknown Ingredient',
      isVerified: false,
      requiresConfirmation: true
    };
  }

  const clean = rawInput.trim();
  const lower = clean.toLowerCase();

  for (const [key, entry] of Object.entries(DRUG_CATALOG)) {
    if (lower.includes(key)) {
      return {
        brandName: clean,
        genericIngredient: entry.generic,
        form: entry.form,
        class: entry.class,
        isVerified: true,
        requiresConfirmation: false
      };
    }
  }

  return {
    brandName: clean,
    genericIngredient: clean,
    form: 'Tablet',
    isVerified: false,
    requiresConfirmation: true
  };
}

/**
 * Advanced Medical Shorthand and Dosage Parser
 * Supports: 1-0-1, 1-1-1, 0-1-0, 0-0-1, OD, BD, TDS, QDS, HS, SOS, PRN, AC, PC, BBF, ABF
 */
export function parseDosageNotation(notation) {
  if (!notation) {
    return {
      frequency: 'Once daily',
      timeSlots: ['Morning (8:00 AM)'],
      times: ['08:00 AM'],
      morningDose: 1,
      afternoonDose: 0,
      nightDose: 0,
      instructions: 'Take as directed by doctor'
    };
  }

  const clean = notation.trim();

  // 1. Food timing instructions
  let mealTiming = 'Take with water';
  if (/\b(?:ac|a\.c\.|before meals|before food|empty stomach|bbf)\b/i.test(clean)) {
    mealTiming = 'Take before meals (empty stomach)';
  } else if (/\b(?:pc|p\.c\.|after meals|after food|with food|abf)\b/i.test(clean)) {
    mealTiming = 'Take after meals';
  }

  // 2. Numeric pattern: e.g. 1-0-1, 1-1-1, 0-1-0, 0-0-1, 1-0-0
  const numPattern = clean.match(/([0-3])\s*[-–—/]\s*([0-3])\s*[-–—/]\s*([0-3])/);
  if (numPattern) {
    const morning = parseInt(numPattern[1], 10);
    const afternoon = parseInt(numPattern[2], 10);
    const night = parseInt(numPattern[3], 10);

    const slots = [];
    const times = [];
    if (morning > 0) { slots.push('Morning (8:00 AM)'); times.push('08:00 AM'); }
    if (afternoon > 0) { slots.push('Afternoon (1:00 PM)'); times.push('01:00 PM'); }
    if (night > 0) { slots.push('Night (10:00 PM)'); times.push('10:00 PM'); }

    let frequency = 'Once daily';
    const totalDoses = morning + afternoon + night;
    if (totalDoses === 2) frequency = 'Twice daily';
    if (totalDoses >= 3) frequency = 'Three times daily';

    return {
      frequency,
      timeSlots: slots.length > 0 ? slots : ['Morning (8:00 AM)'],
      times: times.length > 0 ? times : ['08:00 AM'],
      morningDose: morning,
      afternoonDose: afternoon,
      nightDose: night,
      instructions: mealTiming
    };
  }

  // 3. Latin Shorthand: TDS / TID (Thrice daily)
  if (/\b(?:tds|tid|t\.i\.d\.|thrice daily|3 times daily|three times a day)\b/i.test(clean)) {
    return {
      frequency: 'Three times daily',
      timeSlots: ['Morning (8:00 AM)', 'Afternoon (1:00 PM)', 'Night (10:00 PM)'],
      times: ['08:00 AM', '01:00 PM', '10:00 PM'],
      morningDose: 1,
      afternoonDose: 1,
      nightDose: 1,
      instructions: mealTiming
    };
  }

  // 4. Latin Shorthand: BD / BID (Twice daily)
  if (/\b(?:bd|bid|b\.i\.d\.|twice daily|2 times daily|twice a day|every 12 hours)\b/i.test(clean)) {
    return {
      frequency: 'Twice daily',
      timeSlots: ['Morning (8:00 AM)', 'Night (10:00 PM)'],
      times: ['08:00 AM', '10:00 PM'],
      morningDose: 1,
      afternoonDose: 0,
      nightDose: 1,
      instructions: mealTiming
    };
  }

  // 5. Latin Shorthand: QDS / QID (Four times daily)
  if (/\b(?:qds|qid|q\.i\.d\.|four times daily|4 times daily|every 6 hours)\b/i.test(clean)) {
    return {
      frequency: 'Four times daily',
      timeSlots: ['Morning (8:00 AM)', 'Afternoon (12:00 PM)', 'Evening (5:00 PM)', 'Night (10:00 PM)'],
      times: ['08:00 AM', '12:00 PM', '05:00 PM', '10:00 PM'],
      morningDose: 1,
      afternoonDose: 1,
      nightDose: 2,
      instructions: mealTiming
    };
  }

  // 6. Latin Shorthand: HS / Bedtime (Once daily at night)
  if (/\b(?:hs|h\.s\.|bedtime|at night|before bed)\b/i.test(clean)) {
    return {
      frequency: 'Once daily (Night)',
      timeSlots: ['Night (10:00 PM)'],
      times: ['10:00 PM'],
      morningDose: 0,
      afternoonDose: 0,
      nightDose: 1,
      instructions: `${mealTiming} at bedtime`
    };
  }

  // 7. Latin Shorthand: SOS / PRN (As needed)
  if (/\b(?:sos|prn|p\.r\.n\.|as needed|when required)\b/i.test(clean)) {
    return {
      frequency: 'As needed (SOS)',
      timeSlots: ['When required (SOS)'],
      times: ['08:00 AM'],
      morningDose: 1,
      afternoonDose: 0,
      nightDose: 0,
      instructions: 'Take only when necessary for symptoms as directed'
    };
  }

  // 8. Latin Shorthand: OD / Once Daily
  return {
    frequency: 'Once daily',
    timeSlots: ['Morning (8:00 AM)'],
    times: ['08:00 AM'],
    morningDose: 1,
    afternoonDose: 0,
    nightDose: 0,
    instructions: mealTiming
  };
}

/**
 * Intelligent Medicine Identity & Duplicate Prevention
 * Determines if a scanned medicine is a duplicate of an existing active routine.
 */
export function resolveMedicineDuplicate(candidateMed, existingMedications) {
  if (!existingMedications || !Array.isArray(existingMedications) || existingMedications.length === 0) {
    return { isDuplicate: false };
  }

  const cleanCandGeneric = (candidateMed.genericIngredient || candidateMed.name || '').toLowerCase().trim();
  const cleanCandBrand = (candidateMed.brandName || candidateMed.name || '').toLowerCase().trim();
  const candStrength = (candidateMed.strength || '').toLowerCase().replace(/\s+/g, '');

  for (const existing of existingMedications) {
    if (existing.status && existing.status !== 'Active' && existing.status !== 'ACTIVE') {
      continue;
    }

    const existGeneric = (existing.genericIngredient || existing.name || '').toLowerCase().trim();
    const existBrand = (existing.brandName || existing.name || '').toLowerCase().trim();
    const existStrength = (existing.strength || existing.dosage || '').toLowerCase().replace(/\s+/g, '');

    const genericMatches = (
      cleanCandGeneric === existGeneric ||
      cleanCandGeneric === existBrand ||
      cleanCandBrand === existGeneric ||
      cleanCandBrand === existBrand
    );

    if (genericMatches) {
      const strengthMatches = candStrength && existStrength && (
        candStrength === existStrength ||
        existStrength.includes(candStrength) ||
        candStrength.includes(existStrength)
      );

      if (strengthMatches) {
        return {
          isDuplicate: true,
          existingMedicationId: existing.id,
          existingName: existing.name,
          existingStrength: existing.strength,
          reason: `Duplicate detected: Active medication "${existing.name} (${existing.strength})" already exists with the same active ingredient.`
        };
      } else if (candStrength && existStrength && candStrength !== existStrength) {
        return {
          isDuplicate: false,
          isDifferentStrength: true,
          existingMedicationId: existing.id,
          existingName: existing.name,
          reason: `Different strength detected (${candidateMed.strength} vs existing ${existing.strength}). Kept as a separate clinical order.`
        };
      } else {
        return {
          isDuplicate: true,
          existingMedicationId: existing.id,
          existingName: existing.name,
          reason: `Potential duplicate: Active medication "${existing.name}" matches generic ingredient.`
        };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Cross-checks extracted medicine strip details against the local drug catalog.
 * Flags generic/brand mismatches and unexpected forms.
 */
export function crossCheckStripMedicine({ brandName = '', genericIngredient = '', strength = '', form = '' } = {}) {
  const brand = (brandName || '').trim();
  const generic = (genericIngredient || '').trim();
  const lowerBrand = brand.toLowerCase();
  const lowerGeneric = generic.toLowerCase();

  let matchedEntry = null;

  for (const [key, entry] of Object.entries(DRUG_CATALOG)) {
    if (lowerBrand && (lowerBrand.includes(key) || (entry.brands && entry.brands.some(b => lowerBrand.includes(b.toLowerCase()))))) {
      matchedEntry = entry;
      break;
    }
  }

  if (!matchedEntry && lowerGeneric) {
    for (const [, entry] of Object.entries(DRUG_CATALOG)) {
      if (lowerGeneric.includes(entry.generic.toLowerCase()) || entry.generic.toLowerCase().includes(lowerGeneric)) {
        matchedEntry = entry;
        break;
      }
    }
  }

  const warnings = [];
  let isMismatch = false;

  if (matchedEntry) {
    if (generic && matchedEntry.generic && !matchedEntry.generic.toLowerCase().includes(lowerGeneric) && !lowerGeneric.includes(matchedEntry.generic.toLowerCase())) {
      isMismatch = true;
      warnings.push(`Brand "${brand}" is known to contain "${matchedEntry.generic}", but extracted generic is "${generic}".`);
    }
    if (form && matchedEntry.form && form.toLowerCase() !== matchedEntry.form.toLowerCase()) {
      warnings.push(`Standard catalog form is "${matchedEntry.form}" (detected "${form}").`);
    }
  } else {
    warnings.push('Medication not found in standard local catalog. Please carefully verify packaging.');
  }

  return {
    matched: !!matchedEntry,
    catalogGeneric: matchedEntry ? matchedEntry.generic : null,
    catalogForm: matchedEntry ? matchedEntry.form : null,
    isMismatch,
    warnings
  };
}

/**
 * Check if a medication name or generic ingredient triggers a known allergy or cross-reactivity
 */
export function checkDrugAllergyConflict(drugName, userAllergies = []) {
  if (!drugName || !Array.isArray(userAllergies) || userAllergies.length === 0) return null;
  const lower = String(drugName).toLowerCase().trim();

  const ALLERGY_CROSS_REACTIONS = {
    'penicillin': ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'amoxil', 'mox'],
    'sulfa': ['sulfa', 'sulfamethoxazole', 'bactrim', 'septra', 'sulfonamide'],
    'aspirin': ['aspirin', 'acetylsalicylic', 'ecosprin', 'disprin'],
    'ibuprofen': ['ibuprofen', 'brufen', 'advil', 'motrin', 'combiflam'],
    'paracetamol': ['paracetamol', 'acetaminophen', 'dolo', 'calpol', 'crocin', 'p-650', 'tylenol']
  };

  for (const allergy of userAllergies) {
    const aLower = String(allergy).toLowerCase().trim();
    if (!aLower) continue;

    // Direct substring match
    if (lower.includes(aLower) || aLower.includes(lower)) {
      return allergy;
    }

    // Check cross-reactivity groups
    for (const [group, members] of Object.entries(ALLERGY_CROSS_REACTIONS)) {
      if (aLower.includes(group)) {
        if (members.some(m => lower.includes(m))) {
          return allergy;
        }
      }
    }
  }

  return null;
}

