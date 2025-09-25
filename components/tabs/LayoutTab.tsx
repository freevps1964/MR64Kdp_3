import React from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import type { LayoutTemplate } from '../../types';

const LayoutTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();

  const templates: { name: LayoutTemplate, description: string }[] = [
    { name: 'Classic', description: t('layoutTab.classic') },
    { name: 'Modern', description: t('layoutTab.modern') },
    { name: 'Minimalist', description: t('layoutTab.minimalist') },
  ];

  const handleSelectTemplate = (template: LayoutTemplate) => {
    updateProject({ layoutTemplate: template });
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('layoutTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('layoutTab.description')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {templates.map((template) => (
          <button
            key={template.name}
            onClick={() => handleSelectTemplate(template.name)}
            className={`p-6 border-2 rounded-lg text-left transition-all duration-200
              ${project?.layoutTemplate === template.name
                ? 'border-brand-primary ring-2 ring-brand-light bg-brand-light/10'
                : 'border-gray-300 hover:border-brand-secondary hover:shadow-md'
              }`
            }
          >
            <h3 className="text-lg font-bold text-brand-dark">{template.name}</h3>
            <p className="text-sm text-neutral-medium mt-2">{template.description}</p>
          </button>
        ))}
      </div>
      
      <div className="mt-8 text-center p-4 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg">
        <p>{t('layoutTab.comingSoon')}</p>
      </div>
    </Card>
  );
};

export default LayoutTab;
