import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import type { LayoutTemplate, PageSize, Project, CustomStyles } from '../../types';
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

const defaultCustomStyles: CustomStyles = {
    titleFont: 'EB Garamond',
    titleSize: 22,
    subtitleFont: 'Montserrat',
    subtitleSize: 14,
    bodyFont: 'EB Garamond',
    bodySize: 12,
    lineHeight: 1.5,
    chapterTitleFont: 'Montserrat',
    chapterTitleSize: 18,
};

const LayoutTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();
  const { showToast } = useToast();

  const [isExporting, setIsExporting] = useState(false);
  const [showFullRender, setShowFullRender] = useState(false);
  const [customStyles, setCustomStyles] = useState<CustomStyles>(project?.customStyles || defaultCustomStyles);
  
  const [targetLang, setTargetLang] = useState('it');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translatedProject, setTranslatedProject] = useState<Project | null>(null);

  useEffect(() => {
    if (project?.customStyles) {
        setCustomStyles(project.customStyles);
    }
  }, [project?.customStyles]);

  useEffect(() => {
    if (project?.layoutTemplate === 'Custom') {
        const handler = setTimeout(() => {
            updateProject({ customStyles });
        }, 500); // Debounce updates
        return () => clearTimeout(handler);
    }
  }, [customStyles, project?.layoutTemplate, updateProject]);

  const templates: { name: LayoutTemplate, description: string }[] = [
    { name: 'Classic', description: t('layoutTab.classic') },
    { name: 'Modern', description: t('layoutTab.modern') },
    { name: 'Minimalist', description: t('layoutTab.minimalist') },
    { name: 'Custom', description: t('layoutTab.custom') },
  ];
  
  const googleFonts = ['EB Garamond', 'Montserrat', 'Lato', 'Roboto', 'Open Sans', 'Georgia', 'Times New Roman'];

  const handleSelectTemplate = (template: LayoutTemplate) => {
    updateProject({ layoutTemplate: template });
  };
  
  const handleLanguageChange = (lang: string) => {
    setTargetLang(lang);
    setTranslatedProject(null); 
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
            showToast(`Error exporting PDF: ${error.message}`, 'error');
        } finally {
            setIsExporting(false);
            setShowFullRender(false);
        }
    }, 500);
  };
    
    const handleExportImage = async () => {
        const previewElement = document.getElementById('book-preview-content');
        if (!previewElement) return;

        try {
            await waitForLibraries();
            const { html2canvas } = window as any;
            const canvas = await html2canvas(previewElement, {
                backgroundColor: null, // Transparent background
                useCORS: true,
            });
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `${project?.projectTitle || 'book-preview'}.png`;
            link.click();
        } catch (error) {
            console.error('Error exporting image:', error);
            showToast('Failed to export image.', 'error');
        }
    };

    const handleCustomStyleChange = (field: keyof CustomStyles, value: string | number) => {
        setCustomStyles(prev => ({ ...prev, [field]: value }));
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

  const customPreview = (
      <div style={{ fontFamily: customStyles.bodyFont }}>
        <div style={{ fontFamily: customStyles.chapterTitleFont, fontSize: '1.25rem', fontWeight: 'bold' }}>Custom Title</div>
        <div className="text-xs text-left mt-3" style={{ lineHeight: customStyles.lineHeight }}>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet.</div>
    </div>
  );

  const templatePreviews = {
      'Classic': classicPreview,
      'Modern': modernPreview,
      'Minimalist': minimalistPreview,
      'Custom': customPreview
  }

  const selectedPageSize = project?.pageSize || '6x9';

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('layoutTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('layoutTab.description')}
      </p>

    <div className="flex flex-col xl:flex-row gap-6 mb-8">
      <div className="w-full xl:w-2/3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
      <div className="w-full xl:w-1/3">
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
    
    {project?.layoutTemplate === 'Custom' && (
        <div className="mb-8 p-4 border rounded-lg bg-neutral-light/50 animate-fade-in">
            <h3 className="text-lg font-semibold text-brand-dark mb-4">{t('layoutTab.customStylesTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                {/* Main Title */}
                <div className="p-2 border-l-4 border-brand-primary">
                    <label className="block text-sm font-bold text-gray-800">{t('layoutTab.mainTitle')}</label>
                    <select value={customStyles.titleFont} onChange={e => handleCustomStyleChange('titleFont', e.target.value)} className="w-full mt-1 p-1 border rounded-md text-sm">
                        {googleFonts.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input type="number" value={customStyles.titleSize} onChange={e => handleCustomStyleChange('titleSize', parseInt(e.target.value, 10))} className="w-full mt-1 p-1 border rounded-md text-sm" placeholder={t('layoutTab.fontSize')} />
                </div>
                 {/* Subtitle */}
                <div className="p-2 border-l-4 border-brand-light">
                    <label className="block text-sm font-bold text-gray-800">{t('layoutTab.subtitle')}</label>
                    <select value={customStyles.subtitleFont} onChange={e => handleCustomStyleChange('subtitleFont', e.target.value)} className="w-full mt-1 p-1 border rounded-md text-sm">
                        {googleFonts.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input type="number" value={customStyles.subtitleSize} onChange={e => handleCustomStyleChange('subtitleSize', parseInt(e.target.value, 10))} className="w-full mt-1 p-1 border rounded-md text-sm" placeholder={t('layoutTab.fontSize')} />
                </div>
                {/* Chapter Title */}
                <div className="p-2 border-l-4 border-brand-secondary">
                    <label className="block text-sm font-bold text-gray-800">{t('layoutTab.chapterTitle')}</label>
                    <select value={customStyles.chapterTitleFont} onChange={e => handleCustomStyleChange('chapterTitleFont', e.target.value)} className="w-full mt-1 p-1 border rounded-md text-sm">
                       {googleFonts.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input type="number" value={customStyles.chapterTitleSize} onChange={e => handleCustomStyleChange('chapterTitleSize', parseInt(e.target.value, 10))} className="w-full mt-1 p-1 border rounded-md text-sm" placeholder={t('layoutTab.fontSize')} />
                </div>
                {/* Body Text */}
                <div className="p-2 border-l-4 border-neutral-medium">
                    <label className="block text-sm font-bold text-gray-800">{t('layoutTab.bodyText')}</label>
                    <select value={customStyles.bodyFont} onChange={e => handleCustomStyleChange('bodyFont', e.target.value)} className="w-full mt-1 p-1 border rounded-md text-sm">
                        {googleFonts.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input type="number" value={customStyles.bodySize} onChange={e => handleCustomStyleChange('bodySize', parseInt(e.target.value, 10))} className="w-full mt-1 p-1 border rounded-md text-sm" placeholder={t('layoutTab.fontSize')} />
                    <input type="number" step="0.1" value={customStyles.lineHeight} onChange={e => handleCustomStyleChange('lineHeight', parseFloat(e.target.value))} className="w-full mt-1 p-1 border rounded-md text-sm" placeholder={t('layoutTab.lineHeight')} />
                </div>
            </div>
        </div>
    )}
      
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
                    onClick={handleExportImage}
                    disabled={isExporting}
                    className="flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium"
                >
                    {t('layoutTab.exportImage')}
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