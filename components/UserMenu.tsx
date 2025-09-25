import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import UserIcon from './icons/UserIcon';

const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => setIsOpen(!isOpen);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center justify-center h-10 w-10 bg-brand-secondary rounded-full hover:bg-brand-dark transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-brand-primary focus:ring-white"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="User menu"
      >
        <UserIcon />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <div className="px-4 py-2 border-b">
                <p className="text-sm text-neutral-medium">Signed in as</p>
                <p className="text-sm font-medium text-neutral-dark truncate">{user.email}</p>
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                logout();
                setIsOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              {t('header.logout')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;