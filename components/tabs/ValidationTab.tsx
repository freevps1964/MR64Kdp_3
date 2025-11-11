import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import BookPreview from '../PromptForm';
import LoadingSpinner from '../icons/LoadingSpinner';
import type { LayoutTemplate, PageSize } from '../../types';
import { useToast } from '../../hooks/useToast';

const ValidationTab: React.FC = () => {
  const { t } = useLocalization();
  const { project } = useProject();
  const [isExporting, setIsExporting] = useState(false);
  const [showFullRender, setShowFullRender] = useState(false);
  const { showToast } = useToast();

  const isResearchComplete = !!project?.researchData;
  const isStructureComplete = !!project?.bookStructure && project.bookStructure.chapters.length > 0;
  const isMetadataComplete = !!(project?.bookTitle && project?.author && project?.description);
  
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
    { label: t('validationTab.item0_research'), checked: isResearchComplete },
    { label: t('validationTab.item0_structure'), checked: isStructureComplete },
    { label: t('validationTab.item1'), checked: areAllChaptersWritten },
    { label: t('validationTab.item2'), checked: isMetadataComplete },
    { label: t('validationTab.item3'), checked: !!project?.coverImage },
    { label: t('validationTab.item4'), checked: !!project?.layoutTemplate },
  ];
  
  const isReadyForExport = checklistItems.every(item => item.checked);

  const handleExportPDF = async () => {
    if (!isReadyForExport) return;
    setIsExporting(true);
    setShowFullRender(true);

    // Usa la funzione di stampa del browser che è più stabile per contenuti lunghi
    setTimeout(() => {
        try {
            window.print();
        } catch (error) {
            console.error("Print function failed:", error);
            showToast('Failed to open print dialog.', 'error');
        } finally {
            // Nascondi il container di rendering dopo la stampa
            setTimeout(() => {
                setShowFullRender(false);
                setIsExporting(false);
            }, 500);
        }
    }, 500); // A small delay to ensure rendering is complete
  };


  return (
    <>
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
            onClick={handleExportPDF}
            disabled={!isReadyForExport || isExporting}
            className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-8 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center mx-auto"
          >
            {isExporting ? <LoadingSpinner /> : t('validationTab.exportButton')}
          </button>
        </div>
      </Card>
      
      {showFullRender && (
          <div id="validation-export-container">
            {project && (
               <BookPreview
                  project={project}
                  layout={project.layoutTemplate}
                  pageSize={project.pageSize}
                  renderAllPages={true}
              />
            )}
          </div>
      )}
    </>
  );
};

export default ValidationTab;