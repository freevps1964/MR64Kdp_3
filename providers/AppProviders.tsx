import React from 'react';
import { LocalizationProvider } from '../contexts/LocalizationContext';
import { ProjectProvider } from '../contexts/ProjectContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <LocalizationProvider>
      <ToastProvider>
        <AuthProvider>
          <ProjectProvider>
            {children}
          </ProjectProvider>
        </AuthProvider>
      </ToastProvider>
    </LocalizationProvider>
  );
};