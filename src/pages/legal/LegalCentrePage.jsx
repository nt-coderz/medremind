import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import BrandLogo from '../../components/common/BrandLogo';
import { 
  FileText, 
  Lock, 
  Sparkles, 
  BookOpen, 
  ShieldCheck, 
  ArrowLeft, 
  ExternalLink, 
  Download, 
  CheckCircle2, 
  AlertTriangle,
  Award 
} from 'lucide-react';
import { LEGAL_VERSIONS } from '../../data/legalDocuments';
import { useAuth } from '../../context/AuthContext';
import { getUserConsentRecord, revokeUserConsent } from '../../services/legalConsentService';
import { toast } from 'sonner';

export default function LegalCentrePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('terms');

  const consentRecord = currentUser ? getUserConsentRecord(currentUser.id) : null;

  const handleExportConsent = () => {
    if (!consentRecord) {
      toast.info('No recorded consent on file for current session.');
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(consentRecord, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `medremind_consent_receipt_${currentUser.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Statutory Consent Receipt downloaded');
  };

  const handleRevoke = () => {
    if (!currentUser) return;
    if (window.confirm("Are you sure you want to withdraw your DPDP consent? This will restrict online features and require re-acceptance.")) {
      revokeUserConsent(currentUser.id);
      toast.warning('Consent withdrawn. You will be prompted on next login.');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 space-y-4 max-w-2xl mx-auto w-full">
      {/* Header with Back Navigation */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-[#238B78] font-semibold hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <span className="text-[11px] font-semibold text-[#7A8782]">
          Version {LEGAL_VERSIONS.TERMS} • {LEGAL_VERSIONS.LAST_UPDATED}
        </span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-[#202B28] flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-[#238B78]" />
          MedRemind Legal Centre
        </h1>
        <p className="text-xs text-[#7A8782] mt-0.5">
          Comprehensive Terms, Privacy Policy (DPDP Act, 2023), and AI Governance disclosures.
        </p>
      </div>

      {/* Official Team Sanjeevani Attribution Card */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#238B78] to-[#1b6d5e] text-white shadow-xs space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-amber-300">
          <Award className="w-4 h-4 text-amber-300" />
          Designed & Built by Team Sanjeevani
        </div>
        <p className="text-xs font-semibold leading-relaxed text-white">
          3 Class 11 boys from The Newtown School, Kolkata — Aryan Singhania, Tanishq Ghosh, and Naman Thard.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E6ECE8] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('terms')}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'terms'
              ? 'bg-[#238B78] text-white shadow-xs'
              : 'bg-white text-[#7A8782] border border-[#E6ECE8] hover:bg-[#F8FAF8]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Terms & Conditions
        </button>

        <button
          onClick={() => setActiveTab('privacy')}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'privacy'
              ? 'bg-[#238B78] text-white shadow-xs'
              : 'bg-white text-[#7A8782] border border-[#E6ECE8] hover:bg-[#F8FAF8]'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          Privacy Policy
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'ai'
              ? 'bg-[#238B78] text-white shadow-xs'
              : 'bg-white text-[#7A8782] border border-[#E6ECE8] hover:bg-[#F8FAF8]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Gemini AI Disclosure
        </button>

        <button
          onClick={() => setActiveTab('licenses')}
          className={`py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'licenses'
              ? 'bg-[#238B78] text-white shadow-xs'
              : 'bg-white text-[#7A8782] border border-[#E6ECE8] hover:bg-[#F8FAF8]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Third-Party Register
        </button>

        {currentUser && (
          <button
            onClick={() => setActiveTab('consent')}
            className={`py-2 px-3 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'consent'
                ? 'bg-[#238B78] text-white shadow-xs'
                : 'bg-white text-[#7A8782] border border-[#E6ECE8] hover:bg-[#F8FAF8]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            My Consent
          </button>
        )}
      </div>

      {/* TAB CONTENT: TERMS */}
      {activeTab === 'terms' && (
        <Card className="p-4 space-y-4 text-xs text-[#202B28] leading-relaxed bg-white shadow-xs">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
            <h3 className="font-bold text-xs uppercase tracking-wider">Crucial Medical Disclaimer</h3>
            <p className="text-[11px]">
              MedRemind is an organizational medication reminder tool. It is <strong>NOT</strong> a medical advice, diagnostic, or clinical decision-making service. Never alter doctor-prescribed doses based on the application.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">1. Scope & Purpose of MedRemind</h3>
            <p>
              MedRemind helps patients organize prescription medication routines and receive scheduled alarms. It does not replace the relationship between you and your physician, pharmacist, or healthcare provider.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">2. AI Optical Transcription Drafts</h3>
            <p>
              When prescriptions are scanned using multimodal AI (Google Gemini API) or OCR (Tesseract.js), extracted details are preliminary drafts. AI models may misread handwriting or dosage numbers.
            </p>
            <p className="font-semibold text-[#1b6d5e]">
              Mandatory Rule: No medication or reminder becomes active without your explicit manual review, verification, and confirmation ("Approve All").
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">3. User Responsibilities</h3>
            <p>
              You must compare every medicine name, strength (e.g., 650 mg vs 500 mg), frequency, and meal instruction against your physical paper prescription. If any handwriting is unclear, consult your doctor or dispensing pharmacist.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">4. Reminder & Notification Limitations</h3>
            <p>
              Local alarms rely on Android device hardware. Device battery savers (Doze mode), custom OEM restrictions, volume settings, and operating system updates may delay or suppress alerts. Do not rely exclusively on MedRemind for life-critical medications.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">5. Eligibility & Account Security</h3>
            <p>
              Minors should use MedRemind under the supervision of a parent or legal guardian. You are responsible for safeguarding your login credentials.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">6. Governing Law (India) & Dispute Resolution</h3>
            <p>
              These Terms are governed by Indian law. Unresolved disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996, in India.
            </p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#E6ECE8] text-[11px] text-[#7A8782]">
            <p><strong>Entity Name:</strong> [Insert Legal Entity Name / Developer Name]</p>
            <p><strong>Registered Address:</strong> [Insert Registered Address, India]</p>
            <p><strong>Support Email:</strong> [Insert Support Email]</p>
          </div>
        </Card>
      )}

      {/* TAB CONTENT: PRIVACY POLICY */}
      {activeTab === 'privacy' && (
        <Card className="p-4 space-y-4 text-xs text-[#202B28] leading-relaxed bg-white shadow-xs">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
            <h3 className="font-bold text-xs uppercase tracking-wider">Digital Personal Data Protection Act, 2023 (DPDP Act)</h3>
            <p className="text-[11px]">
              We process personal health data as a Data Fiduciary pursuant to Section 4 and Section 6 of the DPDP Act, based on your explicit consent.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">1. Data Collected & Processed</h3>
            <p>
              We collect identity information (name, email, role), digital prescription photos/PDFs, extracted drug details (brand, generic ingredient, strength, dose schedule, meal timing), and alarm interaction timestamps.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">2. Google Gemini API Data Transmission Disclosure</h3>
            <p>
              When you use online prescription scanning, the <strong>unredacted prescription image</strong> is transmitted to Google's Gemini API servers (`generativelanguage.googleapis.com`) to extract text.
            </p>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
              <p className="font-bold">Google Service Tier Notice:</p>
              <p>
                Under Google's unpaid developer tier, submitted inputs may be stored and reviewed by human annotators to train Google models. MedRemind developer previews use synthetic test data. Production clinical deployment requires Google Cloud Vertex AI enterprise tiers with HIPAA/data-governance agreements.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">3. Offline Tesseract.js Alternative</h3>
            <p>
              Selecting <strong>"Scan offline (Tesseract)"</strong> processes documents locally on your server/device infrastructure without any data transmission to Google or external cloud providers.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">4. Your Statutory Data Principal Rights</h3>
            <p>
              You have the right to access your processed data, correct inaccurate details, request permanent erasure of your account and prescription media, nominate a representative, and withdraw your consent at any time.
            </p>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#E6ECE8] text-[11px] text-[#7A8782]">
            <p><strong>Grievance Redressal Officer:</strong> [Insert Grievance Officer Name]</p>
            <p><strong>Grievance Email:</strong> [Insert Grievance Email]</p>
            <p><strong>Statutory Redressal Period:</strong> Acknowledged within 48h; resolved within 30 calendar days.</p>
          </div>
        </Card>
      )}

      {/* TAB CONTENT: GEMINI AI DISCLOSURE */}
      {activeTab === 'ai' && (
        <Card className="p-4 space-y-4 text-xs text-[#202B28] leading-relaxed bg-white shadow-xs">
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 space-y-1">
            <h3 className="font-bold text-xs uppercase tracking-wider">Google AI Studio & Gemini API Runtime Disclosure</h3>
            <p className="text-[11px]">
              Transparency record regarding the functional boundaries of Gemini multimodal AI in MedRemind.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">1. Scope of Gemini AI Integration</h3>
            <p>
              Gemini model <code>gemini-3.5-flash</code> is used strictly for optical character and image transcription. It identifies written text on prescription images and formats the recognized names and dosages into draft inputs for the reminder editor.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">2. Strict Prohibitions & Safeguards</h3>
            <ul className="list-disc pl-4 space-y-1 text-[#7A8782]">
              <li>Gemini is never permitted to offer medical advice or diagnose health conditions.</li>
              <li>Gemini never recommends or changes prescribed medication dosages.</li>
              <li>Gemini cannot activate medication schedules; human approval is mandatory.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#1b6d5e]">3. Official Google Documentation & Policy Links</h3>
            <div className="grid grid-cols-1 gap-1.5 pt-1 text-[11px]">
              <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer" className="text-[#238B78] hover:underline flex items-center justify-between p-2 rounded-lg bg-[#F8FAF8] border border-[#E6ECE8]">
                <span>Gemini API Additional Terms of Service</span> <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a href="https://policies.google.com/terms/generative-ai/use-policy" target="_blank" rel="noreferrer" className="text-[#238B78] hover:underline flex items-center justify-between p-2 rounded-lg bg-[#F8FAF8] border border-[#E6ECE8]">
                <span>Google Generative AI Prohibited Use Policy</span> <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a href="https://ai.google.dev/gemini-api/docs/zdr" target="_blank" rel="noreferrer" className="text-[#238B78] hover:underline flex items-center justify-between p-2 rounded-lg bg-[#F8FAF8] border border-[#E6ECE8]">
                <span>Zero Data Retention (ZDR) Documentation</span> <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-[#E6ECE8]">
            <h4 className="font-bold text-xs text-[#202B28]">Google Written Clarification Reference</h4>
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-[10px] font-mono text-gray-700">
              [Insert Exact Text of Google Written Response if available]
            </div>
          </div>
        </Card>
      )}

      {/* TAB CONTENT: THIRD-PARTY REGISTER */}
      {activeTab === 'licenses' && (
        <Card className="p-4 space-y-4 text-xs text-[#202B28] leading-relaxed bg-white shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-[#1b6d5e]">Integrated Services & Open Source Register</h3>
            <p className="text-[11px] text-[#7A8782] mt-0.5">
              Transparent disclosure of all external APIs, native hardware bridges, and core libraries.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl border border-[#E6ECE8] space-y-1 bg-[#F8FAF8]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#202B28]">Google Gemini API (`@google/genai`)</span>
                <Badge variant="primary" size="sm">Apache 2.0 / API Terms</Badge>
              </div>
              <p className="text-[11px] text-[#7A8782]">
                Multimodal vision AI for prescription text recognition. Receives prescription image buffer during online scanning.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-[#E6ECE8] space-y-1 bg-[#F8FAF8]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#202B28]">Tesseract.js (v7.0.0)</span>
                <Badge variant="primary" size="sm">Apache 2.0</Badge>
              </div>
              <p className="text-[11px] text-[#7A8782]">
                Local optical character recognition engine. Zero external cloud transmission; runs 100% offline.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-[#E6ECE8] space-y-1 bg-[#F8FAF8]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#202B28]">Capacitor Local Notifications & Camera</span>
                <Badge variant="primary" size="sm">MIT License</Badge>
              </div>
              <p className="text-[11px] text-[#7A8782]">
                Native Android hardware bridge for camera photo capture and Android AlarmManager local notification scheduling.
              </p>
            </div>

            <div className="p-3 rounded-xl border border-[#E6ECE8] space-y-1 bg-[#F8FAF8]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#202B28]">React 18 & Vite & Tailwind CSS</span>
                <Badge variant="primary" size="sm">MIT License</Badge>
              </div>
              <p className="text-[11px] text-[#7A8782]">
                Core frontend UI library, bundler, and design system.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* TAB CONTENT: MY CONSENT & DATA RIGHTS */}
      {activeTab === 'consent' && currentUser && (
        <Card className="p-4 space-y-4 text-xs text-[#202B28] leading-relaxed bg-white shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-[#1b6d5e]">Your Statutory DPDP Consent Status</h3>
            <p className="text-[11px] text-[#7A8782] mt-0.5">
              Verified record of your legal consents under the Digital Personal Data Protection Act, 2023.
            </p>
          </div>

          {consentRecord ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Active Legal Consent Record on File
                </div>
                <p className="text-[11px]">
                  Accepted Terms v{consentRecord.termsVersion} and Privacy Policy v{consentRecord.privacyVersion} on {new Date(consentRecord.acceptedAt).toLocaleString()}.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8] space-y-1 text-[11px]">
                <p><strong>User ID:</strong> <code className="text-[#238B78] font-mono">{currentUser.id}</code></p>
                <p><strong>Eligibility & Terms Confirmed:</strong> {consentRecord.termsAccepted || consentRecord.ageConfirmed ? 'Yes' : 'No'}</p>
                <p><strong>AI Transcription Acknowledged:</strong> {consentRecord.aiAcknowledged ? 'Yes' : 'No'}</p>
                <p><strong>DPDP Statutory Consent:</strong> {consentRecord.dpdpConsentGiven ? 'Granted' : 'Revoked'}</p>
                <p><strong>Jurisdiction:</strong> India (DPDP Act, 2023)</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={Download}
                  onClick={handleExportConsent}
                >
                  Download Consent Receipt
                </Button>

                <Button
                  size="sm"
                  variant="danger"
                  icon={AlertTriangle}
                  onClick={handleRevoke}
                >
                  Withdraw Consent
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
              <p className="font-bold">No Active Consent Record Found</p>
              <p className="text-[11px]">
                Your account was created prior to the implementation of Legal Framework v{LEGAL_VERSIONS.TERMS}. Please complete acceptance to ensure full regulatory compliance.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
