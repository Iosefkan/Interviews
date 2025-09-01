import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation resources
import enTranslations from '../locales/en.json';
import ruTranslations from '../locales/ru.json';

const resources = {
  en: {
    translation: enTranslations
  },
  ru: {
    translation: ruTranslations
  }
};

// Language detection configuration
const detectionOptions = {
  // Order and from where user language should be detected
  order: ['localStorage', 'navigator', 'htmlTag'],
  
  // Keys or params to lookup language from
  lookupLocalStorage: 'hr_app_language',
  
  // Cache user language on
  caches: ['localStorage'],
  
  // Only detect languages that are in the whitelist
  checkWhitelist: true
};

i18n
  // Use language detector
  .use(LanguageDetector)
  // Use React i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    
    // Fallback language
    fallbackLng: 'ru', // Russian as default per requirements
    
    // Supported languages
    supportedLngs: ['en', 'ru'],
    
    // Language detection
    detection: detectionOptions,
    
    // Namespace settings
    defaultNS: 'translation',
    ns: ['translation'],
    
    // React i18next options
    react: {
      // Trigger a rerender when language changes
      bindI18n: 'languageChanged',
      bindI18nStore: false,
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i'],
    },
    
    // Interpolation settings
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // Debug in development
    debug: import.meta.env.DEV,
    
    // Custom language selection logic
    load: 'languageOnly', // Load only language codes without country codes
  });

// Custom language detection logic as per requirements
const detectLanguage = () => {
  // Check localStorage first
  const storedLang = localStorage.getItem('hr_app_language');
  if (storedLang && ['en', 'ru'].includes(storedLang)) {
    return storedLang;
  }
  
  // Check browser language
  const browserLang = navigator.language.toLowerCase();
  
  if (browserLang.startsWith('en')) {
    return 'en';
  } else if (browserLang.startsWith('ru')) {
    return 'ru';
  }
  
  // Default to Russian for any other language
  return 'ru';
};

// Set the detected language
const detectedLanguage = detectLanguage();
i18n.changeLanguage(detectedLanguage);

export default i18n;