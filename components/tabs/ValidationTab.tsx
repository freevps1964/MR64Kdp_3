import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import BookPreview from '../PromptForm';
import LoadingSpinner from '../icons/LoadingSpinner';
import type { LayoutTemplate, PageSize } from '../../types';

declare const html2canvas: any;
declare const jspdf: any;

const ValidationTab: React.FC = () => {
  const { t } = useLocalization();
  const { project } = useProject();
  const [isExporting, setIsExporting] = useState(false);

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
    { label: t('validationTab.item1'), checked: areAllChaptersWritten },
    { label: t('validationTab.item2'), checked: isMetadataComplete },
    { label: t('validationTab.item3'), checked: !!project?.coverImage },
    { label: t('validationTab.item4'), checked: !!project?.layoutTemplate },
  ];
  
  const isReadyForExport = checklistItems.every(item => item.checked);

  const handleExportPDF = async () => {
    const previewElement = document.querySelector('.book-page');
    if (!previewElement || !project) return;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(previewElement as HTMLElement, {
        scale: 2,
        useCORS: true,
        scrollY: 0,
        windowWidth: (previewElement as HTMLElement).scrollWidth,
        windowHeight: (previewElement as HTMLElement).scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const { jsPDF } = jspdf;
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4',
        hotfixes: ['px_scaling'],
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const ratio = pdfWidth / imgWidth;
      const scaledImgHeight = imgHeight * ratio;

      let heightLeft = scaledImgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = -heightLeft;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight);
        heightLeft -= pdfHeight;
      }
      
      pdf.save(`${project.projectTitle || 'book'}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("An error occurred while exporting the PDF. Please try again.");
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
      
      {/* Hidden BookPreview for PDF export */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', zIndex: -1 }}>
        {project && (
           <BookPreview
              project={project}
              layout={project.layoutTemplate}
              pageSize={project.pageSize}
          />
        )}
      </div>
    </>
  );
};

export default ValidationTab;