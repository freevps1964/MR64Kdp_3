import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import DocxIcon from '../icons/DocxIcon';
import PdfIcon from '../icons/PdfIcon';
import OdtIcon from '../icons/OdtIcon';

// Declare global libraries from index.html
declare const htmlToDocx: any;
declare const jspdf: any;

const ConversionTab: React.FC = () => {
  const { t } = useLocalization();
  const { project } = useProject();
  const { showToast } = useToast();
  const [isConverting, setIsConverting] = useState<string | null>(null);

  const manuscriptText = project?.manuscript?.regenerated;

  const countWords = (text: string = '') => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const getFullManuscriptAsHTML = (text: string): string => {
    // This function is adapted from RevisionTab to create a KDP-compliant HTML
    const kdpStyles = `<style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 1em; line-height: 1.5; }
        h2 { font-weight: 700; font-size: 1.6em; text-align: center; margin-top: 2em; margin-bottom: 1.5em; page-break-before: always; }
        h3 { font-weight: 700; font-size: 1.4em; margin-top: 1.5em; margin-bottom: 1em; }
        h4 { font-weight: 700; font-size: 1.2em; font-style: italic; margin-top: 1.2em; margin-bottom: 0.8em; }
        p { margin: 0 0 1em 0; text-align: justify; text-indent: 1.5em; }
        p:first-of-type, h2+p, h3+p, h4+p { text-indent: 0; }
    </style>`;
    
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    let content = text.split('\n').map(line => {
        if (line.startsWith('## ')) return `<h2>${escape(line.substring(3))}</h2>`;
        if (line.startsWith('### ')) return `<h3>${escape(line.substring(4))}</h3>`;
        if (line.startsWith('#### ')) return `<h4>${escape(line.substring(5))}</h4>`;
        return line.trim() ? `<p>${escape(line)}</p>` : '';
    }).join('');
    
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">${kdpStyles}</head><body>${content}</body></html>`;
  };

  const handleConvertToDocx = async () => {
    if (!manuscriptText) return;
    setIsConverting('docx');
    try {
      const htmlContent = getFullManuscriptAsHTML(manuscriptText);
      const fileBuffer = await htmlToDocx.asBlob(htmlContent);
      const url = URL.createObjectURL(fileBuffer);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.projectTitle || 'manuscript'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      showToast('Error during DOCX conversion.', 'error');
    } finally {
      setIsConverting(null);
    }
  };

  const handleConvertToPdf = async () => {
    if (!manuscriptText) return;
    setIsConverting('pdf');
    try {
        const { jsPDF } = jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');
        const htmlContent = getFullManuscriptAsHTML(manuscriptText);

        const container = document.createElement('div');
        // Add a title page to the container
        const titlePage = `<div style="text-align: center; height: 842pt; display: flex; flex-direction: column; justify-content: center; page-break-after: always;">
            <h1 style="font-size: 24pt;">${project?.bookTitle || ''}</h1>
            <p style="font-size: 18pt; font-style: italic;">${project?.subtitle || ''}</p>
            <p style="font-size: 14pt; margin-top: 3em;">${project?.author || ''}</p>
        </div>`;
        container.innerHTML = titlePage + htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];

        // Basic styling for rendering
        container.style.width = '210mm'; // A4 width
        container.style.fontFamily = 'Times New Roman, serif';
        document.body.appendChild(container);

        await pdf.html(container, {
            callback: function(doc) {
                doc.save(`${project?.projectTitle || 'manuscript'}.pdf`);
                document.body.removeChild(container);
            },
            margin: [40, 40, 40, 40],
            autoPaging: 'text',
            width: 595, // A4 width in points
            windowWidth: 595
        });

    } catch (e) {
        console.error(e);
        showToast('Error during PDF conversion.', 'error');
    } finally {
        setIsConverting(null);
    }
  };

  const handleConvertToOdt = () => {
    showToast(t('conversionTab.odtInfo'), 'success');
  };

  if (!manuscriptText) {
    return (
      <Card>
        <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('conversionTab.title')}</h2>
        <div className="text-center p-8 bg-neutral-light rounded-lg border-2 border-dashed">
            <h3 className="text-lg font-semibold text-neutral-dark">{t('conversionTab.sourceNotAvailable')}</h3>
        </div>
      </Card>
    );
  }

  const ConversionButton: React.FC<{ format: string; icon: React.ReactNode; onClick: () => void; }> = ({ format, icon, onClick }) => (
    <button
        onClick={onClick}
        disabled={!!isConverting}
        className="relative flex flex-col items-center justify-center gap-2 p-6 border-2 rounded-lg text-center transition-all duration-200 hover:border-brand-primary hover:shadow-lg bg-white disabled:opacity-50 disabled:cursor-wait"
    >
        {icon}
        <span className="font-bold text-brand-dark">{format.toUpperCase()}</span>
        <span className="text-sm text-neutral-medium">{t('conversionTab.convertTo', { format: format.toUpperCase() })}</span>
        {isConverting === format.toLowerCase() && <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg"><LoadingSpinner className="h-8 w-8 text-brand-primary"/></div>}
    </button>
  );

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('conversionTab.title')}</h2>
      <p className="text-neutral-medium mb-8">{t('conversionTab.description')}</p>

      <div className="mb-8 p-4 border rounded-lg bg-neutral-light/50">
        <h3 className="text-lg font-semibold text-brand-dark mb-2">{t('conversionTab.sourceTitle')}</h3>
        <p className="text-sm text-neutral-dark">{t('conversionTab.sourceDescription')}</p>
        <p className="mt-2 font-mono text-sm bg-white p-2 rounded border">{t('conversionTab.wordCount', { count: countWords(manuscriptText) })}</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-brand-dark mb-4">{t('conversionTab.outputTitle')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <ConversionButton format="DOCX" icon={<DocxIcon />} onClick={handleConvertToDocx} />
            <ConversionButton format="PDF" icon={<PdfIcon />} onClick={handleConvertToPdf} />
            <ConversionButton format="ODT" icon={<OdtIcon />} onClick={handleConvertToOdt} />
        </div>
      </div>
    </Card>
  );
};

export default ConversionTab;
