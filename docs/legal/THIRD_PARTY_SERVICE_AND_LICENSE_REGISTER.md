# MEDREMIND — THIRD-PARTY SERVICE & SOFTWARE LICENSE REGISTER

**Document Version:** 2026.1  
**Last Updated:** November 2026  
**Audited Codebase:** MedRemind (`/home/zxurie/Documents/MedRemind`)

This Register identifies all third-party software libraries, native bridges, runtime platforms, and external APIs integrated into MedRemind.

---

### 1. EXTERNAL CLOUD APIS & AI SERVICES

| Service / API | Provider | Purpose in MedRemind | Processes Personal Data? | Receives Prescription Images/Data? | Terms & Privacy Links | License Type |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **Google Gemini API** (`@google/genai` v3.3.0) | Google LLC | Multimodal visual prescription document transcription | **YES** (Patient name, doctor, clinic if visible on image) | **YES** (Full raw image buffer transmitted in online mode) | [Gemini API Terms](https://ai.google.dev/gemini-api/terms) • [Google Privacy Policy](https://policies.google.com/privacy) | Commercial API / Apache 2.0 SDK |
| **Google AI Studio** | Google LLC | Developer API credential management & workspace configuration | **NO** (Developer environment only) | **NO** (Runtime data handled by Gemini API) | [AI Studio Terms](https://developers.google.com/terms) | Proprietary Developer Tool |

---

### 2. ON-DEVICE & LOCAL RUNTIME OCR

| Library | Version | Purpose in MedRemind | Processes Personal Data? | Receives Prescription Images/Data? | Data Transmission | Open Source License |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **Tesseract.js** | 7.0.0 | Pure JavaScript / WebAssembly optical character recognition for offline fallback | **YES** (Locally on machine/device) | **YES** (Processed locally) | **ZERO EXTERNAL TRANSMISSION** (Runs fully offline without network access) | Apache 2.0 |

---

### 3. NATIVE HARDWARE BRIDGES (CAPACITOR & ANDROID)

| Library / Plugin | Version | Purpose in MedRemind | Hardware Access | Permissions Required | License Type |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **@capacitor/core** | 8.6.0 | Cross-platform web-to-native JavaScript bridge | Hardware runtime | None | MIT License |
| **@capacitor/android** | 8.6.0 | Android native platform wrapper | Android OS integration | INTERNET | MIT License |
| **@capacitor/camera** | 8.2.6 | Camera photo capture & gallery document selection | Device camera & photo storage | CAMERA, READ_MEDIA_IMAGES | MIT License |
| **@capacitor/local-notifications** | 8.3.1 | Scheduling offline dose reminder alarms and push notifications | Android AlarmManager | POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, USE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED, VIBRATE | MIT License |

---

### 4. FRONTEND CORE LIBRARIES (REACT & VITE)

| Library | Version | Purpose | Data Handled | Open Source License |
| :--- | :--- | :--- | :--- | :--- |
| **React** | 18.3.1 | Declarative component UI framework | User interface state | MIT License |
| **React DOM** | 18.3.1 | DOM rendering engine for React | Browser rendering | MIT License |
| **React Router DOM** | 7.18.5 | Client-side routing, navigation & role guards | Route parameters | MIT License |
| **Tailwind CSS** | 4.3.5 | Utility-first styling engine | CSS styling | MIT License |
| **Lucide React** | 1.72.0 | Accessible SVG iconography | Visual presentation | ISC License |
| **Date-fns** | 4.4.0 | Date formatting & schedule slot calculations | Timestamps | MIT License |
| **Sonner** | 2.0.8 | Accessible toast notification popups | UI alerts | MIT License |
| **React Hook Form** | 7.92.0 | Form state management | Form inputs | MIT License |
| **Zod** | 4.6.7 | TypeScript-first schema validation | Form validation | MIT License |
| **Vite** | 5.4.10 | Frontend build tool & development server | Build bundler | MIT License |

---

### 5. BACKEND RUNTIME LIBRARIES (NODE.JS & EXPRESS)

| Library | Version | Purpose | Data Handled | Open Source License |
| :--- | :--- | :--- | :--- | :--- |
| **Express** | 5.3.0 | HTTP REST API server | Request routing & payload handling | MIT License |
| **Cors** | 2.8.6 | Cross-Origin Resource Sharing middleware | HTTP headers | MIT License |
| **Multer** | 2.5.0 | Multipart/form-data upload handler | File buffering | MIT License |
| **Dotenv** | 18.0.10 | Server-side environment variable loader | Environment configuration | BSD-2-Clause |

---

### 6. DATA TRANSMISSION SUMMARY & ATTESTATION
- **Zero Hidden Analytics:** MedRemind does NOT embed third-party analytics trackers, advertising SDKs (e.g., Google AdMob, Meta Audience Network, Flurry), behavioral telemetry, or social tracking cookies.
- **Strict Network Isolation in Offline Mode:** When offline mode is chosen, the Application communicates strictly via localhost (`http://localhost:3001` or on-device) and initiates zero outbound WAN requests.
