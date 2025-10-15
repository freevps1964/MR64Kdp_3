import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import type { LayoutTemplate, PageSize, Project } from '../../types';
import BookPreview from '../PromptForm';
import LoadingSpinner from '../icons/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { translateFullProject } from '../../services/geminiService';

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
  const { showToast } = useToast();

  const [isExporting, setIsExporting] = useState(false);
  const [showFullRender, setShowFullRender] = useState(false);
  
  // Stati per la traduzione
  const [targetLang, setTargetLang] = useState('it');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translatedProject, setTranslatedProject] = useState<Project | null>(null);

  const templates: { name: LayoutTemplate, description: string }[] = [
    { name: 'Classic', description: t('layoutTab.classic') },
    { name: 'Modern', description: t('layoutTab.modern') },
    { name: 'Minimalist', description: t('layoutTab.minimalist') },
  ];

  const handleSelectTemplate = (template: LayoutTemplate) => {
    updateProject({ layoutTemplate: template });
  };
  
  const handleLanguageChange = (lang: string) => {
    setTargetLang(lang);
    setTranslatedProject(null); // Resetta la traduzione quando la lingua cambia
  };

  const handleTranslate = async () => {
    if (!project || targetLang === 'it') return;
    
    setIsTranslating(true);
    setTranslationProgress(0);
    setTranslatedProject(null);

    try {
        const translation = await translateFullProject(
            project,
            targetLang,
            (progress) => setTranslationProgress(progress)
        );
        setTranslatedProject(translation);
        showToast('Traduzione completata!', 'success');
    } catch (error) {
        console.error("Translation failed:", error);
        showToast('Errore durante la traduzione.', 'error');
    } finally {
        setIsTranslating(false);
    }
  };

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
    setShowFullRender(true);

    setTimeout(async () => {
        try {
            await waitForLibraries();

            const { html2canvas } = window as any;
            const { jsPDF } = (window as any).jspdf;

            const fullBookContainer = document.getElementById('full-book-render-for-export');
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
            setShowFullRender(false);
        }
    }, 200);
  };

    const handleExportDoc = () => {
        const projectToExport = translatedProject || project;
        if (!projectToExport || !projectToExport.bookStructure) return;

        const layout = projectToExport.layoutTemplate;
        const font = layout === 'Classic' ? "'EB Garamond', serif" :
                     layout === 'Modern' ? "'Georgia', serif" :
                     "'Times New Roman', Times, serif";

        const styles = `
            @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;600;700&display=swap');
            body {
                font-family: ${font};
                font-size: 14pt;
                line-height: 1.5;
                margin: 1.27cm;
            }
            .book-title { font-size: 20pt; font-weight: bold; text-align: center; }
            .book-subtitle { font-size: 12pt; font-weight: bold; font-style: italic; text-align: center; color: #6b7280; }
            .book-author { text-align: center; font-style: italic; margin-bottom: 3rem; }
            .chapter-container { margin-top: 2.5rem; page-break-before: always; }
            .chapter-title { font-size: 16pt; font-weight: bold; margin-bottom: 1.5rem; border-bottom: 1px solid #d1d5db; padding-bottom: 0.5rem; }
            .subchapter-container { margin-top: 1.5rem; margin-left: 1rem; }
            .subchapter-title { font-size: 14pt; font-weight: bold; margin-bottom: 1rem; }
            .content-block { line-height: 1.5; font-size: 14pt; }
            .content-block br { content: ""; display: block; margin-bottom: 1rem; }
        `;

        const sanitizePlainText = (text: string) => (text || '').replace(/\n/g, '<br />');

        let bodyContent = `
            <div>
                <h1 class="book-title">${projectToExport.bookTitle || projectToExport.projectTitle}</h1>
                ${projectToExport.subtitle ? `<p class="book-subtitle">${projectToExport.subtitle}</p>` : ''}
                ${projectToExport.author ? `<p class="book-author">by ${projectToExport.author}</p>` : ''}
            </div>
        `;

        projectToExport.bookStructure.chapters.forEach(chapter => {
            bodyContent += `
                <div class="chapter-container">
                    <h2 class="chapter-title">${chapter.title}</h2>
                    ${chapter.content ? `<div class="content-block">${chapter.content}</div>` : ''}
                    
                    ${chapter.subchapters.map(subchapter => `
                        <div class="subchapter-container">
                            <h3 class="subchapter-title">${subchapter.title}</h3>
                            ${subchapter.content ? `<div class="content-block">${subchapter.content}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        });

        if (projectToExport.contentBlocks && projectToExport.contentBlocks.length > 0) {
            bodyContent += `
                <div class="chapter-container">
                    <h2 class="chapter-title">${t('layoutTab.appendix')}</h2>
                    ${projectToExport.contentBlocks.map(block => `
                        <div class="subchapter-container">
                            <h3 class="subchapter-title">${block.title}</h3>
                            ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.title}" style="display: block; margin: 1.5rem auto; max-width: 80%; border: 1px solid #cccccc; padding: 5px;" />` : ''}
                            <div class="content-block">${sanitizePlainText(block.textContent)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        const htmlString = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${projectToExport.projectTitle}</title>
                    <style>${styles}</style>
                </head>
                <body>
                    ${bodyContent}
                </body>
            </html>
        `;

        const blob = new Blob([htmlString], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectToExport.projectTitle || 'book'}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                 <div className="flex items-center gap-2 border-r pr-2 mr-2 border-gray-300">
                    <select
                        value={targetLang}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="p-2 border border-gray-300 rounded-md bg-white text-sm focus:ring-brand-light focus:border-brand-light"
                        disabled={isTranslating}
                    >
                        <option value="it">Italiano (Originale)</option>
                        <option value="en">Inglese</option>
                        <option value="de">Tedesco</option>
                    </select>
                    <button
                        onClick={handleTranslate}
                        disabled={isTranslating || targetLang === 'it'}
                        className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium disabled:cursor-not-allowed"
                    >
                        {isTranslating ? <LoadingSpinner /> : 'Traduci'}
                    </button>
                </div>
                <button
                    onClick={handleExportDoc}
                    disabled={isExporting || !project?.bookStructure || isTranslating}
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
                disabled={isExporting || !project?.bookStructure || isTranslating}
                className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium disabled:cursor-not-allowed disabled:shadow-none"
                >
                {isExporting ? <LoadingSpinner /> : t('layoutTab.exportPDF')}
                </button>
            </div>
         </div>
         {isTranslating && (
            <div className="my-4">
                <p className="text-center text-sm text-neutral-medium mb-1">Traduzione in corso... {translationProgress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${translationProgress}%` }}></div>
                </div>
            </div>
          )}
        <BookPreview 
            project={translatedProject || project} 
            layout={project?.layoutTemplate || 'Modern'}
            pageSize={selectedPageSize}
         />
      </div>
      
      {showFullRender && project && (
          <div id="full-book-render-for-export">
              <BookPreview 
                  project={project} 
                  layout={project.layoutTemplate}
                  pageSize={project.pageSize}
                  renderAllPages={true}
              />
          </div>
      )}
    </Card>
  );
};

export default LayoutTab;