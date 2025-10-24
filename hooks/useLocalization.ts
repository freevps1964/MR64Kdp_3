import { useContext } from 'react';
import { LocalizationContext, LocalizationContextType } from '../contexts/LocalizationContext';

export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};

export { LocalizationProvider } from '../contexts/LocalizationContext';
