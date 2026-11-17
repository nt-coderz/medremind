# 🌿 MedRemind — Intelligent Medication Adherence & Prescription Safety Platform

> **Built with pride by Team Sanjeevani**  
> *3 Class 11 students from The Newtown School, Kolkata — Aryan Singhania, Tanishq Ghosh, and Naman Thard.*

---

## 📌 Overview

**MedRemind** is an intelligent, privacy-first, offline-resilient healthcare companion designed to eliminate medication errors, optimize daily treatment compliance, and make healthcare management universally accessible across India.

Combining **Vite + React**, **Capacitor Android native APIs**, **Google Gemini Multimodal AI**, **offline Tesseract OCR**, and the **Official Indian Pharmaceutical Database (253,000+ medicines)**, MedRemind bridges clinical precision with an intuitive, empathetic user experience in 23 languages.

---

## ✨ Key Features & Capabilities

### 1. 📷 Smart Prescription & Medicine Strip Scanner
* **Dual-Tier OCR Engine**:
  * **Cloud Vision (Gemini)**: High-precision handwriting and printed text recognition utilizing `gemini-3.1-flash-lite` and `gemini-3.5-flash` with structured JSON schema outputs.
  * **Offline Tesseract Engine**: Local on-device OCR using adaptive Otsu thresholding, image scaling (1600–2200px), deskewing, and Levenshtein fuzzy matching against known drug entities.
* **Clinical Extraction**: Automatically extracts Brand Name, Generic Formulation, Strength (`mg`, `mcg`, `ml`, `IU`), Dosage Notation (`1-0-1`, `OD`, `BD`, `TDS`, `HS`, `SOS`), Duration, and Administration Timing (Before/After food).
* **Mandatory Human-in-the-Loop Verification**: Discovered medications are presented in an editable review sheet so patients can verify and amend entries before adding them to their active routine.

### 2. 💊 Comprehensive Medicines Management & Indian Drug Database
* **253,973 Indian Pharmaceuticals Indexed**: Integrated directly with official Indian pharmaceutical datasets stored in an ultra-fast local SQLite database (`backend/data/indian_medicines.db`).
* **Live Autocomplete**: Real-time drug search suggestions as you type medicine names in the Add/Edit form, helping avoid spelling errors.
* **Safety Knowledge Base**: Includes contraindications, manufacturer information, drug classes, and food/alcohol interaction precautions.

### 3. ⏰ Daily Schedule & Adherence Tracking
* **Time-Slot Segmentation**: Morning, Afternoon, Evening, and Bedtime doses with visual status indicators.
* **One-Tap Actions**: Log doses as **Taken**, **Skipped**, or **Undo** past entries.
* **Accurate Adherence Metrics**: Falsely claiming 100% adherence when no doses are scheduled is strictly prevented. Empty or neutral days cleanly indicate `"No doses scheduled today"`.
* **Countdown Timers**: Dynamic indicator for the next upcoming dose.

### 4. 📊 Weekly Compliance Analytics (Recharts)
* **Visual Compliance Breakdown**: Accessible, stacked bar chart displaying daily percentages of Taken vs. Skipped vs. Missed doses.
* **Interactive Navigation**: Seamlessly navigate through past weeks (future weeks are disabled).
* **Accessible Visual Signals**: Pattern-assisted cues and clear numeric tooltips ensure high readability on all screen sizes.

### 5. 📄 Export Doctor Medication History (Clinical PDF)
* **One-Click PDF Generation**: Generates a standardized clinical report formatted with `jspdf` and `jspdf-autotable`.
* **Comprehensive Record**: Includes patient demographics, active prescriptions, dosages, administration instructions, and weekly adherence percentage.
* **Native Android Sharing**: Direct PDF save and share via Android system share sheet (`@capacitor/share` and `@capacitor/filesystem`).

### 6. 🌐 Multilingual Accessibility for All of India (23 Languages)
* **Constitutional 22 Scheduled Languages + English**:
  * English, Hindi (हिन्दी), Bengali (বাংলা), Assamese (অসমীয়া), Bodo (बर'), Dogri (डोगरी), Gujarati (ગુજરાતી), Kannada (ಕನ್ನಡ), Kashmiri (कॉशुर / کٲشُر), Konkani (कोंकणी), Maithili (मैथिली), Malayalam (മലയാളം), Manipuri / Meitei (মৈতৈলোন্), Marathi (मराठी), Nepali (नेपाली), Odia (ଓଡ଼ିଆ), Punjabi (ਪੰਜਾਬੀ), Sanskrit (संस्कृतम्), Santali (संताली), Sindhi (سنڌي / सिंधी), Tamil (தமிழ்), Telugu (తెలుగు), Urdu (اردو).
* **Smart Language Picker**:
  * English & Hindi pinned at the top.
  * Auto-suggested language row detected from device locale (`navigator.languages`).
  * Search by native script, English, or romanized keywords (e.g. "bangla", "oriya").
  * Instant switching without page reload.
  * Bidirectional RTL layout support for Urdu, Kashmiri, and Sindhi.

### 7. 🤖 Medi — Empathetic AI Companion
* **3-Tier Resilient Architecture**:
  1. **Tier 1 (Backend API)**: Secure `/api/chat` with rate limiting and conversation history.
  2. **Tier 2 (Direct Gemini API)**: Native device connectivity using Google Gemini `gemini-3.1-flash-lite` and `gemini-3.5-flash` models.
  3. **Tier 3 (Offline Clinical FAQ)**: Instant offline replies for dosage queries, app navigation, and common medications (e.g., P-650 / Paracetamol / Dolo).
* **Multilingual Fluency**: Responds in the patient's active selected language.
* **Clinical Safety Boundaries**: Always provides statutory disclaimers, never diagnoses illnesses, and instructs users to dial emergency services (112 / 102) when acute symptoms are mentioned.

### 8. 🥗 Food & Nutrition Tracker
* **Macronutrient Logging**: Daily tracking of Calories (kcal), Protein (g), Carbohydrates (g), Fats (g), and Dietary Fibre (g).
* **Visual Progress Meters**: Goal tracking against Indian RDA (Recommended Dietary Allowances).

### 9. 🛡️ Statutory Legal & Privacy Compliance (DPDP Act, 2023)
* **Indian DPDP Act Compliance**: Mandatory consent collection on signup for data processing, age affirmation, and AI processing disclosures.
* **Local Offline Persistence**: All medical details (allergies, chronic conditions, blood group, emergency contacts) persist immediately to device storage (`localStorage`).
* **Emergency Dialing**: One-tap phone call intent directly to emergency contacts.

### 10. ⚙️ MedRemind Administrator Console
* **Portal URL**: Direct access via Admin credentials.
* **System Metrics**: Total registered users, active patients, and active prescriptions count.
* **Audit Logs**: Tamper-evident logging of signups, logins, and prescription approvals.

---

## 📱 Installing the Android APK on a Phone

The standalone production debug APK is pre-compiled and located in this directory:

* **File**: `MedRemind-debug.apk` (or `APK/MedRemind-debug.apk`)
* **Size**: ~32.0 MB
* **Compatibility**: Android 8.0 (Oreo) through Android 15+

### Installation Steps:
1. Copy `MedRemind-debug.apk` to your Android phone via USB cable, Google Drive, WhatsApp, or Quick Share.
2. Tap the APK file on your phone.
3. If prompted with *"Install unknown apps"*, tap **Settings** and enable permission for your browser or file manager.
4. Tap **Install** and then **Open**!

---

## 💻 Running & Developing the Code Locally

### Prerequisites
* **Node.js**: v18.0.0 or higher (Node v20+ / v24 recommended)
* **npm**: v9.0.0 or higher
* **Java JDK**: 17 or 21 (for building Android native binaries)
* **Android Studio**: (optional, for running in Android emulator or modifying native code)

### Project Directory Structure
```text
MEDREMIND FINAL/
├── MedRemind-debug.apk         # Compiled Android APK (Root)
├── app-icon.png                # High-res 512x512 app icon
├── README.md                   # Complete documentation
├── README.txt                  # Plain-text quick reference
├── APK/
│   └── MedRemind-debug.apk     # Secondary APK backup
└── MedRemind-Source-and-APK/
    └── MedRemind-Friend-Build/ # Full project source
        ├── index.html
        ├── package.json
        ├── vite.config.js
        ├── tailwind.config.js
        ├── .env                # App & Gemini API configuration
        ├── src/
        │   ├── main.jsx
        │   ├── App.jsx
        │   ├── components/     # UI components (Header, Nav, Charts, Chatbot, Modals)
        │   ├── context/        # React context (AuthContext, MedicineContext)
        │   ├── pages/          # Patient, Admin, Auth, and Legal views
        │   ├── i18n/           # 23 Indian language JSON bundles & i18next setup
        │   ├── services/       # OCR, Gemini AI, Audio, PDF, and API handlers
        │   └── utils/          # Indian medicines database and clinical helpers
        ├── backend/
        │   ├── server.js       # Node.js Express API server
        │   ├── geminiService.js# Server-side Gemini prescription analysis
        │   ├── ocrService.js   # Tesseract OCR and PDF extraction
        │   └── data/
        │       └── indian_medicines.db # Indexed SQLite database (253,973 medicines)
        └── android/            # Capacitor native Android Studio project
```

---

### Step-by-Step Instructions to Run

#### 1. Start the Frontend (Vite Web App)
Open a terminal in `MedRemind-Friend-Build`:
```bash
cd "MedRemind-Source-and-APK/MedRemind-Friend-Build"
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

#### 2. Start the Backend API Server (Optional, for Cloud OCR & Sync)
In a second terminal:
```bash
cd "MedRemind-Source-and-APK/MedRemind-Friend-Build/backend"
npm install
npm start
```
The backend server runs on `http://localhost:3001` and connects to `backend/data/indian_medicines.db`.

#### 3. Build Web Assets & Sync with Capacitor Android
Whenever you modify frontend code:
```bash
cd "MedRemind-Source-and-APK/MedRemind-Friend-Build"
npm run build
npx cap sync android
```

#### 4. Compile the Android APK via Command Line
```bash
cd "MedRemind-Source-and-APK/MedRemind-Friend-Build/android"
# On Windows:
.\gradlew.bat assembleDebug

# On Linux/macOS:
./gradlew assembleDebug
```
The newly compiled APK will be at:
`android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🏛️ Regulatory & Clinical Disclaimers

> **Clinical Notice**: MedRemind is a personal medication reminder organizer and adherence companion. It is NOT a diagnostic device, clinical decision system, or substitute for professional medical consultation.
>
> **AI / OCR Transparency**: Digital prescription and pill strip recognition features generate draft schedules for patient review. In compliance with the Digital Personal Data Protection (DPDP) Act, 2023, automated health records require explicit user verification and consent before activation.

---

## 🏆 Credits & Attribution

Designed and developed by **Team Sanjeevani**:
* **Aryan Singhania** (Class 11, The Newtown School, Kolkata)
* **Tanishq Ghosh** (Class 11, The Newtown School, Kolkata)
* **Naman Thard** (Class 11, The Newtown School, Kolkata)
