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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('research');
  const { isProjectStarted } = useProject();

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

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-neutral-dark">
      <Header />
      <main className="p-4 sm:p-6 lg:p-8">
        {isProjectStarted ? (
          <>
            <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
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