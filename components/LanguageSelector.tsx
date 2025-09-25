import React, { useState, useRef, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { Language } from '../types';

const LanguageSelector: React.FC = () => {
  const { locale, setLocale } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: { code: Language; name: string; flag: string }[] = [
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ];

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleLanguageChange = (lang: Language) => {
    setLocale(lang);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLanguage = languages.find(lang => lang.code === locale);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center space-x-2 bg-brand-secondary px-3 py-2 rounded-md hover:bg-brand-dark transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span>{selectedLanguage?.flag}</span>
        <span className="hidden sm:inline text-white">{selectedLanguage?.name}</span>
        <svg className={`w-4 h-4 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10">
          <ul className="py-1">
            {languages.map((lang) => (
              <li key={lang.code}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleLanguageChange(lang.code);
                  }}
                  className={`flex items-center px-4 py-2 text-sm ${locale === lang.code ? 'bg-brand-light text-white' : 'text-neutral-dark hover:bg-neutral-light'}`}
                >
                  <span className="mr-2">{lang.flag}</span>
                  {lang.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
