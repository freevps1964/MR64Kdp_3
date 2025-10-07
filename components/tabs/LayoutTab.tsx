

import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import type { LayoutTemplate, PageSize } from '../../types';
import BookPreview from '../PromptForm';
import LoadingSpinner from '../icons/LoadingSpinner';

declare const html2canvas: any;
declare const jspdf: any;

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
  const [isExporting, setIsExporting] = useState(false);

  const templates: { name: LayoutTemplate, description: string }[] = [
    { name: 'Classic', description: t('layoutTab.classic') },
    { name: 'Modern', description: t('layoutTab.modern') },
    { name: 'Minimalist', description: t('layoutTab.minimalist') },
  ];

  const handleSelectTemplate = (template: LayoutTemplate) => {
    updateProject({ layoutTemplate: template });
  };
  
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

  const handleExportDoc = () => {
    if (!project) return;
    const bookPageElement = document.querySelector('.book-page');
    if (!bookPageElement) return;

    const layout = project.layoutTemplate;
    const font = layout === 'Classic' ? "'EB Garamond', serif" :
                 layout === 'Modern' ? "'Georgia', serif" :
                 "'Times New Roman', Times, serif";

    const styles = `
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400&display=swap');
        body {
            font-family: ${font};
            font-size: 14pt;
            line-height: 1.5;
            margin: 1.27cm;
        }
        .book-title { font-size: 2.25rem; text-align: center; }
        .book-subtitle { font-size: 1.25rem; text-align: center; color: #6b7280; }
        .book-author { text-align: center; font-style: italic; margin-bottom: 3rem; }
        .chapter-container { margin-top: 2.5rem; page-break-before: always; }
        .chapter-title { font-size: 1.875rem; font-weight: 600; margin-bottom: 1.5rem; border-bottom: 1px solid #d1d5db; padding-bottom: 0.5rem; }
        .subchapter-container { margin-top: 1.5rem; margin-left: 1rem; }
        .subchapter-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; }
        .content-block { line-height: 1.5; font-size: 14pt; }
        .content-block br { content: ""; display: block; margin-bottom: 1rem; }
    `;

    const htmlString = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <title>${project.projectTitle}</title>
                <style>${styles}</style>
            </head>
            <body>
                ${bookPageElement.innerHTML}
            </body>
        </html>
    `;

    const blob = new Blob([htmlString], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.projectTitle || 'book'}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

  const handlePrint = () => {
    window.print();
  };
  
  const classicPreview = (
     <div className="font-serif" style={{ fontFamily: 'EB Garamond, serif' }}>
        <div className="text-xl font-bold text-center">Chapter Title</div>
        <div className="h-1 w-1/4 bg-gray-400 mx-auto my-2"></div>
        <div className="text-xs text-justify">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.</div>
    </div>
  );
  
  const modernPreview = (
      <div className="font-sans" style={{ fontFamily: 'Georgia, serif' }}>
        <div className="text-xl font-bold text-brand-primary">Chapter Title</div>
        <div className="h-0.5 w-full bg-brand-primary my-2"></div>
        <div className="text-xs text-left">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.</div>
    </div>
  );

  // Fix: Corrected the malformed `fontFamily` style property. The original syntax was invalid, causing multiple parsing errors.
  const minimalistPreview = (
      <div className="font-sans" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        <div className="text-lg font-semibold">Chapter Title</div>
        <div className="text-xs text-left mt-3 leading-relaxed">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.</div>
    </div>
  );

  const templatePreviews = {
      'Classic': classicPreview,
      'Modern': modernPreview,
      'Minimalist': minimalistPreview,
  }

  const selectedPageSize = project?.pageSize || '6x9';

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('layoutTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('layoutTab.description')}
      </p>
    <div className="flex flex-col sm:flex-row gap-6 mb-8">
      <div className="w-full sm:w-2/3 grid grid-cols-1 md:grid-cols-3 gap-6">
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
       <div className="w-full sm:w-1/3">
           <label htmlFor="pageSize" className="block text-sm font-medium text-gray-700 mb-2">
            Formato Pagina (KDP)
            </label>
            <select
                id="pageSize"
                name="pageSize"
                value={selectedPageSize}
                onChange={(e) => updateProject({ pageSize: e.target.value as PageSize })}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
            >
                <option value="6x9">6" x 9" (15.24 x 22.86 cm)</option>
                <option value="7x10">7" x 10" (17.78 x 25.4 cm)</option>
            </select>
       </div>
    </div>
      
       <div className="mt-8">
         <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
            <h3 className="text-xl font-bold text-brand-dark">{t('layoutTab.previewTitle')}</h3>
            <div className="flex items-center gap-2">
                <button
                    onClick={handlePrint}
                    disabled={isExporting}
                    className="flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium disabled:cursor-not-allowed disabled:shadow-none"
                    >
                    {t('layoutTab.print')}
                </button>
                <button
                    onClick={handleExportDoc}
                    disabled={isExporting || !project?.bookStructure}
                    className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium disabled:cursor-not-allowed disabled:shadow-none"
                    >
                    {isExporting ? <LoadingSpinner /> : 'Export .doc'}
                </button>
                 <button
                    disabled
                    className="flex items-center justify-center bg-gray-400 text-white font-bold py-2 px-4 rounded-lg cursor-not-allowed"
                    >
                    Export .epub (Soon)
                </button>
                <button
                onClick={handleExportPDF}
                disabled={isExporting || !project?.bookStructure}
                className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium disabled:cursor-not-allowed disabled:shadow-none"
                >
                {isExporting ? <LoadingSpinner /> : t('layoutTab.exportPDF')}
                </button>
            </div>
         </div>
        <BookPreview 
            project={project} 
            layout={project?.layoutTemplate || 'Modern'}
            pageSize={selectedPageSize}
         />
      </div>
    </Card>
  );
};

export default LayoutTab;