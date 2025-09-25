import React from 'react';
import { useLocalization } from '../hooks/useLocalization';
import type { TabKey } from '../types';

interface TabsProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useLocalization();
  
  const TABS: { key: TabKey, label: string }[] = [
    { key: 'research', label: t('tabs.research') },
    { key: 'structure', label: t('tabs.structure') },
    { key: 'content', label: t('tabs.content') },
    { key: 'layout', label: t('tabs.layout') },
    { key: 'cover', label: t('tabs.cover') },
    { key: 'metadata', label: t('tabs.metadata') },
    { key: 'validation', label: t('tabs.validation') },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex flex-wrap space-x-2 sm:space-x-4 md:space-x-8" aria-label="Tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap py-3 px-2 sm:px-3 md:px-4 border-b-2 font-semibold text-sm sm:text-base focus:outline-none transition-colors duration-200 ease-in-out
              ${
                activeTab === tab.key
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-neutral-medium hover:text-neutral-dark hover:border-gray-300'
              }
            `}
            aria-current={activeTab === tab.key ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Tabs;