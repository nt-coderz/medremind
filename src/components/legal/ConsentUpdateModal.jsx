import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { ShieldAlert, FileText, Lock, Sparkles, Check } from 'lucide-react';
import { LEGAL_VERSIONS } from '../../data/legalDocuments';
import { recordUserConsent } from '../../services/legalConsentService';
import { toast } from 'sonner';

export default function ConsentUpdateModal({ isOpen, user, onConsentCompleted }) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [aiAcknowledged, setAiAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !user) return null;

  const allChecked = termsAccepted && privacyAccepted && aiAcknowledged;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!allChecked) {
      toast.error('Please complete all mandatory legal confirmations to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      recordUserConsent({
        userId: user.id,
        userEmail: user.email || '',
        ageConfirmed: true,
        termsAccepted,
        privacyAccepted,
        aiAcknowledged,
        dpdpConsentGiven: true
      });
      toast.success('Legal terms and privacy consent successfully updated.');
      setIsSubmitting(false);
      onConsentCompleted();
    } catch (err) {
      setIsSubmitting(false);
      toast.error('Failed to record consent: ' + err.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Cannot dismiss without accepting
      title="Updated Legal Terms & Privacy Consent"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs text-[#202B28]">
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            Mandatory Annual / Policy Update Notice
          </div>
          <p className="text-[11px] leading-relaxed">
            MedRemind has updated its statutory legal framework to Version {LEGAL_VERSIONS.TERMS} pursuant to the Digital Personal Data Protection Act, 2023, and Google Gemini API usage guidelines. Please review and confirm your acceptance to continue to your dashboard.
          </p>
        </div>

        {/* Legal Highlights */}
        <div className="p-3 rounded-xl bg-[#F8FAF8] border border-[#E6ECE8] space-y-1.5 text-[11px] text-[#7A8782]">
          <p className="font-semibold text-[#1b6d5e]">Key Principles:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>MedRemind is an organizational reminder utility, NOT a medical advice or diagnostic service.</li>
            <li>Prescription scanning (Gemini AI and Tesseract OCR) produces drafts requiring your manual verification.</li>
            <li>No medication schedule is activated without your explicit personal approval.</li>
          </ul>
        </div>

        {/* Unchecked Mandatory Checkboxes */}
        <div className="space-y-3 pt-2">
          {/* Checkbox: Terms */}
          <label className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E6ECE8] hover:bg-[#F8FAF8] cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="accent-[#238B78] w-4 h-4 mt-0.5 rounded cursor-pointer flex-shrink-0"
            />
            <span className="text-[11px] leading-snug">
              <strong>Terms & Conditions:</strong> I have reviewed and agree to the MedRemind Terms & Conditions (Version {LEGAL_VERSIONS.TERMS}).
            </span>
          </label>

          {/* Checkbox 3: Privacy Policy */}
          <label className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E6ECE8] hover:bg-[#F8FAF8] cursor-pointer">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="accent-[#238B78] w-4 h-4 mt-0.5 rounded cursor-pointer flex-shrink-0"
            />
            <span className="text-[11px] leading-snug">
              <strong>Privacy Policy Consent:</strong> I acknowledge and provide explicit consent under the DPDP Act, 2023, for processing my medication and health-related routine data.
            </span>
          </label>

          {/* Checkbox 4: AI & Manual Approval */}
          <label className="flex items-start gap-2.5 p-2 rounded-xl border border-[#E6ECE8] hover:bg-[#F8FAF8] cursor-pointer">
            <input
              type="checkbox"
              checked={aiAcknowledged}
              onChange={(e) => setAiAcknowledged(e.target.checked)}
              className="accent-[#238B78] w-4 h-4 mt-0.5 rounded cursor-pointer flex-shrink-0"
            />
            <span className="text-[11px] leading-snug">
              <strong>AI & Manual Approval:</strong> I understand that online prescription scanning transmits image data to Google Gemini API for draft transcription, and that I must manually verify and approve every dose before reminders become active.
            </span>
          </label>
        </div>

        <div className="pt-3 border-t border-[#E6ECE8]">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            disabled={!allChecked || isSubmitting}
            icon={Check}
          >
            {isSubmitting ? 'Recording Consent...' : 'Accept & Proceed to Dashboard'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
