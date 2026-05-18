import { useState, useEffect, useCallback } from 'react';
import { 
  type Language, 
  getTranslation, 
  getSavedLanguage 
} from '@/lib/i18n';

export function useTranslation() {
  const [currentLang, setCurrentLang] = useState<Language>('en');

  useEffect(() => {
    setCurrentLang(getSavedLanguage());

    // Listen for language changes
    const handleLanguageChange = (event: CustomEvent<Language>) => {
      setCurrentLang(event.detail);
    };

    window.addEventListener('languagechange', handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener('languagechange', handleLanguageChange as EventListener);
    };
  }, []);

  // Translation function
  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      return getTranslation(currentLang, key, params);
    },
    [currentLang]
  );

  return {
    t,
    currentLang,
    setLanguage: setCurrentLang,
  };
}

// Simple translation hook that returns just the function
export function useT(): (key: string, params?: Record<string, string>) => string {
  const { t } = useTranslation();
  return t;
}
