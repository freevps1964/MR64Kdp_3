import React from 'react';
import { LocalizationProvider } from '../contexts/LocalizationContext';
import { ProjectProvider } from '../contexts/ProjectContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <LocalizationProvider>
      <ProjectProvider>
        {children}
      </ProjectProvider>
    </LocalizationProvider>
  );
};
