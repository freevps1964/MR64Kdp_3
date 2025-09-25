import React, { useState } from 'react';
import Header from './components/Header';
import Tabs from './components/Tabs';
import ResearchTab from './components/tabs/ResearchTab';
import StructureTab from './components/tabs/StructureTab';
import ContentTab from './components/tabs/ContentTab';
import LayoutTab from './components/tabs/LayoutTab';
import CoverTab from './components/tabs/CoverTab';
import MetadataTab from './components/tabs/MetadataTab';
import ValidationTab from './components/tabs/ValidationTab';
import { useProject } from './hooks/useProject';
import WelcomeScreen from './components/WelcomeScreen';
import type { TabKey } from './types';
import { useAuth } from './hooks/useAuth';
import LoginScreen from './components/LoginScreen';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('research');
  const { project, isProjectStarted } = useProject();
  const { user, loading, isAuthEnabled } = useAuth();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'research':
        return <ResearchTab />;
      case 'structure':
        return <StructureTab />;
      case 'content':
        return <ContentTab />;
      case 'layout':
        return <LayoutTab />;
      case 'cover':
        return <CoverTab />;
      case 'metadata':
        return <MetadataTab />;
      case 'validation':
        return <ValidationTab />;
      default:
        return <ResearchTab />;
    }
  };
  
  if (loading) {
    return (
        <div className="flex items-center justify-center h-screen bg-neutral-light">
            <div className="text-center">
                <svg className="animate-spin h-10 w-10 text-brand-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        </div>
    );
  }

  if (!user && isAuthEnabled) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-neutral-dark">
      <Header />
      <main className="p-4 sm:p-6 lg:p-8">
        {isProjectStarted ? (
          <>
            <Tabs activeTab={activeTab} setActiveTab={setActiveTab} project={project} />
            <div className="mt-6">
              {renderActiveTab()}
            </div>
          </>
        ) : (
          <WelcomeScreen />
        )}
      </main>
    </div>
  );
};

export default App;