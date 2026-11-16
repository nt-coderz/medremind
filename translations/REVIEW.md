# MedRemind Translation Review & Indic Localization Guide

This document lists all key clinical, pharmaceutical, and healthcare terminology localized across English and the 22 Scheduled Languages of India for expert medical review.

## 1. Core Clinical Vocabulary

| English Term | Clinical Context | Hindi (हिन्दी) | Bengali (বাংলা) | Notes & Guidance |
| :--- | :--- | :--- | :--- | :--- |
| **Medication / Medicine** | Drug prescribed by physician | दवा / दवाई | ওষুধ / ঔষধ | Avoid using "ड्रग" (drug) in consumer UI; use colloquial "दवा". |
| **Prescription** | Formal physician Rx order | पर्ची / नुस्खा | প্রেসক্রিপশন / ব্যবস্থাপত্র | "पर्ची" is widely understood across North India; "ব্যবস্থাপত্র" is formal in Bengali. |
| **Dosage** | Quantity per administration (e.g. 1 Tab) | खुराक | মাত্রা | Quantity of medicine taken at a single time slot. |
| **Adherence** | Compliance with prescribed schedule | अनुपालन | নিয়মানুবর্তিতা | Percentage of scheduled doses taken on time. |
| **Allergy** | Adverse immunological drug reaction | एलर्जी | অ্যালার্জি | Transliterated phonetic form is universally recognized. |
| **Before Meals (AC)** | Empty stomach administration | भोजन से पहले (खाली पेट) | খাবারের আগে (খালি পেটে) | Vital for PPI antacids (e.g., Pantoprazole, Omeprazole). |
| **After Meals (PC)** | Post-prandial administration | भोजन के बाद | খাবারের পরে | Prevents gastrointestinal distress (e.g., NSAIDs, Metformin). |
| **At Bedtime (HS)** | Night administration before sleep | सोते समय / रात में | শোবার সময় / রাতে | Used for statins (Atorvastatin) and sedatives. |
| **As Needed (SOS)** | Prn administration for acute symptoms | आवश्यकतानुसार | প্রয়োজন অনুযায়ী | For analgesics/antipyretics (Dolo 650, Calpol). |
| **Chronic Condition** | Long-term illness (Diabetes, BP) | पुरानी बीमारी | দীর্ঘস্থায়ী রোগ | Displayed in patient medical profile. |
| **Blood Type** | ABO and Rh grouping | रक्त समूह | রক্তের গ্রুপ | Essential for emergency contact summary. |

---

## 2. Technical Note on Indic OCR Requirements

MedRemind currently runs **on-device client OCR using Tesseract.js** with `eng.traineddata` (English) and **server-side Gemini Multimodal Vision API**.

To expand offline on-device OCR to Indic scripts (Devanagari, Bengali, Tamil, Telugu, etc.):
1. **Traineddata Bundling**:
   - Tesseract `.traineddata` files must be downloaded and bundled under `public/tesseract/` for each desired language:
     - `hin.traineddata` (~18 MB, Hindi / Devanagari)
     - `ben.traineddata` (~14 MB, Bengali)
     - `tam.traineddata` (~15 MB, Tamil)
     - `tel.traineddata` (~14 MB, Telugu)
   - *Impact on APK Size*: Bundling all 22 languages would add ~300 MB to the APK. Hence, English + Hindi are prioritized for local on-device OCR, while cloud Gemini handles all 22 scripts via multimodal vision without increasing mobile bundle size.
2. **Font Rendering & Complex Text Layout (CTL)**:
   - Indic scripts rely on ligatures, conjuncts, and vowel signs (matras).
   - Capacitor Android WebViews on Android 7.0+ (API 24+) natively support Noto Sans fonts for all 22 scheduled scripts without external CDNs.
