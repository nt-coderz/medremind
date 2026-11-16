# MEDREMIND — PRIVACY POLICY

**Document Version:** 2026.1  
**Last Updated:** November 2026  
**Regulatory Framework:** Digital Personal Data Protection Act, 2023 (DPDP Act, 2023), applicable DPDP Rules, 2025, Information Technology Act, 2000, and applicable Indian data protection standards.

---

### 1. INTRODUCTION & DATA FIDUCIARY OVERVIEW
**[Insert Legal Entity Name / Developer Name]** ("MedRemind", "we", "us", or "our") acts as a Data Fiduciary under the Digital Personal Data Protection Act, 2023 ("DPDP Act") with respect to digital personal data collected, stored, processed, and managed through the **MedRemind** mobile application, web dashboard, and backend services (the "Application").

We recognize that medication routines and medical prescriptions constitute sensitive personal health information. This Privacy Policy details what personal data we collect, why we process it, where it is stored, how third-party services (such as Google's Gemini API) interact with your data, and your statutory rights regarding access, correction, erasure, nomination, and consent withdrawal.

---

### 2. CATEGORIES OF PERSONAL DATA COLLECTED
We collect and process the following categories of digital personal data:

2.1. **Account & Identity Data:**
   - Full Name, registered email address, mobile number (if provided).
   - Password hashes (processed using cryptographic salting; plain-text passwords are never stored).
   - Selected account role (Patient or Caregiver).
   - Unique User Identifier (UUID v4 generated per user account).
   - Record of statutory terms and legal consent acknowledgement.

2.2. **Prescription Media, Medicine Packaging & Health-Related Data:**
   - Digital prescription files and medicine strip / packaging captures (JPEG, JPG, PNG) and multi-page document scans (PDF) uploaded by you.
   - Extracted clinical text: patient name as printed on prescriptions, prescribing physician's name, medical registration/license number, clinic/hospital name, prescription date, and clinical instructions.
   - Prescribed medications & strip details: brand names, active generic chemical ingredients, dosage forms (tablets, capsules, syrups), strengths (e.g., 650 mg, 500 mg), manufacturer names, batch numbers, expiry dates, administration quantities, and course durations.
   - Shorthand dosage frequencies (e.g., morning, afternoon, night, 1-0-1 notation) and meal timings (e.g., after meals, before meals).
   - Documented drug allergies and blood type recorded in your personal profile.

2.3. **Medication Routine & Dose Logs:**
   - Timestamps of scheduled dose reminder alarms.
   - User action logs: doses recorded as "Taken", "Skipped", or "Snoozed".
   - Caregiver linking records: authorized caregiver designations and shared adherence summaries.

2.4. **Nutrition & Food Consumption Data:**
   - Logged food names, quantities, measurement units, meal classifications (breakfast, lunch, dinner, snack), and timestamps.
   - Computed nutritional values (calories, protein, fat, carbohydrates, dietary fibre).
   - User-configured daily caloric and macronutrient targets.

2.5. **Technical & Device Information:**
   - Device model, operating system version (e.g., Android 12, ColorOS), app build version, and unique installation instance tokens.
   - Local notification scheduling timestamps and system battery/alarm permission states (`RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`).

---

### 3. LEGAL BASIS & PURPOSE OF PROCESSING
Under Section 4 and Section 6 of the DPDP Act, 2023, we process your personal data solely for specific, legitimate, and lawful purposes based on your explicit, informed, and unambiguous consent:

| Processing Activity | Purpose of Processing | Statutory Basis |
| :--- | :--- | :--- |
| Account Creation & Authentication | Authenticate authorized access, maintain user profiles, and separate patient data. | Explicit Consent (DPDP Section 6) |
| Prescription Scanning & OCR | Transcribe written prescriptions into structured draft fields to populate the reminder editor. | Explicit Consent (DPDP Section 6) |
| Dose Scheduling & Local Alarms | Trigger timely on-device notifications to assist user adherence. | Performance of Requested Service |
| Caregiver Adherence Sharing | Notify authorized family members or caregivers of missed or taken doses. | Explicit User Designation & Consent |
| Legal Audit & Consent Receipts | Record user acceptance of Terms and Privacy Policy versions for regulatory compliance. | Legal Obligation (DPDP Section 8) |

---

### 4. PRESCRIPTION SCANNING & GOOGLE GEMINI API DATA TRANSMISSION DISCLOSURE

**PLEASE READ THIS SECTION WITH SPECIAL CARE.**

4.1. **How Online Prescription & Medicine Strip Recognition Works:**
   When you choose **"Scan with Gemini (Internet required)"**, the Application transmits the raw digital prescription or medicine strip image to our backend server, which forwards the Base64 image payload to Google's Gemini API (`@google/genai`) for multimodal vision analysis. Similarly, queries for unlisted food items may be estimated via Gemini text inference.

4.2. **What Information is Transmitted to Google:**
   - **The complete, unredacted prescription or strip image** is sent to Google's generative language servers (`generativelanguage.googleapis.com`).
   - Consequently, personal identifiers and medication details visible on the document or packaging are transmitted to Google, including patient name, doctor details, drug names, dosage, batch numbers, and expiry dates.

4.3. **Crucial Difference: Unpaid (Free) Tier vs Paid Enterprise Tier:**
   - **Google AI Studio Unpaid/Free Tier:** Under Google's Terms for unpaid developer API access, **Google stores prompts, responses, and submitted images to improve and train Google products and machine-learning models**, and human reviewers may read and annotate submitted data.
   - **Google Cloud Vertex AI / Paid Tier:** On paid enterprise tiers with zero-data-retention (ZDR) agreements, customer data is not used to train models and is discarded after generating the response.
   - **MedRemind Policy:** In development and preview modes using Google AI Studio developer keys, users **must strictly use synthetic or de-identified test prescriptions**. Real patient health data must NEVER be submitted through the unpaid developer tier.

4.4. **Offline Alternative (Zero External Transmission):**
   When you choose **"Scan offline (Tesseract)"** or when your device is offline:
   - Prescription and medicine strip images are processed strictly locally through the embedded Tesseract OCR engine, and foods are looked up from the local on-device database.
   - **Zero image bytes, patient names, or medical records are transmitted to Google or any external cloud server.**

---

### 5. DATA STORAGE, ARCHITECTURE & LOCAL PERSISTENCE
5.1. **Client-Side Storage (`localStorage`):**
   - Active user profile, session state, scheduled dose routines, and compliance check logs are stored in your device's private web application storage sandbox.
   - Local storage remains on your physical phone and is not accessible to other mobile apps.
5.2. **Backend Server Storage:**
   - When the backend service is deployed, operational JSON stores (`medications.json`, `prescriptions.json`, `schedules.json`, `audit_logs.json`) are maintained in secure directories.
   - Prescription image uploads are stored in an isolated `uploads/` directory with random non-guessable UUID filenames (`doc-timestamp-uuid.jpg`).
5.3. **Exclusion from Public Version Control:**
   - All prescription images, patient JSON records, and environment keys are strictly excluded from Git repositories and cloud version control via comprehensive `.gitignore` filters.

---

### 6. THIRD-PARTY DATA PROCESSORS & RECIPIENTS
We do not sell, rent, trade, or monetize your personal health data. We share personal data only with authorized processors necessary to deliver the Application's core features:

1. **Google LLC (Gemini API):** Runtime multimodal optical prescription transcription (when online scanning is explicitly selected by the user).
2. **Local Device OS (Android AlarmManager):** Hardware-level alarm execution for offline medication reminders via `@capacitor/local-notifications`.
3. **Designated Caregivers:** Only individuals whom you have explicitly linked to your profile via their verified User ID will receive adherence summaries or missed-dose alerts.

---

### 7. DATA RETENTION & ERASURE POLICY
7.1. **Retention Duration:** We retain personal data only for as long as your account remains active and as required to fulfill the medication reminder service, or as mandated by applicable statutory retention laws.
7.2. **Right to Erasure (DPDP Act, Section 12):** You have the right to request the complete deletion of your account, prescription files, and dose histories at any time through the Application settings or by contacting our Grievance Officer.
7.3. **Immediate Purge:** Upon receiving a verified erasure request:
   - Your user record, active routines, and audit trails are permanently purged from active databases.
   - All associated physical prescription images stored in `uploads/` are permanently shredded.

---

### 8. SECURITY SAFEGUARDS (TECHNICAL & ORGANIZATIONAL)
Pursuant to Section 8(5) of the DPDP Act, 2023, we implement reasonable security safeguards to prevent personal data breaches:
- **Transport Security:** All network communications between mobile clients and the backend use TLS 1.3 encryption (HTTPS).
- **Access Control:** Role-based access control (RBAC) separates Patient, Caregiver, and Administrator capabilities.
- **Zero Hardcoded Secrets:** API keys and credentials are strictly quarantined in server-side environment variables and never bundled in Android APK assets.
- **Audit Logging:** System actions (prescriptions scanned, approvals, caregiver links) are logged in tamper-evident audit trails.

---

### 9. STATUTORY RIGHTS OF DATA PRINCIPALS (DPDP ACT, 2023)
As a Data Principal under Indian law, you possess the following enforceable rights:

9.1. **Right to Access Information (Section 11):** You have the right to obtain a summary of personal data processed by us and the identities of third parties with whom such data has been shared.
9.2. **Right to Correction and Erasure (Section 12):** You have the right to correct inaccurate or misleading personal data, complete incomplete records, and request deletion of data no longer necessary for the specified purpose.
9.3. **Right to Grievance Redressal (Section 13):** You have the right to readily available grievance redressal mechanisms regarding our obligations under the DPDP Act.
9.4. **Right to Nominate (Section 14):** You have the right to nominate any other individual who, in the event of your death or incapacity, shall exercise your data principal rights.
9.5. **Right to Withdraw Consent (Section 6(4)):** You may withdraw your consent for processing at any time through app settings or written request. Withdrawal does not affect the lawfulness of processing conducted prior to withdrawal.

---

### 10. DATA BREACH NOTIFICATION PROTOCOL
Pursuant to Section 8(6) of the DPDP Act, in the event of an unauthorized personal data breach affecting your information:
1. MedRemind will notify the **Data Protection Board of India (DPBI)** in such form and manner as prescribed under the DPDP Rules.
2. MedRemind will notify affected Data Principals without undue delay, detailing the nature of the breach, the personal data impacted, potential consequences, and the remedial safety measures taken.

---

### 11. GRIEVANCE REDRESSAL OFFICER & CONTACT PLACEHOLDERS
Pursuant to Section 13(2) of the DPDP Act, 2023, we have designated a Grievance Officer:

- **Data Fiduciary:** [Insert Legal Entity Name / Developer Name]  
- **Registered Address:** [Insert Registered Office Address / City / Pincode, India]  
- **Data Protection & Grievance Officer:** [Insert Grievance Officer Name]  
- **Official Grievance Email:** [Insert Grievance Email, e.g., grievance@medremind.app]  
- **Statutory Resolution Period:** Grievances will be formally acknowledged within 48 hours and resolved within thirty (30) calendar days from receipt.
- **Escalation to Regulator:** If you are dissatisfied with our response, you may file a complaint with the **Data Protection Board of India** under Section 13(3) of the DPDP Act, 2023.
