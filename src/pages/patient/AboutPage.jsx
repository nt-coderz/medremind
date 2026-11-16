import React from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/common/BrandLogo';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { ArrowLeft, Heart, ShieldCheck, Award, Users, School } from 'lucide-react';

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 space-y-4">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl text-[#7A8782] hover:text-[#202B28] hover:bg-white transition-colors cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-[#202B28]">About MedRemind</h2>
          <p className="text-xs text-[#7A8782]">Credits & Project Information</p>
        </div>
      </div>

      {/* Main Mission & Brand Card */}
      <Card className="text-center py-6 px-4 bg-gradient-to-br from-white via-white to-[#DDEFE8]/20 border-[#E6ECE8] space-y-3">
        <div className="flex justify-center">
          <BrandLogo size="lg" showTagline={true} />
        </div>
        <p className="text-xs text-[#7A8782] max-w-sm mx-auto leading-relaxed">
          MedRemind is an intelligent medication-reminder and prescription verification assistant built to safeguard patient wellness through clear adherence tracking and multimodal OCR.
        </p>
      </Card>

      {/* Official Team Sanjeevani Attribution Card (Exact Text) */}
      <Card className="p-5 space-y-3 bg-gradient-to-br from-[#238B78] to-[#1b6d5e] text-white shadow-lg shadow-[#238B78]/20 border-none relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-300" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#DDEFE8]">
            Author & Creator Credits
          </span>
        </div>

        {/* Exact attribution block */}
        <div className="space-y-2 pt-1">
          <p className="text-sm font-semibold leading-relaxed">
            MedRemind was designed and built by Team Sanjeevani:
          </p>
          <div className="p-3.5 rounded-2xl bg-white/15 border border-white/20 backdrop-blur-xs space-y-1">
            <h3 className="text-base font-bold text-white tracking-wide">
              Aryan Singhania, Tanishq Ghosh, and Naman Thard
            </h3>
            <p className="text-xs text-[#DDEFE8] flex items-center gap-1.5 pt-0.5 font-medium">
              <School className="w-4 h-4 text-amber-300 shrink-0" />
              3 Class 11 boys from The Newtown School, Kolkata.
            </p>
          </div>
        </div>
      </Card>

      {/* Highlights & Architecture */}
      <Card className="space-y-3 bg-white">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[#202B28] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#238B78]" /> Core Capabilities
        </h3>
        <div className="space-y-2 text-xs text-[#7A8782]">
          <div className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#238B78] mt-1.5 shrink-0" />
            <p><strong className="text-gray-900">On-Device Offline OCR:</strong> Bundled local Tesseract.js engine capable of reading prescriptions and medicine packaging without internet.</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#238B78] mt-1.5 shrink-0" />
            <p><strong className="text-gray-900">22 Scheduled Indian Languages:</strong> Complete multilingual localization with native script rendering and intelligent dialect search.</p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#238B78] mt-1.5 shrink-0" />
            <p><strong className="text-gray-900">DPDP Act 2023 Compliance:</strong> Privacy-first data protection with full local export and statutory 24-hour reversible deletion grace period.</p>
          </div>
        </div>
      </Card>

      {/* Version & Build */}
      <div className="text-center text-[11px] text-[#7A8782] pt-2 pb-6 space-y-1">
        <p>MedRemind v1.5 · Build 6 · Native Capacitor Android</p>
        <p className="flex items-center justify-center gap-1 text-teal-800 font-semibold">
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          Crafted with care by Team Sanjeevani
        </p>
      </div>
    </div>
  );
}
