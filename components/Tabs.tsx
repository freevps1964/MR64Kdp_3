import React from 'react';
import { useLocalization } from '../hooks/useLocalization';
import type { TabKey, Project } from '../types';

interface TabsProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  project: Project | null;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab, project }) => {
  const { t } = useLocalization();

  const isResearchComplete = !!project?.researchData;
  const isStructureComplete = !!project?.bookStructure && project.bookStructure.chapters.length > 0;
  
  // Content writing can start once the structure is defined
  const isContentComplete = isStructureComplete; 

  const TABS: { key: TabKey, label: string, isEnabled: boolean }[] = [
    { key: 'research', label: t('tabs.research'), isEnabled: true },
    { key: 'structure', label: t('tabs.structure'), isEnabled: isResearchComplete },
    { key: 'content', label: t('tabs.content'), isEnabled: isStructureComplete },
    { key: 'layout', label: t('tabs.layout'), isEnabled: isContentComplete },
    { key: 'cover', label: t('tabs.cover'), isEnabled: isContentComplete },
    { key: 'metadata', label: t('tabs.metadata'), isEnabled: isContentComplete },
    { key: 'validation', label: t('tabs.validation'), isEnabled: isContentComplete },
  ];

  const handleTabClick = (tab: { key: TabKey, isEnabled: boolean }) => {
    if (tab.isEnabled) {
      setActiveTab(tab.key);
    }
  };

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex flex-wrap space-x-2 sm:space-x-4 md:space-x-8" aria-label="Tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab)}
            disabled={!tab.isEnabled}
            className={`whitespace-nowrap py-3 px-2 sm:px-3 md:px-4 border-b-2 font-semibold text-sm sm:text-base focus:outline-none transition-colors duration-200 ease-in-out
              ${
                activeTab === tab.key
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-neutral-medium hover:text-neutral-dark hover:border-gray-300'
              }
              ${!tab.isEnabled ? 'cursor-not-allowed opacity-50' : ''}
            `}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            title={!tab.isEnabled ? t('tabs.disabledTooltip') : tab.label}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Tabs;