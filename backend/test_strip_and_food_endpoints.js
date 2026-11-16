/**
 * MedRemind Test Suite: Strip OCR, Food & Nutrition, and Age-Free Consent
 * Validates backend data layer, drug knowledge base cross-checks, and food catalog.
 * Follows MedRemind test_*.js standards.
 */

import { db } from './database/db.js';
import { crossCheckStripMedicine } from './drugKnowledgeBase.js';
import { 
  searchFoodCatalog, 
  calculateItemNutrition, 
  calculateMacroPercentages 
} from '../src/data/foodCatalog.js';
import { hasCurrentConsent, recordUserConsent } from '../src/services/legalConsentService.js';

async function runTests() {
  console.log('========================================================================');
  console.log('   MEDREMIND TEST SUITE: STRIP SCANNER, NUTRITION & CONSENT            ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // ==========================================================================
  // PART 1: CONSENT WITHOUT 18+ REQUIREMENT
  // ==========================================================================
  console.log('--- 1. CONSENT HANDLING WITHOUT AGE REQUIREMENT ---');
  try {
    const testUserId = `test-user-${Date.now()}`;
    const consentPayload = {
      userId: testUserId,
      termsVersion: '2026.1',
      privacyVersion: '2026.1',
      aiDisclosureVersion: '2026.1',
      explicitConsentGiven: true,
      aiProcessingConsent: true
      // NOTE: ageConfirmed is intentionally omitted
    };

    const savedConsent = await db.saveConsent(consentPayload);
    assert(savedConsent && savedConsent.status === 'ACTIVE', 'db.saveConsent succeeds without ageConfirmed parameter');
    assert(savedConsent.ageConfirmed === true, 'db.saveConsent defaults ageConfirmed safely to true for backwards compatibility');

    // Frontend service test
    recordUserConsent({
      userId: testUserId,
      termsAccepted: true,
      privacyAccepted: true,
      aiConsentGiven: true
      // ageConfirmed omitted
    });
    const hasConsent = hasCurrentConsent(testUserId);
    assert(hasConsent === true, 'hasCurrentConsent() returns true without requiring age check');
  } catch (err) {
    assert(false, `Consent test error: ${err.message}`);
  }

  // ==========================================================================
  // PART 2: MEDICINE STRIP KNOWLEDGE BASE CROSS-CHECK
  // ==========================================================================
  console.log('\n--- 2. MEDICINE STRIP CROSS-CHECK & KNOWLEDGE BASE ---');
  try {
    // 2.1 Exact match
    const check1 = crossCheckStripMedicine({
      brandName: 'Dolo 650',
      genericIngredient: 'Paracetamol',
      strength: '650 mg',
      form: 'Tablet'
    });
    assert(check1.matched === true, 'Dolo 650 matched in drug knowledge base');
    assert(check1.isMismatch === false, 'Generic Paracetamol verified with no mismatch');

    // 2.2 Brand/Generic mismatch
    const check2 = crossCheckStripMedicine({
      brandName: 'Dolo 650',
      genericIngredient: 'Amoxicillin',
      strength: '650 mg',
      form: 'Tablet'
    });
    assert(check2.matched === true, 'Dolo 650 found in catalog');
    assert(check2.isMismatch === true, 'Flagged mismatch when Dolo 650 was paired with Amoxicillin');
    assert(check2.warnings.length > 0, 'Generated clinical warning for mismatched generic');

    // 2.3 Uncatalogued medication
    const check3 = crossCheckStripMedicine({
      brandName: 'NonExistentDrugBrand999',
      genericIngredient: 'RandomCompound',
      strength: '10 mg',
      form: 'Tablet'
    });
    assert(check3.matched === false, 'Correctly identified uncatalogued brand as not in catalog');
    assert(check3.warnings.some(w => w.includes('not found in standard')), 'Prompted careful manual verification for unknown drug');
  } catch (err) {
    assert(false, `Strip cross-check error: ${err.message}`);
  }

  // ==========================================================================
  // PART 3: LOCAL FOOD CATALOG & MACRO CALCULATION
  // ==========================================================================
  console.log('\n--- 3. FOOD CATALOG & NUTRITION CALCULATION ---');
  try {
    // Search Indian staples
    const rotiResults = searchFoodCatalog('roti');
    assert(rotiResults.length > 0 && rotiResults[0].id === 'roti-wheat', 'searchFoodCatalog finds Roti / Chapati');

    const dalResults = searchFoodCatalog('dal');
    assert(dalResults.length > 0, 'searchFoodCatalog finds Dal staples');

    const idliResults = searchFoodCatalog('idli');
    assert(idliResults.length > 0, 'searchFoodCatalog finds South Indian Idli');

    // Calculate nutrition for 2 Rotis
    const rotiItem = rotiResults[0];
    const twoRotis = calculateItemNutrition(rotiItem, 2, 'pieces');
    assert(twoRotis.calories === 208, `2 rotis calculate to 208 kcal (got ${twoRotis.calories})`);
    assert(twoRotis.protein === 6.2, `2 rotis calculate to 6.2g protein (got ${twoRotis.protein})`);
    assert(twoRotis.carbs === 40.4, `2 rotis calculate to 40.4g carbs (got ${twoRotis.carbs})`);

    // Calculate Macro Percentage split (e.g. 60g protein, 250g carbs, 65g fat)
    // Protein: 60*4 = 240 kcal; Carbs: 250*4 = 1000 kcal; Fat: 65*9 = 585 kcal; Total = 1825 kcal
    const splits = calculateMacroPercentages(60, 250, 65);
    assert(splits.proteinPct === 13, `Protein % is 13% of macro calories (got ${splits.proteinPct}%)`);
    assert(splits.carbsPct === 55, `Carbs % is 55% of macro calories (got ${splits.carbsPct}%)`);
    assert(splits.fatPct === 32, `Fat % is 32% of macro calories (got ${splits.fatPct}%)`);
    assert(splits.proteinPct + splits.carbsPct + splits.fatPct === 100, 'Macro percentages sum to 100%');
  } catch (err) {
    assert(false, `Food catalog test error: ${err.message}`);
  }

  // ==========================================================================
  // PART 4: DATABASE FOOD LOGS & TARGETS PERSISTENCE
  // ==========================================================================
  console.log('\n--- 4. DATABASE FOOD LOGS & NUTRITION TARGETS ---');
  try {
    const testPatientId = `test-patient-${Date.now()}`;
    const testDate = new Date().toISOString().split('T')[0];

    // 4.1 Save food log entry
    const newLog = await db.saveFoodLog({
      patient_id: testPatientId,
      food_name: 'Dal Tadka & Rice',
      quantity: 1,
      unit: 'plate',
      meal_type: 'lunch',
      log_date: testDate,
      calories: 370,
      protein_g: 13.4,
      carbs_g: 67.5,
      fat_g: 5.0,
      fibre_g: 6.6,
      is_estimated: false,
      source: 'local_catalog'
    });
    assert(newLog && newLog.id, `Food log saved successfully with ID ${newLog.id}`);
    assert(newLog.calories === 370, 'Calories correctly persisted');

    // 4.2 Retrieve food logs
    const logs = await db.getFoodLogs(testPatientId, testDate);
    assert(logs.length >= 1, `getFoodLogs returned ${logs.length} log(s) for patient`);
    assert(logs[0].food_name === 'Dal Tadka & Rice', 'Retrieved log matches food name');

    // 4.3 Save and retrieve targets
    const targetPayload = {
      calories: 2200,
      protein: 75,
      carbs: 260,
      fat: 60,
      fibre: 35
    };
    const savedTargets = await db.saveNutritionTargets(testPatientId, targetPayload);
    assert(savedTargets.calories === 2200, 'Calories target saved');
    assert(savedTargets.protein === 75, 'Protein target saved');

    const fetchedTargets = await db.getNutritionTargets(testPatientId);
    assert(fetchedTargets.calories === 2200, 'Retrieved target matches saved target');

    // 4.4 Delete food log
    const deleted = await db.deleteFoodLog(newLog.id, testPatientId);
    assert(deleted === true, 'deleteFoodLog successfully removed the test log');

    const logsAfter = await db.getFoodLogs(testPatientId, testDate);
    assert(!logsAfter.some(l => l.id === newLog.id), 'Log is no longer present after deletion');
  } catch (err) {
    assert(false, `Database food logs error: ${err.message}`);
  }

  // ==========================================================================
  // PART 5: LIVE BACKEND ENDPOINTS (CONDITIONAL)
  // ==========================================================================
  console.log('\n--- 5. LIVE BACKEND HTTP ENDPOINTS (OPTIONAL / CONDITIONAL) ---');
  try {
    const res = await fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      console.log('[INFO] Backend server is running on localhost:3001. Testing HTTP endpoints...');
      
      // Test /api/food-lookup
      const lookupRes = await fetch('http://localhost:3001/api/food-lookup?query=Roti&quantity=2&unit=pieces');
      const lookupData = await lookupRes.json();
      assert(lookupData.success === true, 'GET /api/food-lookup returned success');

      // Test /api/nutrition-targets
      const targetsRes = await fetch('http://localhost:3001/api/nutrition-targets?patientId=USR-patient');
      const targetsData = await targetsRes.json();
      assert(targetsData.success === true && targetsData.targets, 'GET /api/nutrition-targets returned success');
    } else {
      console.log('[SKIP] Backend server not responding on localhost:3001. Live HTTP checks skipped.');
      skipped += 2;
    }
  } catch (e) {
    console.log('[SKIP] Backend server not active on localhost:3001. Live network integration tests skipped (data layer fully verified above).');
    skipped += 2;
  }

  // Close db pool
  await db.close();

  // Summary
  console.log('\n========================================================================');
  console.log(`TEST RUN COMPLETE: ${passed} PASSED | ${failed} FAILED | ${skipped} SKIPPED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
