import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../../components/common/BrandLogo';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import LegalModal from '../../components/legal/LegalModal';
import { recordUserConsent } from '../../services/legalConsentService';
import { LEGAL_VERSIONS } from '../../data/legalDocuments';
import { 
  User, 
  Mail, 
  Lock, 
  Calendar, 
  Phone, 
  Users, 
  ExternalLink 
} from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();

  // User Profile Fields (Name, DOB, Gender, Email, Phone Number, Password)
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Mandatory statutory checkboxes — STRICTLY UNCHECKED BY DEFAULT
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [aiAcknowledged, setAiAcknowledged] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [legalModalType, setLegalModalType] = useState(null);

  const allLegalConfirmed = termsAccepted && privacyAccepted && aiAcknowledged;

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!dob.trim()) {
      setError('Please provide your date of birth.');
      return;
    }

    if (!gender) {
      setError('Please select your gender.');
      return;
    }

    if (!email.trim()) {
      setError('Please provide your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    // Mandatory Statutory Legal Validations
    if (!termsAccepted) {
      setError('You must review and accept the MedRemind Terms & Conditions.');
      toast.error('Terms acceptance is required.');
      return;
    }

    if (!privacyAccepted) {
      setError('You must consent to the Privacy Policy under the DPDP Act, 2023.');
      toast.error('Privacy Policy consent is required.');
      return;
    }

    if (!aiAcknowledged) {
      setError('You must acknowledge the AI prescription processing disclosure.');
      toast.error('AI prescription disclosure acknowledgement is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await register({
        name: name.trim(),
        dob: dob.trim(),
        gender,
        email: email.trim(),
        phone: cleanPhone,
        password,
        role: 'patient'
      });

      setIsSubmitting(false);
      if (res.success && res.user) {
        // Record statutory DPDP consent receipt
        recordUserConsent({
          userId: res.user.id,
          userEmail: res.user.email,
          ageConfirmed: true,
          termsAccepted,
          privacyAccepted,
          aiAcknowledged,
          dpdpConsentGiven: true
        });

        toast.success(`Welcome to MedRemind, ${res.user.name}!`);
        navigate('/dashboard');
      } else {
        setError(res.error || 'Registration failed');
        toast.error(res.error || 'Registration failed');
      }
    } catch (err) {
      setIsSubmitting(false);
      setError(err.message || 'Registration failed');
      toast.error(err.message || 'Registration failed');
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-6 max-w-md mx-auto w-full">
      <div className="pt-2">
        <div className="flex items-center justify-between">
          <BrandLogo size="md" />
        </div>

        <div className="mt-4">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-[#202B28]">{t('auth.createAccountTitle', 'Create Your Account')}</h2>
            <p className="text-xs text-[#7A8782] mt-0.5">
              {t('auth.createAccountSubtitle', 'Enter your details to register your personalized medication schedule.')}
            </p>
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            {/* Full Name */}
            <Input
              label={t('auth.fullName', 'Full Name')}
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full legal name"
              required
            />

            {/* Date of Birth & Gender Row */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#202B28] uppercase tracking-wider">
                  {t('auth.dob', 'Date of Birth')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7A8782]">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    value={dob}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full pl-9 pr-2.5 py-2.5 rounded-xl bg-white border border-[#E6ECE8] text-xs text-[#202B28] focus:outline-none focus:border-[#238B78]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#202B28] uppercase tracking-wider">
                  {t('auth.gender', 'Gender')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7A8782]">
                    <Users className="w-4 h-4" />
                  </div>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full pl-9 pr-2.5 py-2.5 rounded-xl bg-white border border-[#E6ECE8] text-xs text-[#202B28] focus:outline-none focus:border-[#238B78]"
                    required
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Email Address */}
            <Input
              label={t('auth.email', 'Email Address')}
              type="email"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />

            {/* Phone Number */}
            <Input
              label={t('auth.phone', 'Phone Number')}
              type="tel"
              icon={Phone}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              required
            />

            {/* Password */}
            <Input
              label={t('auth.password', 'Password')}
              type="password"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />

            {/* Confirm Password */}
            <Input
              label={t('auth.confirmPassword', 'Confirm Password')}
              type="password"
              icon={Lock}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
            />

            {/* Mandatory Statutory Legal Consents (DPDP Act, 2023) */}
            <div className="p-3.5 rounded-2xl bg-[#F8FAF8] border border-[#E6ECE8] space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#7A8782] uppercase tracking-wider block">
                  Mandatory Legal Consents
                </span>
                <Link to="/legal" target="_blank" className="text-[10px] text-[#238B78] hover:underline font-semibold flex items-center gap-0.5">
                  Full Legal Centre <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>

              {/* Terms Acceptance */}
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#202B28]">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="accent-[#238B78] w-4 h-4 mt-0.5 rounded cursor-pointer flex-shrink-0"
                />
                <span className="text-[11px] leading-snug">
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setLegalModalType('terms'); }}
                    className="text-[#238B78] font-bold hover:underline cursor-pointer"
                  >
                    Terms & Conditions (v{LEGAL_VERSIONS.TERMS})
                  </button>
                  , acknowledging that MedRemind is a reminder organizer and not medical advice.
                </span>
              </label>

              {/* Privacy Consent */}
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#202B28]">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="accent-[#238B78] w-4 h-4 mt-0.5 rounded cursor-pointer flex-shrink-0"
                />
                <span className="text-[11px] leading-snug">
                  I consent to the collection and processing of my medication routine data under the{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setLegalModalType('privacy'); }}
                    className="text-[#238B78] font-bold hover:underline cursor-pointer"
                  >
                    Privacy Policy (DPDP Act, 2023)
                  </button>
                  .
                </span>
              </label>

              {/* AI Disclosure */}
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#202B28]">
                <input
                  type="checkbox"
                  checked={aiAcknowledged}
                  onChange={(e) => setAiAcknowledged(e.target.checked)}
                  className="accent-[#238B78] w-4 h-4 mt-0.5 rounded cursor-pointer flex-shrink-0"
                />
                <span className="text-[11px] leading-snug">
                  I acknowledge the{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setLegalModalType('ai'); }}
                    className="text-[#238B78] font-bold hover:underline cursor-pointer"
                  >
                    AI Prescription Processing Disclosure
                  </button>
                  , understanding that AI/OCR generates drafts only and that manual review and approval is mandatory.
                </span>
              </label>
            </div>

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <Button 
              type="submit" 
              fullWidth 
              size="lg" 
              disabled={!allLegalConfirmed || isSubmitting}
              className={!allLegalConfirmed ? 'opacity-60 cursor-not-allowed' : ''}
            >
              {isSubmitting ? t('common.loading', 'Creating Account...') : t('auth.createAccountButton', 'Create Account')}
            </Button>
          </form>
        </div>
      </div>

      <div className="py-4 space-y-2 text-center text-xs text-[#7A8782]">
        <p>
          {t('auth.alreadyHaveAccount', 'Already have an account?')}{' '}
          <Link to="/login" className="text-[#238B78] font-semibold hover:underline">
            {t('common.signIn', 'Sign In')}
          </Link>
        </p>

        <p className="text-[10px] text-[#7A8782] pt-1">
          <Link to="/legal" className="hover:underline">Terms & Conditions</Link> •{' '}
          <Link to="/legal" className="hover:underline">Privacy Policy (DPDP)</Link> •{' '}
          <Link to="/legal" className="hover:underline">Gemini AI Disclosure</Link>
        </p>
      </div>

      {/* Full Document Viewer Modal */}
      <LegalModal
        isOpen={!!legalModalType}
        onClose={() => setLegalModalType(null)}
        type={legalModalType}
      />
    </div>
  );
}
