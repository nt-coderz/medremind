/**
 * MedRemind Client-Side AI & Chat Assistant Service
 * 
 * Provides 3-tier resilient architecture:
 * Tier 1: Cloud Backend (/api/chat) if online and responsive
 * Tier 2: Direct Google Gemini Generative Language API (using user's configured GEMINI_API_KEY)
 * Tier 3: Local Offline Clinical FAQ & Action Routing (zero internet needed)
 */

import { apiFetch, isOnline } from '../config/apiConfig';

export const OFFLINE_CLINICAL_FAQS = [
  {
    triggers: ['dose', 'next dose', 'when', 'schedule', 'time'],
    reply: "Check your Dashboard or Schedule tab to see your next due doses. Reminders fire locally on your phone even when offline!",
    actions: [{ label: 'View Schedule', path: '/schedule' }]
  },
  {
    triggers: ['scan', 'prescription', 'strip', 'ocr', 'camera', 'photo'],
    reply: "Tap the 'Scan Prescription' button or open Scanner (/scanner) to scan prescription papers or medicine strips. Offline OCR works without internet.",
    actions: [{ label: 'Scan Prescription', path: '/scanner' }]
  },
  {
    triggers: ['p-650', 'paracetamol', 'dolo', 'fever', 'pain', 'headache'],
    reply: "Paracetamol 650 mg (P-650 / Dolo-650) is an antipyretic and analgesic used for fever and mild-to-moderate pain. Standard adult dosage is usually 1 tablet as needed (with a gap of at least 4-6 hours, max 3000-4000 mg/day). Always take with water after food and consult your prescribing doctor.",
    actions: [{ label: 'Open Medicines', path: '/medicines' }]
  },
  {
    triggers: ['who made', 'who created', 'team', 'author', 'developer', 'credit', 'sanjeevani'],
    reply: "MedRemind was designed and built by Team Sanjeevani: Aryan Singhania, Tanishq Ghosh, and Naman Thard from The Newtown School, Kolkata.",
    actions: []
  },
  {
    triggers: ['take', 'how to take', 'log', 'mark'],
    reply: "On your Dashboard or Schedule screen, tap the green 'Take' button next to any scheduled dose to mark it as taken.",
    actions: [{ label: 'Open Dashboard', path: '/dashboard' }]
  },
  {
    triggers: ['allergy', 'allergies', 'blood', 'doctor', 'emergency'],
    reply: "You can manage your known drug allergies, blood group, chronic conditions, and emergency contacts in your Profile.",
    actions: [{ label: 'Open Profile', path: '/profile' }]
  }
];

export function getOfflineFaqResponse(userText) {
  const lower = (userText || '').toLowerCase().trim();
  
  for (const faq of OFFLINE_CLINICAL_FAQS) {
    if (faq.triggers.some(tr => lower.includes(tr))) {
      return faq.reply;
    }
  }

  return "I'm Medi, your medication companion! You can track your daily doses, scan prescriptions offline, view your schedule, and check medicine details.";
}

/**
 * Send user query to Medi Assistant
 */
export async function sendQueryToMedi({ message, history = [], user, medicines = [] }) {
  const cleanMsg = (message || '').trim();
  if (!cleanMsg) return "Please enter a question or topic to ask Medi.";

  // Tier 1: Try Backend /api/chat with a short 3.5s timeout
  if (isOnline()) {
    try {
      const response = await apiFetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanMsg,
          history: (history || []).slice(-6)
        })
      }, 3500);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.reply) {
          return data.reply;
        }
      }
    } catch (e) {
      // Backend /api/chat is 404 or down, seamlessly fall back to Tier 2
    }
  }

  // Tier 2: Direct Google Gemini REST API using VITE_GEMINI_API_KEY
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

  if (geminiKey && isOnline()) {
    try {
      const medSummary = (medicines || [])
        .filter(m => m.status === 'Active' || m.status === 'ACTIVE')
        .map(m => `- ${m.name} (${m.dosage || '1 dose'}, ${m.frequency || 'Daily'}, times: ${(m.times || []).join(', ') || 'as prescribed'})`)
        .join('\n') || 'No active medicines recorded yet';

      const systemPrompt = `You are Medi, an empathetic, caring, and knowledgeable medication assistant inside the MedRemind app.
Your mission is to help the user manage their medications, understand reminders, navigate the app, and live a healthier life.

USER CONTEXT:
Patient Name: ${user?.name || 'Friend'}
App Language: ${localStorage.getItem('app_language') || 'en'}
CRITICAL LANGUAGE INSTRUCTION:
- If the user's question is in Hindi or an Indic language, OR if the app language is not English, respond fluently in that language (e.g. Hindi, Bengali, Tamil, etc.).
- If the user asks in English, you may respond in English.
Active Medicines:
${medSummary}

APP NAVIGATION GUIDE:
- "Dashboard" (or "Home"): Shows today's doses, adherence percentage, and next scheduled medicine.
- "Medicines": List of all active medicines, add custom medicines, or edit existing ones.
- "Scan Prescription" (or "Scanner"): Scan prescriptions or medicine strips using camera or file upload.
- "Schedule": Detailed calendar and time-slot breakdown of morning, afternoon, evening, and night doses.
- "History": View compliance logs, charts, and export doctor reports as PDF.
- "Profile": Manage profile, allergies, blood type, medical info, emergency contacts, and language settings.

APP CREDITS:
If the user asks "who made this app?", "who created you?", "who built MedRemind?", or asks for credits/team, answer warmly:
"MedRemind was designed and built by Team Sanjeevani: Aryan Singhania, Tanishq Ghosh, and Naman Thard from The Newtown School, Kolkata."

SAFETY BOUNDARIES:
1. You are an AI assistant, NOT a doctor.
2. NEVER diagnose illnesses and NEVER prescribe medications.
3. If the user mentions emergency red-flag symptoms (severe chest pain, difficulty breathing, anaphylaxis, severe bleeding), urge them to seek immediate emergency medical care.

Keep your tone friendly, warm, empathetic, and concise. Format responses with clean markdown bullet points where helpful.`;

      const contents = [
        {
          role: 'user',
          parts: [{ text: systemPrompt }]
        },
        {
          role: 'model',
          parts: [{ text: "Hello! I'm Medi, your personal MedRemind assistant. How can I help you today?" }]
        }
      ];

      (history || []).slice(-6).forEach(h => {
        if (h.text && h.text.trim()) {
          contents.push({
            role: h.sender === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        }
      });

      contents.push({
        role: 'user',
        parts: [{ text: cleanMsg }]
      });

      // Prefer fast and available models
      const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
      for (const model of modelsToTry) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 600
              }
            })
          });

          if (res.ok) {
            const json = await res.json();
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim()) {
              return text.trim();
            }
          }
        } catch (mErr) {
          // Try next model candidate
        }
      }
    } catch (err) {
      console.warn('[Medi] Direct Gemini request failed, using FAQ fallback:', err.message);
    }
  }

  // Tier 3: Local Offline FAQ Matching
  return getOfflineFaqResponse(cleanMsg);
}
