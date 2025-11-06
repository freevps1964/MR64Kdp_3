import React, { useState, useEffect, useRef } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { researchTopic } from '../../services/geminiService';
import LoadingSpinner from '../icons/LoadingSpinner';
import Card from '../common/Card';
import type { GroundingSource } from '../../types';

const StatCard: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div>
    <p className="text-2xl sm:text-3xl font-bold text-brand-primary">{value}</p>
    <p className="text-xs sm:text-sm text-neutral-medium">{label}</p>
  </div>
);

const ResearchTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('Italy');
  const topicInputRef = useRef<HTMLInputElement>(null);
  
  const markets = ['Italy', 'USA', 'UK', 'Germany', 'France', 'Spain', 'Canada', 'Japan'];

  useEffect(() => {
    if (project?.topic) {
      setTopic(project.topic);
    }
  }, [project?.topic]);

  const handleResearch = async (e?: React.FormEvent, researchTopicOverride?: string) => {
    if (e) e.preventDefault();
    const currentTopic = researchTopicOverride || topic;
    if (!currentTopic.trim()) return;

    setIsLoading(true);
    setError(null);
    updateProject({ researchData: null, topic: currentTopic.trim() });

    try {
      const { result } = await researchTopic(currentTopic.trim(), selectedMarket);
      if (result) {
        result.titles.sort((a, b) => b.relevance - a.relevance);
        result.subtitles.sort((a, b) => b.relevance - a.relevance);
        result.keywords.sort((a, b) => b.relevance - a.relevance);
        
        const allValidSources = result.sources;

        updateProject({
           researchData: result,
           selectedSources: allValidSources,
        });
      } else {
        throw new Error('No data returned from research.');
      }
    } catch (err: any) {
      const errorMessage = err.toString().toLowerCase();
      if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
        setError(t('apiErrors.rateLimit'));
      } else if (errorMessage.includes('400') || errorMessage.includes('invalid argument')) {
        setError(t('apiErrors.invalidInput'));
      } else {
        setError(t('apiErrors.generic'));
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If a topic is set from another tab (like Market Trends) and research is needed,
    // and we aren't already loading, start the research automatically.
    if (project?.topic && project.researchData === null && !isLoading) {
      handleResearch(undefined, project.topic);
    }
  }, [project?.topic, project?.researchData]);

  const handleSourceSelectionChange = (source: GroundingSource, isSelected: boolean) => {
    const currentSelected = project?.selectedSources || [];
    let newSelected;
    if (isSelected) {
      newSelected = [...currentSelected, source];
    } else {
      newSelected = currentSelected.filter(s => s.web?.uri !== source.web?.uri);
    }
    updateProject({ selectedSources: newSelected });
  };

  const allSources = project?.researchData?.sources?.filter(s => s.web?.uri) || [];
  const selectedSourcesUris = new Set(project?.selectedSources?.map(s => s.web?.uri));
  const areAllSelected = allSources.length > 0 && allSources.every(s => selectedSourcesUris.has(s.web?.uri));

  const handleSelectAllSources = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    const allAvailableSources = project?.researchData?.sources?.filter(s => s.web?.uri) || [];
    if (isChecked) {
        updateProject({ selectedSources: allAvailableSources });
    } else {
        updateProject({ selectedSources: [] });
    }
  };

  const getPillClasses = (type: 'volume' | 'competition', value: string) => {
    const lowerValue = (value || '').toLowerCase();
    let baseClasses = 'px-2 py-0.5 text-xs font-bold rounded-full w-16 text-center';
    
    if (type === 'volume') {
        if (lowerValue.includes('high') || lowerValue.includes('alto')) return `${baseClasses} bg-green-100 text-green-800`;
        if (lowerValue.includes('medium') || lowerValue.includes('medio')) return `${baseClasses} bg-yellow-100 text-yellow-800`;
        if (lowerValue.includes('low') || lowerValue.includes('basso')) return `${baseClasses} bg-red-100 text-red-800`;
    }
    
    if (type === 'competition') {
        if (lowerValue.includes('high') || lowerValue.includes('alta')) return `${baseClasses} bg-red-100 text-red-800`;
        if (lowerValue.includes('medium') || lowerValue.includes('media')) return `${baseClasses} bg-yellow-100 text-yellow-800`;
        if (lowerValue.includes('low') || lowerValue.includes('bassa')) return `${baseClasses} bg-green-100 text-green-800`;
    }
    
    return `${baseClasses} bg-gray-100 text-gray-800`; // for 'N/A' or unknown
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('researchTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('researchTab.description')}
      </p>
      <form onSubmit={handleResearch}>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-grow">
              <label htmlFor="topic-input" className="sr-only">{t('researchTab.placeholder')}</label>
              <input
                ref={topicInputRef}
                id="topic-input"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t('researchTab.placeholder')}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none"
                aria-label="Book topic"
              />
          </div>
          <div className="w-full sm:w-auto">
              <label htmlFor="market-select-research" className="block text-sm font-medium text-gray-700 mb-1">{t('researchTab.selectMarketLabel')}</label>
              <select
                  id="market-select-research"
                  value={selectedMarket}
                  onChange={(e) => setSelectedMarket(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none bg-white"
                  disabled={isLoading}
              >
                  {markets.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
          </div>
          <button
            type="submit"
            disabled={isLoading || !topic.trim()}
            className="w-full sm:w-auto flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
          >
            {isLoading ? <LoadingSpinner /> : t('researchTab.button')}
          </button>
        </div>
      </form>

      {isLoading && <p className="text-center mt-6 text-neutral-medium">{t('researchTab.loading')}</p>}
      {error && <p className="text-center mt-6 text-red-600">{error}</p>}

      {project?.researchData && (
        <div className="mt-8 space-y-8 animate-fade-in">

          <div>
            <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.summaryTitle')}</h3>
            <div className="p-4 bg-neutral-light/70 rounded-lg border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <StatCard value={project.researchData.titles.length} label={t('researchTab.summaryTitles')} />
                    <StatCard value={project.researchData.subtitles.length} label={t('researchTab.summarySubtitles')} />
                    <StatCard value={project.researchData.keywords.length} label={t('researchTab.summaryKeywords')} />
                    <StatCard value={project.researchData.sources?.length || 0} label={t('researchTab.summarySources')} />
                </div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.marketSummary')}</h3>
            <p className="text-neutral-dark bg-neutral-light p-4 rounded-md">{project.researchData.marketSummary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.suggestedTitles')}</h3>
              <div className="space-y-2">
                {project.researchData.titles.map((item, index) => (
                    <button key={index} onClick={() => updateProject({ bookTitle: item.title })} className={`w-full text-left p-3 rounded-md transition-colors flex justify-between items-center ${project.bookTitle === item.title ? 'bg-brand-accent/30 ring-2 ring-brand-accent' : 'bg-neutral-light hover:bg-gray-200'}`}>
                        <span>{item.title}</span>
                        <span className="text-xs font-bold text-brand-primary bg-blue-100 px-2 py-1 rounded-full">{item.relevance}%</span>
                    </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.suggestedSubtitles')}</h3>
               <div className="space-y-2">
                {project.researchData.subtitles.map((item, index) => (
                    <button key={index} onClick={() => updateProject({ subtitle: item.subtitle })} className={`w-full text-left p-3 rounded-md transition-colors flex justify-between items-center ${project.subtitle === item.subtitle ? 'bg-brand-accent/30 ring-2 ring-brand-accent' : 'bg-neutral-light hover:bg-gray-200'}`}>
                        <span>{item.subtitle}</span>
                        <span className="text-xs font-bold text-brand-primary bg-blue-100 px-2 py-1 rounded-full">{item.relevance}%</span>
                    </button>
                ))}
              </div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xl font-semibold text-brand-dark">{t('researchTab.kdpKeywords')}</h3>
              <div className="hidden sm:flex items-center gap-4 text-xs text-neutral-medium">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500"></span><span>{t('researchTab.good')}</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500"></span><span>{t('researchTab.medium')}</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500"></span><span>{t('researchTab.difficult')}</span></div>
              </div>
            </div>
            <div className="space-y-3">
              {project.researchData.keywords.map((item, index) => (
                <div key={index} className="p-3 bg-neutral-light/70 rounded-md border flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-6">
                  <div className="font-semibold text-brand-dark flex-grow">{item.keyword}</div>
                  <div className="flex items-center justify-end gap-6 text-sm flex-shrink-0">
                      <div className="flex flex-col items-center">
                          <span className="text-xs text-neutral-medium">{t('researchTab.relevance')}</span>
                          <span className="font-bold text-lg text-brand-primary">{item.relevance}%</span>
                      </div>
                      <div className="flex flex-col items-center">
                          <span className="text-xs text-neutral-medium">{t('researchTab.searchVolume')}</span>
                          <span className={getPillClasses('volume', item.searchVolume)}>{item.searchVolume || 'N/A'}</span>
                      </div>
                      <div className="flex flex-col items-center">
                          <span className="text-xs text-neutral-medium">{t('researchTab.competition')}</span>
                          <span className={getPillClasses('competition', item.competition)}>{item.competition || 'N/A'}</span>
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.sources')}</h3>
             {allSources.length > 0 && (
                <div className="flex items-center gap-3 p-2 mb-2 border-b">
                    <input 
                        type="checkbox" 
                        id="select-all-sources"
                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-light"
                        checked={areAllSelected}
                        onChange={handleSelectAllSources}
                    />
                    <label htmlFor="select-all-sources" className="text-sm font-semibold cursor-pointer">
                        {t('researchTab.selectAllSources')}
                    </label>
                </div>
            )}
             <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {project.researchData.sources?.map((source, index) => (
                    source.web?.uri && (
                        <div key={index} className="flex items-start gap-3 p-2 bg-neutral-light rounded-md">
                            <input 
                                type="checkbox" 
                                id={`source-${index}`}
                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-light mt-1"
                                checked={project.selectedSources?.some(s => s.web?.uri === source.web?.uri)}
                                onChange={(e) => handleSourceSelectionChange(source, e.target.checked)}
                            />
                            <label htmlFor={`source-${index}`} className="text-sm flex-grow">
                                <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-brand-secondary hover:underline">
                                    {source.web.title || source.web.uri}
                                </a>
                            </label>
                            {source.relevance !== undefined && (
                                <span className="text-xs font-bold text-brand-primary bg-blue-100 px-2 py-1 rounded-full flex-shrink-0">{source.relevance}%</span>
                            )}
                        </div>
                    )
                ))}
            </div>
          </div>

        </div>
      )}
    </Card>
  );
};

export default ResearchTab;
