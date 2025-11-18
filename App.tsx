import React, { useState } from 'react';
import Header from './components/Header';
import Tabs from './components/Tabs';
import ResearchTab from './components/tabs/ResearchTab';
import MarketTrendsTab from './components/tabs/MarketTrendsTab';
import StructureTab from './components/tabs/StructureTab';
import ContentTab from './components/tabs/ContentTab';
import LayoutTab from './components/tabs/LayoutTab';
import CoverTab from './components/tabs/CoverTab';
import MetadataTab from './components/tabs/MetadataTab';
import ValidationTab from './components/tabs/ValidationTab';
import AppendicesTab from './components/tabs/RecipesTab';
import { useProject } from './hooks/useProject';
import WelcomeScreen from './components/WelcomeScreen';
import type { TabKey } from './types';
import ArchiveTab from './components/tabs/ArchiveTab';
import RevisionTab from './components/tabs/RevisionTab';
import ConversionTab from './components/tabs/ConversionTab';
import AudiobookTab from './components/tabs/AudiobookTab';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('marketTrends');
  const { project, isProjectStarted } = useProject();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'research':
        return <ResearchTab />;
      case 'marketTrends':
        return <MarketTrendsTab setActiveTab={setActiveTab} />;
      case 'structure':
        return <StructureTab />;
      case 'metadata':
        return <MetadataTab />;
      case 'cover':
        return <CoverTab />;
      case 'content':
        return <ContentTab />;
      case 'appendices':
        return <AppendicesTab />;
      case 'layout':
        return <LayoutTab />;
      case 'revision':
        return <RevisionTab />;
      case 'audiobook':
        return <AudiobookTab />;
      case 'validation':
        return <ValidationTab />;
      case 'conversion':
        return <ConversionTab />;
      case 'archive':
        return <ArchiveTab />;
      default:
        return <MarketTrendsTab setActiveTab={setActiveTab} />;
    }
  };

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