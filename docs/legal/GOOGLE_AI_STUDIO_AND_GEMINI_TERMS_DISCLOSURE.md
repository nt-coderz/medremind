# MEDREMIND — GOOGLE AI STUDIO & GEMINI API DISCLOSURE

**Document Version:** 2026.1  
**Last Updated:** November 2026  
**Status:** Mandatory Regulatory & Platform Disclosure  

---

### 1. PURPOSE OF THIS DISCLOSURE
This document formally discloses the architectural, operational, and legal relationship between **MedRemind** and the artificial intelligence services provided by **Google LLC** ("Google"), specifically **Google AI Studio** and the **Gemini API**.

MedRemind integrates multimodal artificial intelligence solely to assist users in optical prescription document and medicine strip transcription, and optional nutritional estimation for uncatalogued food items. This disclosure outlines the strict functional boundaries, terms of service, and privacy considerations governing this integration.

---

### 2. DISTINCTION BETWEEN GOOGLE AI STUDIO AND GEMINI API
To ensure complete technical and regulatory transparency, MedRemind distinguishes between two distinct Google developer components:

2.1. **Google AI Studio (Development & Configuration Environment):**
   - Google AI Studio is the cloud-based developer prototyping environment and API credential management console.
   - It is used by application developers to generate API keys, configure model parameters, and test prompt engineering.
   - Google AI Studio is NOT the runtime engine executing in the user's mobile device.

2.2. **Google Gemini API (Runtime Inference Service):**
   - The Gemini API (specifically multimodal models such as `gemini-3.5-flash` or `gemini-2.5-flash` accessed via the `@google/genai` Node.js SDK) is the cloud-hosted machine learning inference endpoint invoked by MedRemind's backend service.
   - When a user initiates an online scan, the backend transmits the prescription or medicine strip image to Google's Generative Language API endpoint (`https://generativelanguage.googleapis.com`) to extract text and structure medicine fields into a draft reminder format. When a user requests nutrition lookup for unlisted food items, structured nutritional queries may also be estimated by Gemini.

---

### 3. APPLICABLE GOOGLE TERMS & OFFICIAL DOCUMENTATION LINKS
3.1. **Gemini API Additional Terms of Service:**  
   [https://ai.google.dev/gemini-api/terms](https://ai.google.dev/gemini-api/terms)
3.2. **Google APIs Terms of Service:**  
   [https://developers.google.com/terms](https://developers.google.com/terms)
3.3. **Google Generative AI Prohibited Use Policy:**  
   [https://policies.google.com/terms/generative-ai/use-policy](https://policies.google.com/terms/generative-ai/use-policy)
3.4. **Google Privacy Policy:**  
   [https://policies.google.com/privacy](https://policies.google.com/privacy)
3.5. **Gemini API Usage & Safety Policies:**  
   [https://ai.google.dev/gemini-api/docs/usage-policies](https://ai.google.dev/gemini-api/docs/usage-policies)
3.6. **Zero Data Retention (ZDR) & Enterprise Data Governance:**  
   [https://ai.google.dev/gemini-api/docs/zdr](https://ai.google.dev/gemini-api/docs/zdr)
3.7. **Google AI Studio Build Mode Documentation:**  
   [https://ai.google.dev/gemini-api/docs/aistudio-build-mode](https://ai.google.dev/gemini-api/docs/aistudio-build-mode)

---

### 4. STRICT FUNCTIONAL BOUNDARIES OF GEMINI USE IN MEDREMIND

Google's Gemini API is integrated in MedRemind under strict clinical and software constraints.

#### What Gemini DOES in MedRemind:
- **Optical Prescription & Strip Transcription:** Reads printed or handwritten text on prescription images and medicine strips / blister packs / boxes.
- **Text & Metadata Extraction:** Extracts doctor names, clinic letterheads, patient names, prescribed drug names, brand names, active generic ingredients, dosage strengths, forms, batch numbers, and expiry dates.
- **Shorthand Interpretation:** Transcribes recognized shorthand notation (such as "1-0-1", "OD", "BD", "TID", "after meals") into numerical dose slots (morning, afternoon, night) strictly when supported by the document.
- **Brand & Generic Resolution:** Resolves brand names to active generic ingredients (e.g., P-650 = Paracetamol) and structures them into unified medication records.
- **Nutrition Estimation:** Generates estimated nutritional breakdowns (calories, protein, carbs, fat, fibre) for unlisted foods queried in the nutrition tracker.
- **Populating Editable Forms:** Formats extracted details into draft fields within the user's editable forms. Nothing is activated without user confirmation.

#### What Gemini DOES NOT DO in MedRemind:
- **NO Medical Advice:** Gemini is never used to provide clinical, pharmacological, or healthcare advice.
- **NO Diagnosis:** Gemini does not assess, diagnose, or infer medical conditions or diseases.
- **NO Treatment Recommendations:** Gemini never recommends medicines, supplements, or therapy changes.
- **NO Dosage Alterations:** Gemini does not calculate, modify, or suggest changes to prescribed doses.
- **NO Automated Approvals:** Gemini CANNOT activate reminders or add medicines to active schedules on its own. All AI outputs are held in a draft quarantine state until explicit manual user review and approval.

---

### 5. CLARIFICATION ON GOOGLE'S HEALTH & MEDICAL USE RESTRICTIONS

The Gemini API Additional Terms of Service state:
> *"You may not use the Services in clinical practice, to provide medical advice, or in any manner that is overseen by or requires clearance or approval from a medical device regulatory agency."*

MedRemind aligns with this restriction through the following structural safeguards:
1. **Human-in-the-Loop Mandatory Verification:** Every field extracted by Gemini is marked as a preliminary draft. The user is required to cross-examine each field against the physical paper prescription.
2. **Prominent Disclaimers:** Clear warnings notify users that AI outputs are optical transcriptions and do not verify clinical safety.
3. **No Clinical Practice:** The Application is a patient-facing reminder organizer, not a clinical decision support tool deployed by healthcare institutions to direct patient treatment.

---

### 6. USER-PROVIDED GOOGLE WRITTEN CLARIFICATION PLACEHOLDER

Below is the dedicated section for the written clarification received from Google regarding the permitted scope of our intended Gemini use:

```
================================================================================
                    GOOGLE WRITTEN CLARIFICATION RECORD
================================================================================
STATED INTENDED SCOPE SUBMITTED TO GOOGLE:
- Image-to-text transcription of existing physical prescriptions.
- Extraction of written medication names, strengths, and dosage frequencies.
- Automatically populating draft reminder entries in the user interface.
- Mandatory manual user review and confirmation before reminder activation.
- Strict prohibition against diagnostic advice, clinical recommendations, or dosage modifications.

GOOGLE'S WRITTEN RESPONSE:
[Insert Exact Text of Google Written Response if available]

DATE OF CLARIFICATION: [Insert Date, e.g., November 2026]
COMMUNICATION REFERENCE: [Insert Ticket / Case / Email ID]
================================================================================
```

*(Note: If the formal text of Google's response is provided by the project owner, it must be inserted verbatim into the block above without fabrication or alteration).*
