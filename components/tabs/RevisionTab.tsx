import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { analyzeManuscript } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';

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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            const errorMessage = err.toString().toLowerCase();
            if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
                setError(t('apiErrors.rateLimit'));
            } else {
                setError(t('apiErrors.generic'));
            }
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const hasAnalysis = project?.manuscript?.analysis;

    return (
        <Card>
            <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('revisionTab.title')}</h2>
            
            {!hasAnalysis && !isLoading && (
                <div className="animate-fade-in">
                    <p className="text-neutral-medium mb-4">{t('revisionTab.description')}</p>
                    <p className="text-sm text-neutral-medium p-3 bg-neutral-light border rounded-md mb-4">{t('revisionTab.fileUploadNote')}</p>
                    <textarea
                        value={manuscriptText}
                        onChange={(e) => setManuscriptText(e.target.value)}
                        placeholder={t('revisionTab.pastePlaceholder')}
                        className="w-full h-80 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none font-mono text-sm"
                        disabled={isLoading}
                    />
                    <div className="mt-4 text-center">
                        <button
                            onClick={handleAnalyze}
                            disabled={!manuscriptText.trim() || isLoading}
                            className="flex items-center justify-center mx-auto bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
                        >
                            {t('revisionTab.analyzeButton')}
                        </button>
                    </div>
                </div>
            )}
            
            {isLoading && (
                 <div className="text-center py-16">
                    <LoadingSpinner className="h-12 w-12 text-brand-primary mx-auto" />
                    <p className="mt-4 text-neutral-medium font-semibold">{t('revisionTab.loading')}</p>
                </div>
            )}

            {error && <p className="text-center mt-6 text-red-600">{error}</p>}

            {hasAnalysis && !isLoading && (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-brand-dark">{t('revisionTab.resultsTitle')}</h3>
                        <button
                            onClick={() => {
                                updateProject({ manuscript: undefined });
                                setManuscriptText('');
                                setError(null);
                            }}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md text-sm transition-colors"
                        >
                           {t('revisionTab.startRevision')}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="p-4 border rounded-lg bg-neutral-light/50">
                            <h4 className="text-lg font-semibold text-neutral-dark mb-2">{t('revisionTab.originalTitle')}</h4>
                            <div className="text-sm max-h-[70vh] overflow-y-auto p-2 bg-white rounded border">
                                {project.manuscript?.text.split('\n').map((p, i) => <p className="mb-2" key={i}>{p || <span>&nbsp;</span>}</p>)}
                            </div>
                        </div>
                        <div className="p-4 border rounded-lg bg-white">
                             <h4 className="text-lg font-semibold text-neutral-dark mb-2">{t('revisionTab.feedbackTitle')}</h4>
                             <div className="text-neutral-dark max-h-[70vh] overflow-y-auto p-2">
                                <MarkdownRenderer content={project.manuscript!.analysis} />
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default RevisionTab;
