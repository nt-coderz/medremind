import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { ShieldCheck, FileText, Lock, Sparkles, Award, School, ExternalLink } from 'lucide-react';
import { LEGAL_VERSIONS } from '../../data/legalDocuments';

export default function LegalModal({ isOpen, onClose, type = 'terms' }) {
  if (!isOpen) return null;

  const isTerms = type === 'terms';
  const isPrivacy = type === 'privacy';
  const isAi = type === 'ai';
  const isTeam = type === 'team';

  const title = isTerms 
    ? 'MedRemind Terms & Conditions' 
    : isPrivacy 
      ? 'MedRemind Privacy Policy' 
      : isTeam
        ? 'Team Sanjeevani Attribution & Credits'
        : 'Google Gemini AI & OCR Disclosure';

  const Icon = isTerms ? FileText : isPrivacy ? Lock : isTeam ? Award : Sparkles;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 text-xs text-[#202B28] leading-relaxed">
        
        {/* Team Sanjeevani Creator Attribution Card */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#238B78] to-[#1b6d5e] text-white shadow-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[10.5px] uppercase tracking-wider text-amber-300">
            <Award className="w-4 h-4 text-amber-300" />
            Designed & Built by Team Sanjeevani
          </div>
          <p className="text-xs font-semibold leading-snug text-white">
            3 Class 11 boys from The Newtown School, Kolkata — Aryan Singhania, Tanishq Ghosh, and Naman Thard.
          </p>
        </div>

        {/* Version Badge Header */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8] text-[11px]">
          <span className="flex items-center gap-1.5 font-semibold text-[#1b6d5e]">
            <Icon className="w-4 h-4 text-[#238B78]" />
            {isTeam ? 'Official Project Attribution' : `Version ${LEGAL_VERSIONS.TERMS}`}
          </span>
          <span className="text-[#7A8782]">Effective: {LEGAL_VERSIONS.LAST_UPDATED}</span>
        </div>

        {/* TEAM CONTENT */}
        {isTeam && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1.5">
              <h4 className="font-bold text-xs flex items-center gap-1.5">
                <School className="w-4 h-4 text-[#238B78]" /> The Newtown School, Kolkata
              </h4>
              <p className="text-[11px] leading-relaxed text-emerald-900">
                MedRemind was conceptualized, designed, and engineered by Team Sanjeevani: 3 Class 11 boys from The Newtown School, Kolkata — Aryan Singhania, Tanishq Ghosh, and Naman Thard.
              </p>
            </div>
            <section className="space-y-1 text-xs text-[#7A8782]">
              <h4 className="font-bold text-[#1b6d5e]">Mission & Innovation</h4>
              <p>
                Built to solve the critical public health challenge of medication non-adherence in Indian households through local on-device OCR, multi-language support across all 22 scheduled languages, and adherence verification.
              </p>
            </section>
          </div>
        )}

        {/* TERMS CONTENT */}
        {isTerms && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <p className="font-bold uppercase tracking-wider text-[10px]">Critical Medical Notice</p>
              <p className="text-[11px]">
                MedRemind is a personal medication reminder organizer. It is <strong>NOT</strong> a medical advice service, diagnostic tool, or replacement for licensed doctors and pharmacists. Always verify AI-extracted fields against your physical paper prescription.
              </p>
            </div>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">1. Application Purpose</h4>
              <p>
                MedRemind provides scheduling, reminder alerts, and prescription text organization. The application does not provide clinical care, evaluate therapeutic efficacy, or recommend dosage changes.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">2. AI Prescription Extraction & OCR Drafts</h4>
              <p>
                Optical character recognition (Tesseract.js) and multimodal artificial intelligence (Google Gemini API) are provided strictly as draft assistance tools. Extracted medicine names, strengths (e.g., 650 mg vs 500 mg), and dosage shorthand (e.g., 1-0-1) are preliminary and may contain errors.
              </p>
              <p className="font-medium text-[#1b6d5e]">
                No medication or reminder schedule becomes active without your explicit manual review and approval.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">3. User Responsibility & Health Safety</h4>
              <p>
                You are solely responsible for reviewing and verifying every extracted field against your original prescription. If any handwriting is unclear or flagged as uncertain, you agree not to guess or assume the dosage and to contact your physician or pharmacist for clarification.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">4. Hardware Notification Limitations</h4>
              <p>
                Reminders utilize device-level system alarms. Notifications may be delayed or silenced by device power-saving modes (Android Doze, aggressive manufacturer battery optimization), updates, or device volume settings. Do not rely exclusively on MedRemind for critical, life-sustaining medications.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">5. Eligibility & Account Use</h4>
              <p>
                Minors should use MedRemind under the supervision of a parent or legal guardian.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">6. Governing Law & Dispute Resolution</h4>
              <p>
                These Terms are governed by the laws of India. Any legal dispute shall be subject to amicable resolution, arbitration under the Arbitration and Conciliation Act, 1996, and the jurisdiction of competent courts in India.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">7. Contact & Grievance Placeholders</h4>
              <p className="text-[#7A8782]">
                Developer/Entity: [Insert Legal Entity Name] • Address: [Insert Registered Address, India] • Grievance Email: [Insert Support Email]
              </p>
            </section>
          </div>
        )}

        {/* PRIVACY CONTENT */}
        {isPrivacy && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
              <p className="font-bold uppercase tracking-wider text-[10px]">DPDP Act, 2023 Compliance Notice</p>
              <p className="text-[11px]">
                Your personal health data is processed as a Data Fiduciary under the Digital Personal Data Protection Act, 2023, based on your explicit, informed consent.
              </p>
            </div>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">1. Data Collected</h4>
              <p>
                We collect your name, email, password hash, role, prescription images, extracted medication details (names, strengths, doses, meal timings), scheduled alarm timestamps, and documented allergies.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">2. Google Gemini API Data Transmission</h4>
              <p>
                When you use <strong>"Scan with Gemini (Internet required)"</strong>, the complete digital prescription image is transmitted to Google's Gemini API for text recognition. This image may contain patient names, doctor details, clinic letterheads, and prescribed drugs.
              </p>
              <p className="text-amber-800 font-medium">
                Note on Google Tiers: On Google's unpaid developer tier, inputs may be retained by Google for model improvement. Real patient health data must not be submitted via unpaid developer keys.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">3. Offline Tesseract OCR Alternative</h4>
              <p>
                When you select <strong>"Scan offline (Tesseract)"</strong>, processing occurs entirely on local infrastructure. Zero prescription image bytes or patient names are transmitted to Google or any cloud server.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">4. Local & Isolated Storage</h4>
              <p>
                Personal profiles and scheduled routines are stored in your device's local storage. Prescriptions and backend stores are excluded from version control and Git repositories via security filters.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">5. Your Statutory Rights</h4>
              <p>
                Under the DPDP Act, you have the right to access your processed data, correct inaccuracies, request complete erasure of your account and prescription images, nominate a representative, and withdraw consent at any time.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">6. Grievance Officer</h4>
              <p className="text-[#7A8782]">
                Grievance Officer: [Insert Grievance Officer Name] • Email: [Insert Grievance Email] • Acknowledged within 48h; resolved within 30 days.
              </p>
            </section>
          </div>
        )}

        {/* AI DISCLOSURE CONTENT */}
        {isAi && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 space-y-1">
              <p className="font-bold uppercase tracking-wider text-[10px]">Google AI Studio & Gemini API Runtime Disclosure</p>
              <p className="text-[11px]">
                MedRemind uses Google's Gemini multimodal AI strictly for optical document transcription into draft reminder entries.
              </p>
            </div>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">1. Architectural Role of Gemini</h4>
              <p>
                Gemini API (model <code>gemini-3.5-flash</code>) is invoked at runtime to read handwriting and printed text on uploaded prescription photos. It identifies drug names, dosage numbers, and meal timings to pre-fill the medication reminder editor.
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">2. What Gemini NEVER Does</h4>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#7A8782]">
                <li>Never diagnoses conditions or interprets medical symptoms.</li>
                <li>Never recommends medications, alternatives, or dosage modifications.</li>
                <li>Never overrides prescribing doctor instructions.</li>
                <li>Never activates reminder schedules without manual user confirmation.</li>
              </ul>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">3. Official Google Policy Links</h4>
              <div className="space-y-1 pt-1 text-[11px]">
                <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer" className="text-[#238B78] hover:underline flex items-center gap-1">
                  Gemini API Additional Terms of Service <ExternalLink className="w-3 h-3" />
                </a>
                <a href="https://policies.google.com/terms/generative-ai/use-policy" target="_blank" rel="noreferrer" className="text-[#238B78] hover:underline flex items-center gap-1">
                  Google Generative AI Prohibited Use Policy <ExternalLink className="w-3 h-3" />
                </a>
                <a href="https://ai.google.dev/gemini-api/docs/zdr" target="_blank" rel="noreferrer" className="text-[#238B78] hover:underline flex items-center gap-1">
                  Zero Data Retention (ZDR) Documentation <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </section>

            <section className="space-y-1">
              <h4 className="font-bold text-[#1b6d5e] text-xs">4. Stated Scope & Google Written Response Record</h4>
              <p className="text-[11px] text-[#7A8782]">
                Intended Scope: Image-to-text transcription • Autofilling draft reminder entries • Mandatory manual user review and approval • No medical advice or clinical practice.
              </p>
              <div className="p-2 rounded-lg bg-gray-100 border border-gray-200 text-[10px] font-mono text-gray-700">
                [Insert Exact Text of Google Written Response if available]
              </div>
            </section>
          </div>
        )}

      </div>

      <div className="pt-3 border-t border-[#E6ECE8] flex justify-end">
        <Button size="sm" variant="primary" onClick={onClose}>
          I Understand & Close
        </Button>
      </div>
    </Modal>
  );
}
