import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BrandLogo from '../../components/common/BrandLogo';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import LanguagePickerModal from '../../components/common/LanguagePickerModal';
import { Camera, Calendar, ShieldCheck, ArrowRight, HeartPulse, Utensils, Globe } from 'lucide-react';

export default function WelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  return (
    <div className="flex-1 flex flex-col justify-between p-6 bg-gradient-to-b from-[#F8FAF8] via-[#F8FAF8] to-[#DDEFE8]/30">
      <div className="pt-2">
        {/* Top Header with Language Switcher */}
        <div className="flex items-center justify-between mb-4">
          <BrandLogo size="md" showTagline={false} />
          <button
            onClick={() => setShowLanguageModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-700 shadow-xs hover:border-[#238B78] transition-colors cursor-pointer"
            aria-label="Select Language"
          >
            <Globe className="w-3.5 h-3.5 text-[#238B78]" />
            <span>Language / भाषा</span>
          </button>
        </div>
        
        {/* Decorative Healthcare Illustration Card */}
        <div className="mt-2 mb-4 p-5 rounded-3xl bg-gradient-to-br from-[#238B78] to-[#1b6d5e] text-white shadow-lg shadow-[#238B78]/20 relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#DDEFE8]">
              {t('welcome.careWithClarity', 'Care With Clarity')}
            </span>
          </div>
          <h3 className="text-lg font-bold leading-snug">
            {t('welcome.headline', 'Medication safety with intelligent verification.')}
          </h3>
          <p className="text-xs text-[#DDEFE8] mt-1 leading-relaxed">
            {t('welcome.description', 'Scan paper prescriptions and medicine strips, track doses with reminders, and monitor daily nutrition.')}
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-2.5">
          <Card className="flex items-start gap-3 border-[#E6ECE8] bg-white/90 p-3.5">
            <div className="w-8 h-8 rounded-xl bg-[#DDEFE8] flex items-center justify-center text-[#238B78] flex-shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-[#202B28]">
                {t('welcome.smartScanner', 'Smart Prescription & Strip Scanner')}
              </h4>
              <p className="text-[11px] text-[#7A8782] mt-0.5">
                {t('welcome.smartScannerDesc', 'Verify and edit extracted medicines before approving them to your schedule.')}
              </p>
            </div>
          </Card>

          <Card className="flex items-start gap-3 border-[#E6ECE8] bg-white/90 p-3.5">
            <div className="w-8 h-8 rounded-xl bg-[#DDEFE8] flex items-center justify-center text-[#238B78] flex-shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-[#202B28]">
                {t('welcome.thoughtfulRoutine', 'Thoughtful Daily Routine')}
              </h4>
              <p className="text-[11px] text-[#7A8782] mt-0.5">
                {t('welcome.thoughtfulRoutineDesc', 'Clear reminders for morning, afternoon, evening, and bedtime medication routines.')}
              </p>
            </div>
          </Card>

          <Card className="flex items-start gap-3 border-[#E6ECE8] bg-white/90 p-3.5">
            <div className="w-8 h-8 rounded-xl bg-[#DDEFE8] flex items-center justify-center text-[#238B78] flex-shrink-0">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-semibold text-xs text-[#202B28]">
                {t('welcome.foodTracker', 'Food & Nutrition Tracker')}
              </h4>
              <p className="text-[11px] text-[#7A8782] mt-0.5">
                {t('welcome.foodTrackerDesc', 'Log meals, track daily calories, macros (carbs, protein, fat), and fibre goals.')}
              </p>
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-2.5 pt-4 pb-2">
        <Button
          fullWidth
          size="lg"
          onClick={() => navigate('/login')}
          icon={ArrowRight}
          className="shadow-md"
        >
          {t('common.signIn', 'Sign In')}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          size="lg"
          onClick={() => navigate('/register')}
        >
          {t('common.createAccount', 'Create Free Account')}
        </Button>
        <div className="pt-2 text-[10px] text-center text-[#7A8782] space-y-1">
          <p>{t('welcome.disclaimer', 'Always consult healthcare professionals for medical advice.')}</p>
          <p className="space-x-1.5">
            <button onClick={() => navigate('/legal')} className="text-[#238B78] hover:underline cursor-pointer">
              Terms & Conditions
            </button>
            <span>•</span>
            <button onClick={() => navigate('/legal')} className="text-[#238B78] hover:underline cursor-pointer">
              Privacy Policy (DPDP)
            </button>
            <span>•</span>
            <button onClick={() => navigate('/about')} className="text-[#238B78] hover:underline font-semibold cursor-pointer">
              Team Sanjeevani
            </button>
          </p>
          <div className="p-2 rounded-xl bg-emerald-50/80 border border-emerald-100 text-[10.5px] text-emerald-900 leading-snug text-center mt-1">
            <strong>Team Sanjeevani:</strong> 3 Class 11 boys from The Newtown School, Kolkata — Aryan Singhania, Tanishq Ghosh, and Naman Thard.
          </div>
        </div>
      </div>

      <LanguagePickerModal
        isOpen={showLanguageModal}
        onClose={() => setShowLanguageModal(false)}
      />
    </div>
  );
}
