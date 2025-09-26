import React from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import type { LayoutTemplate } from '../../types';
import BookPreview from '../PromptForm';

const LayoutTemplateCard: React.FC<{
  name: LayoutTemplate;
  description: string;
  isSelected: boolean;
  onClick: () => void;
  preview: React.ReactNode;
}> = ({ name, description, isSelected, onClick, preview }) => (
  <button
    onClick={onClick}
    className={`p-4 border-2 rounded-lg text-left transition-all duration-200 w-full flex flex-col
      ${isSelected
        ? 'border-brand-primary ring-2 ring-brand-light bg-brand-light/10'
        : 'border-gray-300 hover:border-brand-secondary hover:shadow-md bg-white'
      }`
    }
  >
    <h3 className="text-lg font-bold text-brand-dark">{name}</h3>
    <p className="text-sm text-neutral-medium mt-1 mb-3 flex-grow">{description}</p>
    <div className="w-full h-32 bg-neutral-light rounded-sm p-2 overflow-hidden pointer-events-none">
      {preview}
    </div>
  </button>
);


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
  
  const classicPreview = (
     <div className="font-serif">
        <div className="text-xl font-bold text-center">Chapter Title</div>
        <div className="h-1 w-1/4 bg-gray-400 mx-auto my-2"></div>
        <div className="text-xs text-justify">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.</div>
    </div>
  );
  
  const modernPreview = (
      <div className="font-sans">
        <div className="text-xl font-bold text-brand-primary">Chapter Title</div>
        <div className="h-0.5 w-full bg-brand-primary my-2"></div>
        <div className="text-xs text-left">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.</div>
    </div>
  );

  const minimalistPreview = (
      <div className="font-sans">
        <div className="text-lg font-semibold">Chapter Title</div>
        <div className="text-xs text-left mt-3 leading-relaxed">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.</div>
    </div>
  );

  const templatePreviews = {
      'Classic': classicPreview,
      'Modern': modernPreview,
      'Minimalist': minimalistPreview,
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('layoutTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('layoutTab.description')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {templates.map((template) => (
          <LayoutTemplateCard
            key={template.name}
            name={template.name}
            description={template.description}
            isSelected={project?.layoutTemplate === template.name}
            onClick={() => handleSelectTemplate(template.name)}
            preview={templatePreviews[template.name]}
          />
        ))}
      </div>
      
       <div className="mt-8">
         <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-brand-dark">{t('layoutTab.previewTitle')}</h3>
            <button
              disabled={true}
              className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium disabled:cursor-not-allowed disabled:shadow-none"
            >
              {t('layoutTab.exportPDF')}
            </button>
         </div>
        <BookPreview project={project} layout={project?.layoutTemplate || 'Modern'} />
      </div>
    </Card>
  );
};

export default LayoutTab;