import React, { useState, useEffect, useRef } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { researchTopic, discoverTrends, fetchAmazonCategories } from '../../services/geminiService';
import LoadingSpinner from '../icons/LoadingSpinner';
import Card from '../common/Card';
import type { GroundingSource, Trend } from '../../types';

const StatCard: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div>
    <p className="text-2xl sm:text-3xl font-bold text-brand-primary">{value}</p>
    <p className="text-xs sm:text-sm text-neutral-medium">{label}</p>
  </div>
);

const ResearchTab: React.FC = () => {
  const { t, locale } = useLocalization();
  const { project, updateProject } = useProject();
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for trends
  const [isDiscoveringTrends, setIsDiscoveringTrends] = useState(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [trendsResult, setTrendsResult] = useState<{ trends: Trend[], sources: GroundingSource[] } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedMarket, setSelectedMarket] = useState<string>('Italy');
  
  const [amazonCategories, setAmazonCategories] = useState<string[]>([]);
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);
  
  const topicInputRef = useRef<HTMLInputElement>(null);
  
  const markets = ['Italy', 'USA', 'UK', 'Germany', 'France', 'Spain', 'Canada', 'Japan'];
  const marketToDomain: { [key: string]: string } = {
      'Italy': 'amazon.it',
      'USA': 'amazon.com',
      'UK': 'amazon.co.uk',
      'Germany': 'amazon.de',
      'France': 'amazon.fr',
      'Spain': 'amazon.es',
      'Canada': 'amazon.ca',
      'Japan': 'amazon.co.jp',
  };
  const amazonDomain = marketToDomain[selectedMarket] || 'amazon.com';

  useEffect(() => {
    const loadCategories = async () => {
        if (!locale) return;
        setIsFetchingCategories(true);
        const cats = await fetchAmazonCategories(locale);
        setAmazonCategories([t('researchTab.allCategories'), ...cats]);
        setIsFetchingCategories(false);
    };
    loadCategories();
  }, [locale, t]);

  useEffect(() => {
    if (project?.topic) {
      setTopic(project.topic);
    }
  }, [project?.topic]);

  useEffect(() => {
    setSelectedCategory(t('researchTab.allCategories'));
  }, [t]);

  const handleResearch = async (e?: React.FormEvent, researchTopicOverride?: string) => {
    if (e) e.preventDefault();
    const currentTopic = researchTopicOverride || topic;
    if (!currentTopic.trim()) return;

    setIsLoading(true);
    setError(null);
    updateProject({ researchData: null, topic: currentTopic.trim() });

    // scroll to topic input
    topicInputRef.current?.scrollIntoView({ behavior: 'smooth' });

    try {
      const { result } = await researchTopic(currentTopic.trim(), selectedMarket);
      if (result) {
        // Sort results client-side as a fallback, as markdown parsing doesn't guarantee order
        result.titles.sort((a, b) => b.relevance - a.relevance);
        result.subtitles.sort((a, b) => b.relevance - a.relevance);
        result.keywords.sort((a, b) => b.relevance - a.relevance);
        
        // Pre-select sources with high relevance, but keep all sources in the main list
        const relevantSources = result.sources.filter(s => (s.relevance ?? 0) >= 60);

        updateProject({
           researchData: result,
           selectedSources: relevantSources,
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

  const handleDiscoverTrends = async () => {
    setIsDiscoveringTrends(true);
    setTrendsError(null);
    setTrendsResult(null);
    try {
      const { trends, sources } = await discoverTrends(selectedCategory, selectedMarket);
      if (trends) {
        // Sort trends by trendScore descending
        trends.sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0));
        setTrendsResult({ trends, sources });
      } else {
        throw new Error('No trends returned from analysis.');
      }
    } catch (err: any) {
      const errorMessage = err.toString().toLowerCase();
      if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
        setTrendsError(t('apiErrors.rateLimit'));
      } else if (errorMessage.includes('400') || errorMessage.includes('invalid argument')) {
        setTrendsError(t('apiErrors.invalidInput'));
      } else {
        setTrendsError(t('apiErrors.generic'));
      }
      console.error(err);
    } finally {
      setIsDiscoveringTrends(false);
    }
  };
  
  const handleSelectTrend = (trendTopic: string) => {
    setTopic(trendTopic);
    handleResearch(undefined, trendTopic);
  };


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

  return (
    <Card>
      {/* New Trend Research Section */}
      <div className="mb-12 p-6 border border-brand-light/50 rounded-lg bg-brand-light/10">
        <h3 className="text-xl font-bold text-brand-dark mb-3">{t('researchTab.trendsTitle')}</h3>
        <p className="text-neutral-medium mb-4">{t('researchTab.trendsDescription', { amazonDomain })}</p>
        <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="w-full sm:w-auto flex-grow">
                <label htmlFor="market-select" className="block text-sm font-medium text-gray-700 mb-1">{t('researchTab.selectMarketLabel')}</label>
                <select
                    id="market-select"
                    value={selectedMarket}
                    onChange={(e) => setSelectedMarket(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none bg-white"
                    disabled={isDiscoveringTrends}
                >
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            <div className="w-full sm:w-auto flex-grow">
                <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-1">{t('researchTab.selectCategoryLabel')}</label>
                <select
                    id="category-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none bg-white"
                    disabled={isFetchingCategories || isDiscoveringTrends}
                >
                    {isFetchingCategories ? (
                      <option>{t('metadataTab.fetchingCategories')}</option>
                    ) : (
                      amazonCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                    )}
                </select>
            </div>
          <button
            onClick={handleDiscoverTrends}
            disabled={isDiscoveringTrends || isFetchingCategories}
            className="w-full sm:w-auto flex items-center justify-center bg-brand-accent hover:bg-yellow-500 text-brand-dark font-bold py-3 px-6 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
          >
            {isDiscoveringTrends ? <LoadingSpinner className="animate-spin h-5 w-5 text-brand-dark" /> : `💡 ${t('researchTab.discoverTrendsButton')}`}
          </button>
        </div>
        {isDiscoveringTrends && <p className="text-center mt-4 text-neutral-medium">{t('researchTab.trendsLoading')}</p>}
        {trendsError && <p className="text-center mt-4 text-red-600">{trendsError}</p>}
        
        {trendsResult && (
          <div className="mt-6 animate-fade-in space-y-4">
             <h4 className="text-lg font-semibold text-brand-dark">{t('researchTab.trendingTopics')}</h4>
             <div className="space-y-3">
               {trendsResult.trends.map((trend, index) => (
                 <div key={index} className="p-4 bg-white border rounded-md shadow-sm">
                   <div className="flex justify-between items-start gap-4">
                     <div>
                       <div className="flex items-center gap-3">
                          <h5 className="font-bold text-brand-primary">{trend.topic}</h5>
                          <span className="text-sm font-bold text-brand-accent bg-yellow-100 px-2 py-1 rounded-full">{trend.trendScore}%</span>
                       </div>
                       <p className="text-sm text-neutral-dark mt-1"><strong className="text-neutral-medium">{t('researchTab.trendReason')}:</strong> {trend.reason}</p>
                     </div>
                     <button
                        onClick={() => handleSelectTrend(trend.topic)}
                        className="bg-brand-secondary hover:bg-brand-dark text-white font-semibold py-1 px-3 rounded-md text-sm transition-colors flex-shrink-0"
                      >
                       {t('researchTab.researchThisTopic')}
                     </button>
                   </div>
                 </div>
               ))}
             </div>
             {trendsResult.sources.length > 0 && (
                <div className="pt-4 mt-4 border-t">
                    <h5 className="text-base font-semibold text-brand-dark mb-2">{t('researchTab.trendSources')}</h5>
                    <ul className="list-disc list-inside text-sm space-y-1">
                        {trendsResult.sources.map((source, index) => (
                           source.web?.uri && (
                             <li key={index}>
                                <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-brand-secondary hover:underline">
                                    {source.web.title || source.web.uri}
                                </a>
                             </li>
                           )
                        ))}
                    </ul>
                </div>
             )}
          </div>
        )}
      </div>

      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('researchTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('researchTab.description')}
      </p>
      <form onSubmit={handleResearch}>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            ref={topicInputRef}
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('researchTab.placeholder')}
            className="flex-grow p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none"
            aria-label="Book topic"
          />
          <button
            type="submit"
            disabled={isLoading || !topic.trim()}
            className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
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
            <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.kdpKeywords')}</h3>
            <div className="flex flex-wrap gap-2">
              {project.researchData.keywords.map((item, index) => (
                <div key={index} className="bg-brand-accent/20 text-brand-dark font-semibold px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <span>{item.keyword}</span>
                  <span className="text-xs opacity-75">({item.relevance}%)</span>
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