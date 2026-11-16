/**
 * MedRemind Legal Documentation Content & Metadata
 * Version: 2026.1
 */

export const LEGAL_VERSIONS = {
  TERMS: '2026.1',
  PRIVACY: '2026.1',
  AI_DISCLOSURE: '2026.1',
  LAST_UPDATED: 'November 2026'
};

export const TERMS_SUMMARY = [
  "MedRemind is a personal medication routine organizer and reminder tool, NOT a medical advice, diagnostic, or prescribing service.",
  "Prescription and medicine strip scanning uses AI (Google Gemini) or OCR (Tesseract) as a draft assistant only. Extracted fields may contain errors or omissions.",
  "You are strictly required to personally review and verify all medicine names, strengths, and dosages against your physical prescription or medicine package before approving them.",
  "No medication routine or alarm schedule becomes active without your explicit manual review and approval.",
  "Minors should use MedRemind under the supervision of a parent or legal guardian.",
  "Do not rely exclusively on MedRemind for critical, life-sustaining, emergency medications. Hardware notifications may be affected by Android battery optimizations.",
  "Nutrition and food log calculations are automated estimates only and do not constitute clinical or dietary advice."
];

export const PRIVACY_SUMMARY = [
  "We process your data under the Digital Personal Data Protection Act, 2023 (DPDP Act) based strictly on your explicit consent.",
  "When you use 'Scan with Gemini (Internet required)', your unredacted prescription or medicine strip image is transmitted to Google's Gemini API for optical text extraction.",
  "Prescription and strip images may contain medicine names, doctor details, manufacturer info, and batch numbers.",
  "Nutrition queries for unlisted items may consult Google Gemini for estimated nutritional breakdowns.",
  "Google's unpaid developer tier retains data for model training; MedRemind recommends using synthetic test data in development mode.",
  "When you choose offline scanning, processing happens strictly locally with zero external network transmission.",
  "You have statutory rights under DPDP Act to access, correct, erase your data, nominate a representative, or withdraw consent at any time."
];

export const AI_DISCLOSURE_SUMMARY = [
  "Google Gemini API (model gemini-3.5-flash) is invoked at runtime to perform optical transcription of prescription documents.",
  "Gemini extracts existing written text only. It DOES NOT diagnose conditions, recommend medicines, alter dosages, or provide medical advice.",
  "All AI outputs are held in a draft state and cannot activate reminders without your manual confirmation.",
  "Official terms: https://ai.google.dev/gemini-api/terms and https://policies.google.com/terms/generative-ai/use-policy"
];
