import React from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';

const ValidationTab: React.FC = () => {
  const { t } = useLocalization();
  const { project } = useProject();

  const isMetadataComplete = !!(project?.projectTitle && project?.author && project?.description);
  
  let areAllChaptersWritten = false;
  if (project?.bookStructure && project.bookStructure.chapters.length > 0) {
    // A "content node" is a chapter without subchapters, or a subchapter.
    // These are the only places we expect written content.
    const contentNodes = project.bookStructure.chapters.flatMap(chapter =>
      chapter.subchapters.length > 0 ? chapter.subchapters : [chapter]
    );
    
    areAllChaptersWritten = contentNodes.length > 0 && contentNodes.every(
      node => node.content?.trim() !== ''
    );
  }

  const checklistItems = [
    { label: t('validationTab.item1'), checked: areAllChaptersWritten },
    { label: t('validationTab.item2'), checked: isMetadataComplete },
    { label: t('validationTab.item3'), checked: !!project?.coverImage },
    { label: t('validationTab.item4'), checked: !!project?.layoutTemplate },
  ];
  
  const isReadyForExport = checklistItems.every(item => item.checked);

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('validationTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('validationTab.description')}
      </p>

      <div className="p-6 bg-neutral-light rounded-lg border">
        <h3 className="text-xl font-semibold text-brand-dark mb-4">{t('validationTab.checklistTitle')}</h3>
        <ul className="space-y-3">
          {checklistItems.map((item, index) => (
            <li key={index} className="flex items-center">
              <span className={`mr-3 text-2xl ${item.checked ? 'text-green-500' : 'text-neutral-medium'}`}>
                {item.checked ? '✓' : '○'}
              </span>
              <span className={item.checked ? 'text-neutral-dark' : 'text-neutral-medium'}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 text-center">
        <button
          disabled={!isReadyForExport}
          className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-8 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium disabled:cursor-not-allowed disabled:shadow-none"
        >
          {t('validationTab.exportButton')}
        </button>
      </div>
    </Card>
  );
};

export default ValidationTab;