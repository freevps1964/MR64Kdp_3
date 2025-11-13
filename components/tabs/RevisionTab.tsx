import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { analyzeManuscript, regenerateManuscript, highlightManuscriptChanges, listManuscriptChanges } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';
import type { Project } from '../../types';
import { useToast } from '../../hooks/useToast';


declare const mammoth: any;
declare const pdfjsLib: any;

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
    const processLines = (text: string) => {
        const lines = text.split('\n');
        let html = '';
        let inList = false;
        for (const line of lines) {
            if (line.startsWith('### ')) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h3 class="text-xl font-semibold text-brand-dark mt-4 mb-2">${line.substring(4)}</h3>`;
            } else if (line.startsWith('* ') || line.startsWith('- ')) {
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
    const { showToast } = useToast();

    const [manuscriptText, setManuscriptText] = useState(project?.manuscript?.text || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState<string | null>(null);
    
    type RevisionAction = 'regenerate' | 'highlight' | 'list';
    const [revisionAction, setRevisionAction] = useState<RevisionAction>('regenerate');
    const [isApplying, setIsApplying] = useState(false);

    const [isLoadingDownload, setIsLoadingDownload] = useState(false);
    const [downloadFormat, setDownloadFormat] = useState<'txt' | 'html'>('html');

    const extractPdfText = async (data: ArrayBuffer): Promise<string> => {
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';
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
        updateProject({ manuscript: undefined });

        try {
            const arrayBuffer = await file.arrayBuffer();
            const text = file.type === 'application/pdf' ? await extractPdfText(arrayBuffer) : await extractDocxText(arrayBuffer);
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
                },
            });
        } catch (err: any) {
            setError(err.toString().toLowerCase().includes('429') ? t('apiErrors.rateLimit') : t('apiErrors.generic'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyRevision = async () => {
        const { text, analysis } = project?.manuscript || {};
        if (!text || !analysis) return;
        
        setIsApplying(true);
        setError(null);
        try {
            let result;
            let updates: Partial<Project['manuscript']> = {};

            switch (revisionAction) {
                case 'regenerate':
                    result = await regenerateManuscript(text, analysis);
                    updates = { regenerated: result, highlighted: undefined, changeList: undefined };
                    break;
                case 'highlight':
                    result = await highlightManuscriptChanges(text, analysis);
                    updates = { highlighted: result, regenerated: undefined, changeList: undefined };
                    break;
                case 'list':
                    result = await listManuscriptChanges(text, analysis);
                    updates = { changeList: result, regenerated: undefined, highlighted: undefined };
                    break;
            }
            updateProject({ manuscript: { ...project!.manuscript!, ...updates } });
        } catch (err) {
            setError(err.toString().toLowerCase().includes('429') ? t('apiErrors.rateLimit') : t('apiErrors.generic'));
        } finally {
            setIsApplying(false);
        }
    };

    const createHtmlForExport = (text: string): string => {
        const kdpStyles = `<style>
            /* General Body Style */
            body { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 1em; /* Using em for scalability */
                line-height: 1.5; 
            }
            /* Chapter Title */
            h2 { 
                font-weight: 700; 
                font-size: 1.6em; 
                text-align: center; 
                margin-top: 2em; 
                margin-bottom: 1.5em; 
                page-break-before: always; /* Start new chapters on a new page */
            }
            /* Subchapter Title */
            h3 { 
                font-weight: 700; 
                font-size: 1.4em; 
                margin-top: 1.5em; 
                margin-bottom: 1em; 
            }
            /* Sub-subchapter Title */
            h4 { 
                font-weight: 700; 
                font-size: 1.2em; 
                font-style: italic; 
                margin-top: 1.2em; 
                margin-bottom: 0.8em; 
            }
            /* Paragraphs */
            p { 
                margin: 0 0 1em 0; 
                text-align: justify; 
                text-indent: 1.5em; /* Standard indentation */
            }
            /* Remove indentation for first paragraph after any heading */
            p:first-of-type, h2+p, h3+p, h4+p { 
                text-indent: 0; 
            }
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

    const handleDownload = async () => {
        const manuscript = project?.manuscript;
        const textToDownload = manuscript?.regenerated;

        if (!textToDownload) return;
        
        setIsLoadingDownload(true);
        setError(null);
        try {
            if (downloadFormat === 'txt') {
                const blob = new Blob([textToDownload.replace(/^#+\s/gm, '')], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project?.projectTitle || 'manuscript'}.txt`;
                a.click();
                URL.revokeObjectURL(url);

            } else if (downloadFormat === 'html') {
                const htmlContent = createHtmlForExport(textToDownload);
                const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project?.projectTitle || 'manuscript'}.html`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch(err: any) {
            const libName = err.message || 'required library';
            const errorMessage = t('revisionTab.libraryLoadError', { libs: libName });
            setError(errorMessage);
            showToast(errorMessage, 'error');
        } finally {
            setIsLoadingDownload(false);
        }
    };

    const handleReset = () => {
        updateProject({ manuscript: undefined });
        setManuscriptText('');
        setFileName('');
        setError(null);
    };

    const manuscript = project?.manuscript;
    const hasAnalysis = !!manuscript?.analysis;
    const hasExtractedText = manuscriptText.trim() !== '';

    const renderInitialView = () => (
        <div className="animate-fade-in">
            <p className="text-neutral-medium mb-6">{t('revisionTab.description')}</p>
            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="text-center">
                    <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">{t('revisionTab.uploadPrompt')}</span></p>
                    <p className="text-xs text-gray-500">{t('revisionTab.acceptedFiles')}</p>
                </div>
                <input id="dropzone-file" type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.docx"/>
            </label>
        </div>
    );
    
    const renderPreview = () => (
        <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-green-700">{t('revisionTab.textExtracted')}</h4>
                <p className="text-sm text-gray-500 font-mono">{fileName}</p>
            </div>
            <div className="h-80 p-3 border rounded-md bg-neutral-light/50 overflow-y-auto text-sm">
                {manuscriptText.split('\n').map((line, i) => <p key={i}>{line || <br/>}</p>)}
            </div>
            <div className="mt-4 flex gap-4 justify-center">
                <button onClick={handleAnalyze} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md">
                    {t('revisionTab.analyzeButton')}
                </button>
                 <button onClick={handleReset} className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md">
                   {t('revisionTab.uploadDifferentFile')}
                </button>
            </div>
        </div>
    );

    const renderAnalysis = () => (
        <div className="animate-fade-in space-y-8">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-brand-dark">{t('revisionTab.resultsTitle')}</h3>
                <button onClick={handleReset} className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-md">
                    {t('revisionTab.startRevision')}
                </button>
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 border rounded-lg bg-neutral-light/50"><h4 className="text-lg font-semibold mb-2">{t('revisionTab.originalTitle')}</h4><div className="text-sm max-h-[60vh] overflow-y-auto p-2 bg-white rounded border">{manuscript?.text.split('\n').map((p, i) => <p className="mb-2" key={i}>{p||<>&nbsp;</>}</p>)}</div></div>
                <div className="p-4 border rounded-lg bg-white"><h4 className="text-lg font-semibold mb-2">{t('revisionTab.feedbackTitle')}</h4><div className="max-h-[60vh] overflow-y-auto p-2"><MarkdownRenderer content={manuscript!.analysis} /></div></div>
            </div>
            <div className="p-4 border-2 border-brand-light rounded-lg bg-brand-light/10">
                 <h4 className="text-lg font-semibold text-brand-dark mb-4">{t('revisionTab.applyRevisionsTitle')}</h4>
                 <div className="flex flex-col lg:flex-row items-start gap-6">
                    <div className="flex-grow space-y-3">
                        {([
                            { id: 'regenerate', label: t('revisionTab.actionRegenerate'), description: t('revisionTab.actionRegenerateDescription') },
                            { id: 'highlight', label: t('revisionTab.actionHighlight'), description: t('revisionTab.actionHighlightDescription') },
                            { id: 'list', label: t('revisionTab.actionList'), description: t('revisionTab.actionListDescription') },
                        ] as const).map(action => (
                            <label key={action.id} className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 transition-colors ${revisionAction === action.id ? 'bg-brand-light/10 border-brand-light' : 'border-transparent hover:bg-gray-100'}`}>
                                <input
                                    type="radio"
                                    name="revAction"
                                    value={action.id}
                                    checked={revisionAction === action.id}
                                    onChange={() => setRevisionAction(action.id)}
                                    className="form-radio text-brand-primary mt-1 h-5 w-5"
                                />
                                <div>
                                    <span className="font-semibold text-brand-dark">{action.label}</span>
                                    <p className="text-sm text-neutral-medium">{action.description}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                    <div className="flex-shrink-0 lg:mt-4">
                        <button
                            onClick={handleApplyRevision}
                            disabled={isApplying}
                            className="flex items-center bg-brand-accent hover:bg-yellow-500 text-brand-dark font-bold py-3 px-8 rounded-lg shadow-md disabled:bg-neutral-medium"
                        >
                            {isApplying ? <LoadingSpinner className="text-brand-dark"/> : '✨'}
                            <span className="ml-2">{t('revisionTab.applyButton')}</span>
                        </button>
                    </div>
                </div>
                 {isApplying && <p className="text-center mt-3 text-sm">{t('revisionTab.applying')}</p>}
            </div>
            {(manuscript?.regenerated || manuscript?.highlighted || manuscript?.changeList) && (
                <div className="animate-fade-in">
                    {manuscript.regenerated && 
                        <div className="p-4 border-2 border-green-300 rounded-lg bg-green-50">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-lg font-semibold text-green-800">{t('revisionTab.regeneratedTitle')}</h4>
                                <div className="flex items-center gap-2">
                                    <select value={downloadFormat} onChange={e=>setDownloadFormat(e.target.value as any)} className="bg-white border rounded-md p-2" disabled={isLoadingDownload}>
                                        <option value="html">HTML (.html)</option>
                                        <option value="txt">Testo (.txt)</option>
                                    </select>
                                    <button onClick={handleDownload} disabled={isLoadingDownload} className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md">
                                        {isLoadingDownload ? <LoadingSpinner/> : '🚀'}
                                        <span className="ml-2">{t('revisionTab.downloadButton')}</span>
                                    </button>
                                </div>
                            </div>
                            <div className="text-sm max-h-[70vh] overflow-y-auto p-2 bg-white rounded border">{manuscript.regenerated.split('\n').map((p,i)=><p className="mb-2" key={i}>{p||<>&nbsp;</>}</p>)}</div>
                        </div>
                    }
                    {manuscript.highlighted && <div className="p-4 border-2 border-blue-300 rounded-lg bg-blue-50"><h4 className="text-lg font-semibold text-blue-800 mb-2">{t('revisionTab.highlightedTitle')}</h4><div className="text-sm max-h-[70vh] overflow-y-auto p-2 bg-white rounded border" dangerouslySetInnerHTML={{__html:manuscript.highlighted.replace(/\n/g,'<br/>')}}></div></div>}
                    {manuscript.changeList && <div className="p-4 border-2 border-purple-300 rounded-lg bg-purple-50"><h4 className="text-lg font-semibold text-purple-800 mb-2">{t('revisionTab.changeListTitle')}</h4><div className="text-sm max-h-[70vh] overflow-y-auto p-2 bg-white rounded border"><MarkdownRenderer content={manuscript.changeList}/></div></div>}
                </div>
            )}
        </div>
    );

    const renderLoading = (text: string) => <div className="text-center py-16"><LoadingSpinner className="h-12 w-12 text-brand-primary mx-auto"/><p className="mt-4 font-semibold">{text}</p>{fileName&&<p className="text-sm">{fileName}</p>}</div>;

    return (
        <Card>
            <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('revisionTab.title')}</h2>
            {error && <p className="my-4 p-3 text-red-700 bg-red-100 rounded-md">{error}</p>}
            {isParsing ? renderLoading(t('revisionTab.parsingFile')) :
             isLoading ? renderLoading(t('revisionTab.loading')) :
             hasAnalysis ? renderAnalysis() :
             hasExtractedText ? renderPreview() :
             renderInitialView()}
        </Card>
    );
};

export default RevisionTab;
