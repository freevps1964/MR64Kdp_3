import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { Language } from '../types';

export interface LocalizationContextType {
  locale: Language;
  setLocale: (locale: Language) => void;
  // Fix: Updated `t` function to accept an optional `options` parameter for string interpolation.
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

export const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

interface LocalizationProviderProps {
  children: React.ReactNode;
}

export const LocalizationProvider: React.FC<LocalizationProviderProps> = ({ children }) => {
  const [locale, setLocale] = useState<Language>('it');
  const [translations, setTranslations] = useState<{ en: any, it: any }>({ en: {}, it: {} });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'en' || browserLang === 'it') {
      setLocale(browserLang);
    }
  }, []);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const [enResponse, itResponse] = await Promise.all([
          fetch('/locales/en.json'),
          fetch('/locales/it.json')
        ]);
        
        if (!enResponse.ok || !itResponse.ok) {
            const errorText = `Failed to fetch translations. en: ${enResponse.status}, it: ${itResponse.status}`;
            throw new Error(errorText);
        }
        
        const enJson = await enResponse.json();
        const itJson = await itResponse.json();
        
        setTranslations({ en: enJson, it: itJson });
      } catch (error) {
        console.error("Failed to load translations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTranslations();
  }, []);

  // Fix: Updated `t` function implementation to handle string interpolation.
  const t = useCallback((key: string, options?: { [key: string]: string | number }): string => {
    const findTranslation = (source: any, translationKey: string): string | undefined => {
        const keys = translationKey.split('.');
        let result: any = source;
        for (const k of keys) {
            result = result?.[k];
            if (result === undefined) return undefined;
        }
        return typeof result === 'string' ? result : undefined;
    };

    let translatedString = findTranslation(translations[locale], key) ?? findTranslation(translations.en, key) ?? key;
    
    if (options && translatedString !== key) {
      Object.keys(options).forEach(optionKey => {
        const regex = new RegExp(`{{${optionKey}}}`, 'g');
        translatedString = translatedString.replace(regex, String(options[optionKey]));
      });
    }

    return translatedString;
  }, [locale, translations]);

  // Non eseguire il rendering dell'app finché le traduzioni non sono caricate per evitare errori
  if (isLoading) {
    return null;
  }

  return (
    <LocalizationContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocalizationContext.Provider>
  );
};
