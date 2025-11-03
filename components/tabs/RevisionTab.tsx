import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { analyzeManuscript, regenerateManuscript } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';

declare const mammoth: any;
declare const pdfjsLib: any;
declare const htmlToDocx: any;

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const processLines = (text: string) => {
        const lines = text.split('\n');
        let html = '';
        let inList = false;
        for (const line of lines) {
            if (line.startsWith('### ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h3 class="text-xl font-semibold text-brand-dark mt-4 mb-2">${line.substring(4)}</h3>`;
            } else if (line.startsWith('* ')) {
                if (!inList) { html += '<ul>'; inList = true; }
                html += `<li class="ml-5 list-disc">${line.substring(2)}</li>`;
            } else if (line.trim() === '---') {
                 if (inList) { html += '</ul>'; inList = false; }
                 html += '<hr class="my-4"/>';
            } else if (line.trim() === '') {
                if (inList) { html += '</ul>'; inList = false; }
                html += '<br />';
            } else {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<p>${line}</p>`;
            }
        }
        if (inList) { html += '</ul>'; }
        return html;
    };
    
    return <div className="space-y-2 text-neutral-dark" dangerouslySetInnerHTML={{ __html: processLines(content) }} />;
};

const RevisionTab: React.FC = () => {
    const { t } = useLocalization();
    const { project, updateProject } = useProject();

    const [manuscriptText, setManuscriptText] = useState(project?.manuscript?.text || '');
    const [regeneratedText, setRegeneratedText] = useState(project?.manuscript?.regenerated || '');
    const [isLoading, setIsLoading] = useState(false); // For Gemini analysis
    const [isParsing, setIsParsing] = useState(false); // For file text extraction
    const [isLoadingAction, setIsLoadingAction] = useState<'regenerating' | 'downloading' | null>(null);
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const extractPdfText = async (data: ArrayBuffer): Promise<string> => {
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        return fullText;
    };

    const extractDocxText = async (data: ArrayBuffer): Promise<string> => {
        const result = await mammoth.extractRawText({ arrayBuffer: data });
        return result.value.replace(/\n\n/g, '\n');
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        setFileName(file.name);
        setError(null);
        setManuscriptText('');
        setRegeneratedText('');

        try {
            const arrayBuffer = await file.arrayBuffer();
            let text = '';
            if (file.type === 'application/pdf') {
                text = await extractPdfText(arrayBuffer);
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
                text = await extractDocxText(arrayBuffer);
            } else {
                throw new Error('Unsupported file type.');
            }
            setManuscriptText(text);
        } catch (err) {
            console.error(err);
            setError(t('revisionTab.fileError'));
            setFileName('');
        } finally {
            setIsParsing(false);
        }
    };

    const handleAnalyze = async () => {
        if (!manuscriptText.trim()) return;
        setIsLoading(true);
        setError(null);
        try {
            const analysisResult = await analyzeManuscript(manuscriptText);
            updateProject({
                manuscript: {
                    text: manuscriptText,
                    analysis: analysisResult,
                    regenerated: '',
                },
            });
            setRegeneratedText(''); // Clear any previous regenerated text
        } catch (err: any) {
            const errorMessage = err.toString().toLowerCase();
            if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
                setError(t('apiErrors.rateLimit'));
            } else {
                setError(t('apiErrors.generic'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegenerate = async () => {
        if (!project?.manuscript?.text || !project.manuscript.analysis) return;
        
        setIsLoadingAction('regenerating');
        setError(null);
        
        try {
            const result = await regenerateManuscript(project.manuscript.text, project.manuscript.analysis);
            setRegeneratedText(result);
            updateProject({
                manuscript: {
                    ...project.manuscript,
                    regenerated: result,
                }
            });
        } catch (err) {
            const errorMessage = (err as Error).toString().toLowerCase();
            if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
                setError(t('apiErrors.rateLimit'));
            } else {
                setError(t('apiErrors.generic'));
            }
        } finally {
            setIsLoadingAction(null);
        }
    };
    
    const createHtmlForDocx = (text: string): string => {
        const kdpStyles = `
            <style>
                @page {
                    size: 6in 9in;
                    margin: 0.5in;
                }
                body {
                    font-family: 'Georgia', serif;
                    font-size: 14pt;
                    line-height: 1.5;
                }
                h2 {
                    font-size: 18pt;
                    font-weight: bold;
                    text-align: center;
                    margin-top: 2em;
                    margin-bottom: 1.5em;
                    page-break-before: always;
                }
                p {
                    text-indent: 0.5in;
                    margin-bottom: 0;
                    margin-top: 0;
                    text-align: justify;
                }
                h2 + p, body > p:first-of-type {
                    text-indent: 0;
                }
            </style>
        `;

        const escapeHtml = (unsafe: string): string => {
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        };

        const lines = text.split('\n');
        let contentHtml = '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('## ')) {
                const title = trimmedLine.substring(3).trim();
                contentHtml += `<h2>${escapeHtml(title)}</h2>`;
            } else if (trimmedLine) {
                contentHtml += `<p>${escapeHtml(trimmedLine)}</p>`;
            }
        }
        
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${kdpStyles}</head><body>${contentHtml}</body></html>`;
    };

    const handleDownload = async () => {
        if (!regeneratedText) return;
        
        setIsLoadingAction('downloading');
        setError(null);
        
        try {
            const htmlContent = createHtmlForDocx(regeneratedText);
            const fileBuffer = await htmlToDocx.asBlob(htmlContent, { orientation: 'portrait' });
            
            const url = URL.createObjectURL(fileBuffer);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${project?.projectTitle || 'manoscritto'}-revisionato.docx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
        } catch (err) {
            console.error("Error creating DOCX file:", err);
            setError(t('apiErrors.generic'));
        } finally {
            setIsLoadingAction(null);
        }
    };
    
    const handleReset = () => {
        updateProject({ manuscript: undefined });
        setManuscriptText('');
        setFileName('');
        setError(null);
        setRegeneratedText('');
    };

    const hasAnalysis = project?.manuscript?.analysis;
    const hasExtractedText = manuscriptText.trim() !== '';
    const hasRegeneratedText = regeneratedText.trim() !== '';

    const renderInitialView = () => (
        <div className="animate-fade-in">
            <p className="text-neutral-medium mb-6">{t('revisionTab.description')}</p>
            <div className="flex items-center justify-center w-full">
                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h2a4 4 0 014 4v5a4 4 0 01-4 4H7z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9l-3 3m0 0l3 3m-3-3h12"></path></svg>
                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">{t('revisionTab.uploadPrompt')}</span></p>
                        <p className="text-xs text-gray-500">{t('revisionTab.acceptedFiles')}</p>
                    </div>
                    <input id="dropzone-file" type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
                </label>
            </div>
        </div>
    );

    const renderParsingView = () => (
        <div className="text-center py-16">
            <LoadingSpinner className="h-12 w-12 text-brand-primary mx-auto" />
            <p className="mt-4 text-neutral-medium font-semibold">{t('revisionTab.parsingFile')}</p>
            <p className="text-sm text-neutral-medium">{fileName}</p>
        </div>
    );

    const renderPreviewView = () => (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-green-700">{t('revisionTab.textExtracted')}</h4>
                <p className="text-sm text-gray-500 font-mono">{fileName}</p>
            </div>
            <div className="w-full h-80 p-3 border border-gray-300 rounded-md bg-neutral-light/50 overflow-y-auto font-sans text-sm">
                {manuscriptText.split('\n').map((line, i) => <p key={i}>{line || <br/>}</p>)}
            </div>
            <div className="mt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
                <button
                    onClick={handleAnalyze}
                    className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md transition-colors shadow"
                >
                    {t('revisionTab.analyzeButton')}
                </button>
                 <button
                    onClick={handleReset}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md text-sm transition-colors"
                >
                   {t('revisionTab.uploadDifferentFile')}
                </button>
            </div>
        </div>
    );

    const renderAnalysisView = () => (
        <div className="animate-fade-in">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                <h3 className="text-xl font-bold text-brand-dark">{t('revisionTab.resultsTitle')}</h3>
                <div className="flex items-center gap-4">
                    <button onClick={handleReset} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md text-sm transition-colors">
                        {t('revisionTab.startRevision')}
                    </button>
                     <button 
                        onClick={handleRegenerate}
                        disabled={isLoadingAction === 'regenerating'}
                        className="flex items-center justify-center bg-brand-accent hover:bg-yellow-500 text-brand-dark font-bold py-2 px-4 rounded-md transition-colors shadow-md disabled:bg-neutral-medium"
                    >
                        {isLoadingAction === 'regenerating' ? <LoadingSpinner className="text-brand-dark" /> : '✨'}
                        <span className="ml-2">{hasRegeneratedText ? t('revisionTab.regenerateAgain') : t('revisionTab.regenerateAndDownload')}</span>
                    </button>
                    {hasRegeneratedText && (
                        <button 
                            onClick={handleDownload}
                            disabled={isLoadingAction === 'downloading'}
                            className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors shadow-md disabled:bg-neutral-medium"
                        >
                            {isLoadingAction === 'downloading' ? <LoadingSpinner /> : '🚀'}
                            <span className="ml-2">{t('revisionTab.downloadButton')}</span>
                        </button>
                    )}
                </div>
            </div>
            {isLoadingAction === 'regenerating' && (
                 <div className="text-center my-4 p-3 text-blue-700 bg-blue-100 rounded-md">
                    <p className="font-semibold">{t('revisionTab.regenerating')}</p>
                 </div>
            )}
            <div className={`grid grid-cols-1 ${hasRegeneratedText ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
                <div className="p-4 border rounded-lg bg-neutral-light/50">
                    <h4 className="text-lg font-semibold text-neutral-dark mb-2">{t('revisionTab.originalTitle')}</h4>
                    <div className="text-sm max-h-[70vh] overflow-y-auto p-2 bg-white rounded border">
                        {project?.manuscript?.text.split('\n').map((p, i) => <p className="mb-2" key={i}>{p || <span>&nbsp;</span>}</p>)}
                    </div>
                </div>
                <div className="p-4 border rounded-lg bg-white">
                     <h4 className="text-lg font-semibold text-neutral-dark mb-2">{t('revisionTab.feedbackTitle')}</h4>
                     <div className="text-neutral-dark max-h-[70vh] overflow-y-auto p-2">
                        <MarkdownRenderer content={project!.manuscript!.analysis} />
                     </div>
                </div>
                 {hasRegeneratedText && (
                    <div className="p-4 border-2 border-green-300 rounded-lg bg-green-50 animate-fade-in">
                        <h4 className="text-lg font-semibold text-green-800 mb-2">{t('revisionTab.regeneratedTitle')}</h4>
                        <div className="text-sm max-h-[70vh] overflow-y-auto p-2 bg-white rounded border">
                             {regeneratedText.split('\n').map((p, i) => <p className="mb-2" key={i}>{p || <span>&nbsp;</span>}</p>)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
    
    const renderLoadingView = () => (
        <div className="text-center py-16">
            <LoadingSpinner className="h-12 w-12 text-brand-primary mx-auto" />
            <p className="mt-4 text-neutral-medium font-semibold">{t('revisionTab.loading')}</p>
        </div>
    );


    return (
        <Card>
            <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('revisionTab.title')}</h2>
            
            {error && <p className="text-center my-4 p-3 text-red-700 bg-red-100 rounded-md">{error}</p>}
            
            {isLoading ? renderLoadingView() :
             hasAnalysis ? renderAnalysisView() :
             isParsing ? renderParsingView() :
             hasExtractedText ? renderPreviewView() :
             renderInitialView()
            }
        </Card>
    );
};

export default RevisionTab;