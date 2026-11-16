/**
 * 22 Scheduled Languages of India + English
 * Constitutional Eighth Schedule to the Constitution of India
 */

export const INDIAN_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    script: 'Latin',
    dir: 'ltr',
    isPinned: true,
    variants: ['english', 'en', 'angrezi']
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'Devanagari',
    dir: 'ltr',
    isPinned: true,
    variants: ['hindi', 'hi', 'hindustani']
  },
  {
    code: 'as',
    name: 'Assamese',
    nativeName: 'অসমীয়া',
    script: 'Bengali-Assamese',
    dir: 'ltr',
    variants: ['assamese', 'asomiya', 'oxomiya', 'as']
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    script: 'Bengali',
    dir: 'ltr',
    variants: ['bengali', 'bangla', 'bn']
  },
  {
    code: 'brx',
    name: 'Bodo',
    nativeName: 'बड़ो',
    script: 'Devanagari',
    dir: 'ltr',
    variants: ['bodo', 'boro', 'brx']
  },
  {
    code: 'doi',
    name: 'Dogri',
    nativeName: 'डोगरी',
    script: 'Devanagari',
    dir: 'ltr',
    variants: ['dogri', 'dongri', 'doi']
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    script: 'Gujarati',
    dir: 'ltr',
    variants: ['gujarati', 'gujrati', 'gu']
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    script: 'Kannada',
    dir: 'ltr',
    variants: ['kannada', 'canarese', 'kn']
  },
  {
    code: 'ks',
    name: 'Kashmiri',
    nativeName: 'كٲشُر',
    script: 'Perso-Arabic',
    dir: 'rtl',
    variants: ['kashmiri', 'koshur', 'ks']
  },
  {
    code: 'kok',
    name: 'Konkani',
    nativeName: 'कोंकणी',
    script: 'Devanagari',
    dir: 'ltr',
    variants: ['konkani', 'kokani', 'kok']
  },
  {
    code: 'mai',
    name: 'Maithili',
    nativeName: 'मैथिली',
    script: 'Devanagari',
    dir: 'ltr',
    variants: ['maithili', 'tirhuta', 'mai']
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    script: 'Malayalam',
    dir: 'ltr',
    variants: ['malayalam', 'kairali', 'ml']
  },
  {
    code: 'mni',
    name: 'Manipuri (Meitei)',
    nativeName: 'মৈতৈলোন্',
    script: 'Bengali',
    dir: 'ltr',
    variants: ['manipuri', 'meitei', 'meetei', 'mni']
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    script: 'Devanagari',
    dir: 'ltr',
    variants: ['marathi', 'mr']
  },
  {
    code: 'ne',
    name: 'Nepali',
    nativeName: 'नेपाली',
    script: 'Devanagari',
    dir: 'ltr',
    variants: ['nepali', 'gorkhali', 'ne']
  },
  {
    code: 'or',
    name: 'Odia',
    nativeName: 'ଓଡ଼ିଆ',
    script: 'Odia',
    dir: 'ltr',
    variants: ['odia', 'oriya', 'or']
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    script: 'Gurmukhi',
    dir: 'ltr',
    variants: ['punjabi', 'panjabi', 'pa']
  },
  {
    code: 'sa',
    name: 'Sanskrit',
    nativeName: 'संस्कृतम्',
    script: 'Devanagari',
    dir: 'ltr',
    variants: ['sanskrit', 'samskritam', 'sa']
  },
  {
    code: 'sat',
    name: 'Santali',
    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',
    script: 'Ol Chiki',
    dir: 'ltr',
    variants: ['santali', 'santhali', 'sat']
  },
  {
    code: 'sd',
    name: 'Sindhi',
    nativeName: 'سنڌي',
    script: 'Perso-Arabic',
    dir: 'rtl',
    variants: ['sindhi', 'sd']
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    script: 'Tamil',
    dir: 'ltr',
    variants: ['tamil', 'thamizh', 'ta']
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    script: 'Telugu',
    dir: 'ltr',
    variants: ['telugu', 'andhra', 'te']
  },
  {
    code: 'ur',
    name: 'Urdu',
    nativeName: 'اردو',
    script: 'Perso-Arabic',
    dir: 'rtl',
    variants: ['urdu', 'lashkari', 'ur']
  }
];

export function getSuggestedLanguages() {
  if (typeof navigator === 'undefined') return [];
  const browserLocales = (navigator.languages || [navigator.language || '']).map(l => l.toLowerCase());
  
  const matches = [];
  for (const lang of INDIAN_LANGUAGES) {
    if (lang.code === 'en' || lang.code === 'hi') continue; // Already pinned
    const matched = browserLocales.some(loc => loc.startsWith(lang.code) || lang.variants.some(v => loc.includes(v)));
    if (matched) {
      matches.push(lang);
    }
  }
  return matches;
}
