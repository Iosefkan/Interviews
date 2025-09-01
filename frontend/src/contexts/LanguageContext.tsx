import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface LanguageContextType {
  currentLanguage: string;
  isLoading: boolean;
  error: string | null;
  changeLanguage: (language: string) => Promise<void>;
  t: (key: string, options?: any) => string;
  supportedLanguages: Array<{
    code: string;
    name: string;
    nativeName: string;
  }>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const { t, i18n: i18nInstance } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<string>(i18nInstance.language || 'ru');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Supported languages configuration
  const supportedLanguages = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English'
    },
    {
      code: 'ru',
      name: 'Russian',
      nativeName: 'Русский'
    }
  ];

  // Handle language changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setCurrentLanguage(lng);
      setIsLoading(false);
      setError(null);
    };

    i18nInstance.on('languageChanged', handleLanguageChange);

    return () => {
      i18nInstance.off('languageChanged', handleLanguageChange);
    };
  }, [i18nInstance]);

  // Initialize language on mount
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        setIsLoading(true);
        
        // Get stored preference or detect from browser
        const storedLang = localStorage.getItem('hr_app_language');
        let targetLanguage = 'ru'; // Default fallback
        
        if (storedLang && supportedLanguages.some(lang => lang.code === storedLang)) {
          targetLanguage = storedLang;
        } else {
          // Detect from browser
          const browserLang = navigator.language.toLowerCase();
          if (browserLang.startsWith('en')) {
            targetLanguage = 'en';
          } else if (browserLang.startsWith('ru')) {
            targetLanguage = 'ru';
          }
          // For any other language, keep 'ru' as default
        }
        
        if (i18nInstance.language !== targetLanguage) {
          await i18nInstance.changeLanguage(targetLanguage);
        }
        
        setCurrentLanguage(targetLanguage);
      } catch (err) {
        console.error('Failed to initialize language:', err);
        setError('Failed to initialize language');
      } finally {
        setIsLoading(false);
      }
    };

    initializeLanguage();
  }, []);

  const changeLanguage = async (language: string): Promise<void> => {
    if (!supportedLanguages.some(lang => lang.code === language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    if (currentLanguage === language) {
      return; // No change needed
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // Change language in i18next
      await i18nInstance.changeLanguage(language);
      
      // Persist to localStorage
      localStorage.setItem('hr_app_language', language);
      
      setCurrentLanguage(language);
    } catch (err) {
      console.error('Failed to change language:', err);
      setError('Failed to change language');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: LanguageContextType = {
    currentLanguage,
    isLoading,
    error,
    changeLanguage,
    t,
    supportedLanguages
  };

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;