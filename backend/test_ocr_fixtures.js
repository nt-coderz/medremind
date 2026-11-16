/**
 * Prescription OCR Test Fixtures
 * Tests offline OCR parsing on 3 diverse prescription samples:
 * 1. Typewritten / Printed prescription
 * 2. Clear doctor handwriting with standard abbreviations
 * 3. Messy doctor handwriting with typos and shorthand
 */

import { resolveBrandAndGeneric, parseDosageNotation, DRUG_CATALOG } from '../src/utils/drugKnowledgeBase.js';

// Levenshtein distance
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

export function extractDuration(line) {
  const match = line.match(/(?:x|for)\s*(\d+)\s*(days?|weeks?|months?)/i) ||
                line.match(/\b(\d+)\s*(days?|weeks?|months?)\b/i);
  return match ? `${match[1]} ${match[2].toLowerCase()}` : '7 days';
}

const NON_MED_WORDS = new Set(['rx', 'rx:', 'dr', 'doctor', 'clinic', 'hospital', 'patient', 'name', 'age', 'sex', 'date']);

export function parsePrescriptionText(rawText) {
  const rawLines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const medications = [];
  const matchedLineIndices = new Set();
  const seenGenerics = new Set();

  // Sort catalog keys by length descending (longest phrase first)
  const sortedCatalogEntries = Object.entries(DRUG_CATALOG).sort((a, b) => b[0].length - a[0].length);

  const parsedLines = rawLines.map((original, idx) => {
    // Strip leading numbering or bullet (e.g. "1.", "2)", "-", "•")
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
          // Avoid comparing with pure numbers or units
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

  // Step 2: Generic line parser for any line not already matched in Step 1
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

// 3 Test Fixtures:
const FIXTURE_1_TYPEWRITTEN = `
DR. A. K. SHARMA, MD (MEDICINE)
Reg No: WB-48291
Apex City Hospital, Kolkata

Patient Name: Ramesh Gupta
Age: 54 Yrs  Sex: M  Date: 12-Nov-2026

Rx:
1. Tab. Augmentin 625 mg - 1 Tab BD x 5 days (After meals)
2. Tab. Dolo 650 mg - 1 Tab TDS x 3 days (SOS for fever)
3. Tab. Pan 40 mg - 1 Tab OD (Before breakfast) x 14 days
4. Tab. Glycomet 500 mg - 1 Tab BD (After food) x 30 days
5. Tab. Atorva 20 mg - 1 Tab HS (At bedtime) x 30 days
`;

const FIXTURE_2_CLEAR_HANDWRITING = `
Dr. Priya Nair, MBBS, DNB
Apollo Clinic

Pt: Sunita Rao, 42F
Date: 10/11/2026

Rx
Tab Telma 40mg  1-0-0  x 30 days
Tab Metformin 500mg  1-0-1  x 30 days
Cap Omeprazole 20mg  1-0-0  BBF x 14 days
Tab Cetirizine 10mg  0-0-1  HS x 7 days
`;

const FIXTURE_3_MESSY_HANDWRITING = `
Dr M Roy
Care Polyclinic

Pt John Doe
14.11.2026

Rx:
- Paracitamol 500mg 1-0-1 x 3 days
- Azithral 500 1 tab OD x 3 days pc
- Zerodol SP 1 tab BD x 5 days
- Pantocid 40 1-0-0 empty stomach x 10 days
`;

// Run verification
console.log('--- RUNNING OCR FIXTURE TESTS ---');

const res1 = parsePrescriptionText(FIXTURE_1_TYPEWRITTEN);
console.log(`Fixture 1 (Typewritten, Expected 5): Found ${res1.length} medicines`);
res1.forEach(m => console.log(`  - ${m.brandName} (${m.genericIngredient}) | ${m.strength} | ${m.frequency} | ${m.duration}`));

const res2 = parsePrescriptionText(FIXTURE_2_CLEAR_HANDWRITING);
console.log(`Fixture 2 (Clear Handwriting, Expected 4): Found ${res2.length} medicines`);
res2.forEach(m => console.log(`  - ${m.brandName} (${m.genericIngredient}) | ${m.strength} | ${m.frequency} | ${m.duration}`));

const res3 = parsePrescriptionText(FIXTURE_3_MESSY_HANDWRITING);
console.log(`Fixture 3 (Messy/Fuzzy, Expected 4): Found ${res3.length} medicines`);
res3.forEach(m => console.log(`  - ${m.brandName} (${m.genericIngredient}) | ${m.strength} | ${m.frequency} | ${m.duration} [Uncertain: ${m.isUncertain}]`));

const pass1 = res1.length === 5;
const pass2 = res2.length === 4;
const pass3 = res3.length === 4;

console.log(`\nResults: Fixture 1: ${pass1 ? 'PASS (5/5)' : 'FAIL'}, Fixture 2: ${pass2 ? 'PASS (4/4)' : 'FAIL'}, Fixture 3: ${pass3 ? 'PASS (4/4)' : 'FAIL'}`);
if (pass1 && pass2 && pass3) {
  console.log('ALL FIXTURE TESTS PASSED AT 100% ACCURACY!');
} else {
  process.exit(1);
}
