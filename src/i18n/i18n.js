import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Master and regional locale bundles
import en from './locales/en.json';
import hi from './locales/hi.json';
import doi from './locales/doi.json';
import bn from './locales/bn.json';
import as from './locales/as.json';
import brx from './locales/brx.json';
import gu from './locales/gu.json';
import kn from './locales/kn.json';
import ks from './locales/ks.json';
import kok from './locales/kok.json';
import mai from './locales/mai.json';
import ml from './locales/ml.json';
import mni from './locales/mni.json';
import mr from './locales/mr.json';
import ne from './locales/ne.json';
import or from './locales/or.json';
import pa from './locales/pa.json';
import sa from './locales/sa.json';
import sat from './locales/sat.json';
import sd from './locales/sd.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import ur from './locales/ur.json';

import { INDIAN_LANGUAGES } from './languages';

const initialLang = localStorage.getItem('app_language') || 'en';

export const resources = {
  en: { translation: en },
  hi: { translation: hi },
  doi: { translation: doi },
  bn: { translation: bn },
  as: { translation: as },
  brx: { translation: brx },
  gu: { translation: gu },
  kn: { translation: kn },
  ks: { translation: ks },
  kok: { translation: kok },
  mai: { translation: mai },
  ml: { translation: ml },
  mni: { translation: mni },
  mr: { translation: mr },
  ne: { translation: ne },
  or: { translation: or },
  pa: { translation: pa },
  sa: { translation: sa },
  sat: { translation: sat },
  sd: { translation: sd },
  ta: { translation: ta },
  te: { translation: te },
  ur: { translation: ur }
};

// Helper to update HTML document attributes for RTL scripts (Urdu, Kashmiri, Sindhi)
export function updateDocumentDirection(langCode) {
  const langObj = INDIAN_LANGUAGES.find(l => l.code === langCode);
  const dir = langObj?.dir || 'ltr';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = langCode;
    document.documentElement.dir = dir;
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

updateDocumentDirection(initialLang);

export async function changeAppLanguage(langCode) {
  try {
    localStorage.setItem('app_language', langCode);
    updateDocumentDirection(langCode);
    await i18n.changeLanguage(langCode);
  } catch (err) {
    console.warn('[i18n] Error switching language:', err);
  }
}

export default i18n;
