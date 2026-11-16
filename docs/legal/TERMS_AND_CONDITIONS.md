# MEDREMIND — TERMS & CONDITIONS

**Document Version:** 2026.1  
**Last Updated:** November 2026  
**Status:** Active  

---

### IMPORTANT NOTICE — PLEASE READ CAREFULLY
These Terms and Conditions ("Terms", "Agreement") constitute a legally binding agreement between you ("User", "you", or "your") and **[Insert Legal Entity Name / Developer Name]** ("MedRemind", "we", "us", or "our"), governing your access to and use of the **MedRemind** mobile application, web interface, background reminder services, and associated software components (collectively, the "Application" or "Services").

**BY REGISTERING AN ACCOUNT, CLICKING "I AGREE" OR "ACCEPT", OR ACCESSING OR USING THE APPLICATION, YOU AGREE TO BE BOUND BY THESE TERMS. MINORS SHOULD USE MEDREMIND UNDER THE SUPERVISION OF A PARENT OR LEGAL GUARDIAN. IF YOU DO NOT AGREE TO THESE TERMS, DO NOT CREATE AN ACCOUNT, ACCESS, OR USE THE APPLICATION.**

---

### 1. APPLICATION PURPOSE & SCOPE OF SERVICE
1.1. **Medication Reminder & Organization Tool Only:** MedRemind is exclusively a patient-empowerment medication routine organizer, dose reminder utility, and prescription transcription assistant. It is designed to assist individuals in organizing information from valid prescriptions previously issued to them by authorized medical practitioners and creating scheduled reminders for their personal routines.
1.2. **NOT A HEALTHCARE PROVIDER OR MEDICAL ADVICE SERVICE:** MEDREMIND IS NOT A HOSPITAL, CLINIC, PHARMACY, LICENSED HEALTHCARE PROVIDER, OR MEDICAL DIAGNOSTIC SERVICE. THE APPLICATION DOES NOT PROVIDE MEDICAL, CLINICAL, PHARMACEUTICAL, OR HEALTHCARE ADVICE, DIAGNOSIS, PROGNOSIS, OR TREATMENT.
1.3. **NOT A REPLACEMENT FOR LICENSED HEALTHCARE PROFESSIONALS:** The Application is never a substitute for the clinical judgment, advice, diagnosis, or care of a qualified physician, pharmacist, nurse, or other licensed healthcare professional. Never disregard professional medical advice or delay seeking it because of information displayed in, extracted by, or scheduled within MedRemind.
1.4. **NO CLINICAL DECISION-MAKING:** The Application does not evaluate the clinical suitability, drug interactions, contraindications, allergies, or therapeutic efficacy of any prescribed medicine.
1.5. **NUTRITION & FOOD LOG ESTIMATES:** The food and nutrition logging features provide automated estimates of caloric and macronutrient values based on standard references and AI estimation. These values are informational only and do not constitute clinical or dietary advice.

---

### 2. AI PRESCRIPTION & MEDICINE STRIP EXTRACTION & OCR DISCLOSURE
2.1. **Optical Character Recognition & Multimodal AI:** MedRemind integrates third-party multimodal artificial intelligence (specifically Google's Gemini API) and local optical character recognition (Tesseract.js) to assist users in reading text from uploaded prescription documents and medicine strips or blister packs.
2.2. **Draft Assistance Only — Not a Verified Prescription:** You expressly acknowledge that all information extracted by artificial intelligence or OCR—including medicine brand names, active generic ingredients, strengths, dose quantities, frequencies, administration timings, and durations—is **preliminary machine-generated draft information only**. It is NOT a verified prescription, medical order, or clinical confirmation.
2.3. **Potential for Errors and Hallucinations:** Optical character recognition and generative AI models may misread handwriting, confuse similar drug names, misinterpret dosage shorthand (such as "1-0-1", "OD", or "BD"), omit numbers, or produce inaccurate outputs.
2.4. **Mandatory User Review & Approval Workflow:** 
   - No extracted medicine, dosage, or reminder schedule becomes active within MedRemind automatically.
   - The Application presents all extracted data in an editable Medication Review Screen.
   - **You must personally and meticulously inspect every field**, cross-examine each medicine against your original physical paper prescription, correct any errors, and provide explicit manual confirmation ("Verify & Proceed" / "Approve All") before any reminder schedule is stored or activated.
2.5. **Offline Fallback OCR:** When online AI scanning is unavailable or when you select offline mode, MedRemind uses Tesseract.js. Offline OCR accuracy depends heavily on camera quality, lighting, and document condition, and requires identical manual review before approval.

---

### 3. USER RESPONSIBILITIES & HEALTH SAFETY
3.1. **Personal Verification Obligation:** You bear the sole responsibility for verifying that the medication name, dosage strength (e.g., 500 mg vs 650 mg), timing relative to meals, and frequency exactly match your doctor's orders.
3.2. **Resolving Ambiguities:** If any handwriting on a prescription is illegible, uncertain, or flagged as ambiguous by the Application, you agree not to guess or assume the dosage. You must contact your prescribing physician or dispensing pharmacist for clarification.
3.3. **Accurate Account Information:** You agree to provide true, accurate, and complete information during registration and profile setup, and to update such information promptly upon any change.

---

### 4. NOTIFICATION & HARDWARE REMINDER LIMITATIONS
4.1. **No Guarantee of Timely Delivery:** While MedRemind utilizes native Android system alarms (`AlarmManager`) and `@capacitor/local-notifications`, scheduled alerts may be delayed, silenced, suppressed, or prevented by:
   - Device power-saving modes (Android Doze, Adaptive Battery, or manufacturer-specific task killers e.g., Xiaomi MIUI, Samsung OneUI, OnePlus/Oppo battery restrictions).
   - Operating system updates, device reboots, or lack of background execution permissions.
   - User device volume settings, "Do Not Disturb" (DND) modes, or hardware malfunctions.
4.2. **Notifications Do Not Equal Ingestion:** A fired reminder or a dose logged as "Taken" does not constitute clinical or pharmacological proof that the medication was actually ingested or administered properly.
4.3. **Critical Medication Warning:** You must **never rely exclusively on MedRemind** for critical, life-sustaining, time-sensitive medications (e.g., insulin, anti-arrhythmics, emergency inhalers, immunosuppressants). You must maintain secondary manual reminder routines (e.g., pill organizers, written charts, family oversight).

---

### 5. ACCOUNT ELIGIBILITY & SECURITY
5.1. **Eligibility & Oversight:** Minors should use MedRemind under the supervision of a parent or legal guardian. Pediatric or dependent medication routines should be managed with the active guidance and supervision of a parent, legal guardian, or designated caregiver.
5.2. **Account Credentials:** You are responsible for safeguarding your login credentials. You must notify us immediately of any unauthorized access to your account.
5.3. **Account Suspension and Termination:** We reserve the right to suspend or terminate your account if you violate these Terms, engage in fraudulent or abusive activities, attempt to reverse-engineer the Application, or use the Services in a manner that compromises system integrity or third-party safety.

---

### 6. THIRD-PARTY SERVICES & INTEGRATIONS
6.1. **Identified Third-Party Providers:** The Application interfaces with selected external third-party services, including:
   - **Google Gemini API / Google AI Studio:** Provides multimodal optical prescription transcription at runtime when online mode is active.
   - **Tesseract.js Engine:** Open-source optical character recognition library.
   - **Capacitor Mobile Runtime:** Apache Cordova / Ionic native hardware bridging for camera and local notifications.
6.2. **Third-Party Terms Apply:** Your use of features reliant on external providers is subject to the respective terms, privacy policies, and service limits of those providers. We do not control and are not responsible for the availability, uptime, latency, or policy changes of external providers.

---

### 7. INTELLECTUAL PROPERTY & PERMITTED USE
7.1. **Proprietary Rights:** MedRemind, its user interface, visual design, custom logos, shorthand dosage translation engine (`drugKnowledgeBase.js`), workflow architecture, and source code are the intellectual property of **[Insert Legal Entity Name / Developer Name]** and are protected under copyright, trademark, and trade secret laws.
7.2. **Limited License:** We grant you a personal, revocable, non-exclusive, non-transferable, limited license to download, install, and use MedRemind on compatible Android and web devices strictly for personal, non-commercial healthcare management.
7.3. **Prohibited Conduct:** You shall not:
   - Decompile, reverse engineer, disassemble, or attempt to derive the source code of the Application.
   - Resell, sublicense, distribute, or commercially exploit the Application.
   - Upload malicious scripts, viruses, or automated scraping bots.
   - Use the Application for unauthorized clinical practice or commercial diagnostic operations.

---

### 8. LIMITATION OF LIABILITY
8.1. **Legally Permissible Limitations:** To the maximum extent permitted by applicable law (including the Indian Contract Act, 1872, and the Consumer Protection Act, 2019):
   - MedRemind, its developers, directors, employees, and licensors shall not be liable for any indirect, incidental, special, consequential, punitive, or exemplary damages, including but not limited to damages for personal health complications, medication errors resulting from unverified AI transcriptions, missed doses due to hardware notification suppression, loss of data, or medical expenses.
   - In no event shall MedRemind's aggregate cumulative liability arising out of or related to these Terms or the use of the Application exceed the amount actually paid by you to MedRemind in the twelve (12) months preceding the event giving rise to liability, or INR 1,000 (one thousand rupees), whichever is greater.
8.2. **Non-Excludable Statutory Rights:** Nothing in these Terms shall limit or exclude any liability that cannot legally be limited or excluded under applicable law, including liability for gross negligence, willful misconduct, or fraud.

---

### 9. DISCLAIMER OF WARRANTIES
THE APPLICATION IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. TO THE FULLEST EXTENT PERMISSIBLE UNDER APPLICABLE LAW, MEDREMIND DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY OF OCR OR AI TRANSCRIPTIONS.

---

### 10. GOVERNING LAW, JURISDICTION & DISPUTE RESOLUTION
10.1. **Governing Law:** These Terms shall be governed by, construed, and enforced in accordance with the laws of the Republic of India, without regard to conflict of law principles.
10.2. **Jurisdiction:** Subject to arbitration below, any legal action or proceeding arising under or in connection with these Terms shall be instituted exclusively in the competent civil courts located in **[Insert City, State e.g., Kolkata, West Bengal / Bengaluru, Karnataka]**, India.
10.3. **Amicable Resolution & Arbitration:** Any dispute, difference, or controversy arising out of or relating to these Terms shall first be resolved through good-faith mutual negotiations. If unresolved within thirty (30) days, the dispute shall be referred to and finally resolved by arbitration conducted under the Arbitration and Conciliation Act, 1996, by a sole arbitrator mutually appointed by the parties. The seat and venue of arbitration shall be **[Insert City, India]**, and the proceedings shall be conducted in the English language.

---

### 11. AMENDMENTS & MODIFICATIONS
We reserve the right to amend or update these Terms from time to time. When material changes occur, we will increment the document version, post the revised Terms within the Application, and present a renewed acceptance prompt upon your next login. Your continued use of the Application after the effective date of updated Terms signifies your acceptance.

---

### 12. CONTACT & GRIEVANCE REDRESSAL PLACEHOLDERS
For questions, notices, or formal grievances regarding these Terms and Conditions:

- **Entity / Developer Name:** [Insert Legal Entity Name / Developer Name]  
- **Registered Address:** [Insert Registered Address / City / Pincode, India]  
- **Email Contact:** [Insert Support Email, e.g., support@medremind.app]  
- **Grievance Officer:** [Insert Grievance Officer Name]  
- **Grievance Contact:** [Insert Grievance Officer Email / Phone]  
- **Response Timeline:** Acknowledged within 48 hours; resolved within 30 days pursuant to applicable statutory guidelines.
