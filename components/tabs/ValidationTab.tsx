import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import BookPreview from '../PromptForm';
import LoadingSpinner from '../icons/LoadingSpinner';
import type { LayoutTemplate, PageSize } from '../../types';

const ValidationTab: React.FC = () => {
  const { t } = useLocalization();
  const { project } = useProject();
  const [isExporting, setIsExporting] = useState(false);

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

  const waitForLibraries = (timeout = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
        const checkLibs = () => {
            if ((window as any).html2canvas && (window as any).jspdf) {
                return true;
            }
            return false;
        }

        if (checkLibs()) {
            return resolve();
        }

        const startTime = Date.now();
        const intervalId = setInterval(() => {
            if (checkLibs()) {
                clearInterval(intervalId);
                return resolve();
            }
            if (Date.now() - startTime > timeout) {
                clearInterval(intervalId);
                return reject(new Error("PDF generation libraries failed to load."));
            }
        }, 200);
    });
  };

  const handleExportPDF = async () => {
    if (!project) return;
    setIsExporting(true);

    try {
        await waitForLibraries();

        const { html2canvas } = window as any;
        const { jsPDF } = (window as any).jspdf;

        const fullBookContainer = document.getElementById('validation-export-container');
        if (!fullBookContainer) {
            throw new Error("Full book render container not found.");
        }

        const pages = fullBookContainer.querySelectorAll('.book-page');
        if (pages.length === 0) {
            throw new Error("No pages found to export.");
        }

        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'pt',
            format: project.pageSize === '6x9' ? [432, 648] : [504, 720],
        });

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i] as HTMLElement;
            const canvas = await html2canvas(page, {
                scale: 2,
                useCORS: true,
                logging: false,
                width: page.offsetWidth,
                height: page.offsetHeight,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            if (i > 0) {
                pdf.addPage();
            }
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        }

        pdf.save(`${project.projectTitle || 'book'}.pdf`);

    } catch (error: any) {
        console.error("Error exporting PDF:", error);
        alert(`An error occurred while exporting the PDF: ${error.message}`);
    } finally {
        setIsExporting(false);
    }
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
      
      <div id="validation-export-container" style={{ position: 'fixed', left: '-9999px', top: '-9999px', zIndex: -1 }}>
        {project && (
           <BookPreview
              project={project}
              layout={project.layoutTemplate}
              pageSize={project.pageSize}
              renderAllPages={true}
          />
        )}
      </div>
    </>
  );
};

export default ValidationTab;