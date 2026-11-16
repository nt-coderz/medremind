import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Check, Globe, Pin, Sparkles, X } from 'lucide-react';
import { INDIAN_LANGUAGES, getSuggestedLanguages } from '../../i18n/languages';
import { changeAppLanguage } from '../../i18n/i18n';
import Modal from './Modal';
import { toast } from 'sonner';

export default function LanguagePickerModal({ isOpen, onClose }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || localStorage.getItem('app_language') || 'en';
  const [searchTerm, setSearchTerm] = useState('');

  const suggestedLangs = useMemo(() => getSuggestedLanguages(), []);

  const filteredLanguages = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return INDIAN_LANGUAGES;

    return INDIAN_LANGUAGES.filter(lang => {
      const matchName = lang.name.toLowerCase().includes(term);
      const matchNative = lang.nativeName.toLowerCase().includes(term);
      const matchCode = lang.code.toLowerCase() === term;
      const matchVariant = lang.variants?.some(v => v.toLowerCase().includes(term));
      return matchName || matchNative || matchCode || matchVariant;
    });
  }, [searchTerm]);

  const pinnedLangs = useMemo(() => {
    return filteredLanguages.filter(l => l.isPinned);
  }, [filteredLanguages]);

  const otherLangs = useMemo(() => {
    return filteredLanguages.filter(l => !l.isPinned);
  }, [filteredLanguages]);

  const handleSelectLanguage = async (lang) => {
    await changeAppLanguage(lang.code);
    toast.success(`Language set to ${lang.name} (${lang.nativeName})`);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Language / भाषा चुनें"
    >
      <div className="space-y-3.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search language, script, or romanised name (e.g., Bangla, Oriya)..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#238B78] focus:bg-white transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable Language List */}
        <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
          {/* Pinned Languages (English & Hindi) */}
          {pinnedLangs.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-teal-800 mb-1.5">
                <Pin className="w-3 h-3 text-teal-600" />
                <span>Featured Languages</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {pinnedLangs.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                      currentLang === lang.code
                        ? 'bg-teal-50/80 border-teal-600 text-teal-900 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-teal-300 text-gray-800'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm leading-tight">{lang.nativeName}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{lang.name}</div>
                    </div>
                    {currentLang === lang.code && (
                      <Check className="w-4 h-4 text-teal-700 shrink-0 ml-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Languages (Based on device locale) */}
          {!searchTerm && suggestedLangs.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1.5">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Suggested For You (Device Locale)</span>
              </div>
              <div className="space-y-1.5">
                {suggestedLangs.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                      currentLang === lang.code
                        ? 'bg-teal-50 border-teal-600 text-teal-900'
                        : 'bg-amber-50/40 border-amber-200 hover:bg-amber-50 text-gray-800'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-xs">{lang.nativeName}</span>
                      <span className="text-[11px] text-gray-500 ml-2">· {lang.name}</span>
                    </div>
                    {currentLang === lang.code && <Check className="w-4 h-4 text-teal-700" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All 22 Scheduled Indian Languages */}
          <div>
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              <Globe className="w-3 h-3 text-gray-400" />
              <span>All 22 Scheduled Languages of India</span>
            </div>
            <div className="space-y-1">
              {otherLangs.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => handleSelectLanguage(lang)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all ${
                    currentLang === lang.code
                      ? 'bg-teal-50 border-teal-600 text-teal-900 font-semibold'
                      : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-xs">{lang.nativeName}</span>
                    <span className="text-[11px] text-gray-500">· {lang.name}</span>
                    <span className="text-[10px] text-gray-400">({lang.script})</span>
                  </div>
                  {currentLang === lang.code && (
                    <Check className="w-4 h-4 text-teal-700 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
