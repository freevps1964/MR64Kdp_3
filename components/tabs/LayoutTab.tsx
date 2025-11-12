import React, { useState, useEffect, useRef } from 'react';
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
  const [customStyles, setCustomStyles] = useState<CustomStyles>(project?.customStyles || defaultCustomStyles);
  
  const [targetLang, setTargetLang] = useState('it');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translatedProject, setTranslatedProject] = useState<Project | null>(null);
  
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);


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
  
   useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  
  const getBookAsHtmlString = (): string => {
    const projectToRender = translatedProject || project;
    if (!projectToRender) return '';

    const titlePage = `
        <div style="text-align: center; page-break-after: always;">
            <h1>${projectToRender.bookTitle || ''}</h1>
            <h2>${projectToRender.subtitle || ''}</h2>
            <p><em>di ${projectToRender.author || ''}</em></p>
        </div>
    `;

    const chaptersHtml = projectToRender.bookStructure?.chapters.map(chapter => `
        <div style="page-break-before: always;">
            <h3>${chapter.title}</h3>
            <div>${chapter.content || ''}</div>
            ${chapter.subchapters.map(sub => `
                <h4>${sub.title}</h4>
                <div>${sub.content || ''}</div>
            `).join('')}
        </div>
    `).join('') || '';

    const appendicesHtml = projectToRender.contentBlocks?.map(block => `
         <div style="page-break-before: always;">
            <h3>${block.title}</h3>
             <div>${block.textContent.replace(/\n/g, '<br />')}</div>
         </div>
    `).join('') || '';

    return `
        <html><head><meta charset="UTF-8">
        <style>
            body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; }
            h1 { font-size: 24pt; font-weight: bold; }
            h2 { font-size: 18pt; font-style: italic; }
            h3 { font-size: 18pt; font-weight: bold; }
            h4 { font-size: 14pt; font-weight: bold; }
        </style>
        </head><body>
            ${titlePage}
            ${chaptersHtml}
            ${appendicesHtml}
        </body></html>
    `;
  };
  
  const getBookAsTxtString = (): string => {
    const projectToRender = translatedProject || project;
    if (!projectToRender) return '';

    const brToNewline = (html: string) => {
        const div = document.createElement('div');
        div.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');
        return div.textContent || div.innerText || '';
    };

    const titlePage = `${projectToRender.bookTitle || ''}\n${projectToRender.subtitle || ''}\ndi ${projectToRender.author || ''}\n\n\n`;

    const chaptersTxt = projectToRender.bookStructure?.chapters.map(chapter => 
        `--- CAPITOLO: ${chapter.title} ---\n\n${brToNewline(chapter.content || '')}\n\n` +
        chapter.subchapters.map(sub => 
            `--- Sottocapitolo: ${sub.title} ---\n\n${brToNewline(sub.content || '')}\n\n`
        ).join('')
    ).join('') || '';

    const appendicesTxt = projectToRender.contentBlocks?.map(block => 
        `--- APPENDICE: ${block.title} ---\n\n${block.textContent}\n\n`
    ).join('') || '';

    return titlePage + chaptersTxt + appendicesTxt;
  };

  const handleExportHtml = () => {
    const projectToRender = translatedProject || project;
    if (!projectToRender) return;
    setIsExportMenuOpen(false);
    setIsExporting(true);

    try {
        const htmlContent = getBookAsHtmlString();
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${projectToRender.projectTitle || 'book'}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error: any) {
        console.error("Error exporting HTML:", error);
        showToast(`Errore esportazione HTML: ${error.message}`, 'error');
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportTxt = () => {
    const projectToRender = translatedProject || project;
    if (!projectToRender) return;
    setIsExportMenuOpen(false);
    setIsExporting(true);
    
    try {
        const textContent = getBookAsTxtString();
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${projectToRender.projectTitle || 'book'}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error: any) {
        console.error("Error exporting TXT:", error);
        showToast(`Errore esportazione TXT: ${error.message}`, 'error');
    } finally {
        setIsExporting(false);
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
  const projectToRender = translatedProject || project;

  return (
    <>
    <Card>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-dark">{t('layoutTab.title')}</h2>
          <p className="text-neutral-medium mt-1">
            {t('layoutTab.description')}
          </p>
        </div>
        <div className="relative" ref={exportMenuRef}>
            <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={isExporting}
                className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2 disabled:bg-neutral-medium"
            >
                {isExporting ? <LoadingSpinner /> : '🚀'}
                <span>Esporta</span>
                <svg className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                    <button onClick={handleExportHtml} className="w-full text-left px-4 py-2 text-sm text-neutral-dark hover:bg-neutral-light">HTML (.html)</button>
                    <button onClick={handleExportTxt} className="w-full text-left px-4 py-2 text-sm text-neutral-dark hover:bg-neutral-light">Testo (.txt)</button>
                </div>
            )}
        </div>
      </div>


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
                    <div className="flex gap-2 mt-1">
                        <input type="number" value={customStyles.bodySize} onChange={e => handleCustomStyleChange('bodySize', parseInt(e.target.value, 10))} className="w-1/2 p-1 border rounded-md text-sm" placeholder={t('layoutTab.fontSize')} />
                        <input type="number" step="0.1" value={customStyles.lineHeight} onChange={e => handleCustomStyleChange('lineHeight', parseFloat(e.target.value))} className="w-1/2 p-1 border rounded-md text-sm" placeholder={t('layoutTab.lineHeight')} />
                    </div>
                </div>
            </div>
        </div>
    )}

    <div className="p-4 border-t mt-6">
        <h3 className="text-lg font-semibold text-brand-dark mb-4">Traduzione (Opzionale)</h3>
        <div className="flex items-end gap-4">
            <div className="flex-grow">
                <label htmlFor="lang-select" className="block text-sm font-medium text-gray-700">Traduci il libro in:</label>
                <select id="lang-select" value={targetLang} onChange={e => handleLanguageChange(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm" disabled={isTranslating}>
                    <option value="it">Italiano (Originale)</option>
                    <option value="en">Inglese</option>
                    <option value="de">Tedesco</option>
                </select>
            </div>
            <button onClick={handleTranslate} disabled={isTranslating || targetLang === 'it'} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center gap-2 disabled:bg-neutral-medium">
                {isTranslating ? <LoadingSpinner/> : '🌍'} Traduci
            </button>
        </div>
        {isTranslating && (
             <div className="mt-3">
                <p className="text-sm text-center">Traduzione in corso... {translationProgress}%</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1"><div className="bg-green-600 h-2.5 rounded-full" style={{width: `${translationProgress}%`}}></div></div>
             </div>
        )}
    </div>

    <h3 className="text-xl font-bold text-brand-dark mt-8 mb-4">{t('layoutTab.previewTitle')}</h3>
      <BookPreview
        project={projectToRender}
        layout={project?.layoutTemplate || 'Classic'}
        pageSize={selectedPageSize}
      />
    </Card>
    </>
  );
};

export default LayoutTab;
