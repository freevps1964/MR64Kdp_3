import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { discoverTrends, fetchAmazonCategories } from '../../services/geminiService';
import LoadingSpinner from '../icons/LoadingSpinner';
import Card from '../common/Card';
import type { GroundingSource, Trend, TabKey } from '../../types';

interface MarketTrendsTabProps {
  setActiveTab: (tab: TabKey) => void;
}

const MarketTrendsTab: React.FC<MarketTrendsTabProps> = ({ setActiveTab }) => {
  const { t, locale } = useLocalization();
  const { updateProject } = useProject();

  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendsResult, setTrendsResult] = useState<{ trends: Trend[], sources: GroundingSource[] } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedMarket, setSelectedMarket] = useState<string>('Italy');
  
  const [amazonCategories, setAmazonCategories] = useState<string[]>([]);
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);
  
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
        setAmazonCategories([t('marketTrendsTab.allCategories'), ...cats]);
        setIsFetchingCategories(false);
    };
    loadCategories();
  }, [locale, t]);

  useEffect(() => {
    setSelectedCategory(t('marketTrendsTab.allCategories'));
  }, [t]);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setError(null);
    setTrendsResult(null);
    try {
      const { trends, sources } = await discoverTrends(selectedCategory, selectedMarket);
      if (trends) {
        trends.sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0));
        setTrendsResult({ trends, sources });
      } else {
        throw new Error('No trends returned from analysis.');
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
      setIsDiscovering(false);
    }
  };
  
  const handleSelectTrend = (trendTopic: string) => {
    updateProject({ topic: trendTopic, researchData: null }); // Clear old research
    setActiveTab('research');
  };

  return (
    <Card>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-brand-dark mb-3">{t('marketTrendsTab.title')}</h2>
        <p className="text-neutral-medium mb-4">{t('marketTrendsTab.description', { amazonDomain })}</p>
        <div className="flex flex-col sm:flex-row items-end gap-4 p-4 border border-brand-light/50 rounded-lg bg-brand-light/10">
            <div className="w-full sm:w-auto flex-grow">
                <label htmlFor="market-select" className="block text-sm font-medium text-gray-700 mb-1">{t('marketTrendsTab.selectMarketLabel')}</label>
                <select
                    id="market-select"
                    value={selectedMarket}
                    onChange={(e) => setSelectedMarket(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none bg-white"
                    disabled={isDiscovering}
                >
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            <div className="w-full sm:w-auto flex-grow">
                <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-1">{t('marketTrendsTab.selectCategoryLabel')}</label>
                <select
                    id="category-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none bg-white"
                    disabled={isFetchingCategories || isDiscovering}
                >
                    {isFetchingCategories ? (
                      <option>{t('metadataTab.fetchingCategories')}</option>
                    ) : (
                      amazonCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                    )}
                </select>
            </div>
          <button
            onClick={handleDiscover}
            disabled={isDiscovering || isFetchingCategories}
            className="w-full sm:w-auto flex items-center justify-center bg-brand-accent hover:bg-yellow-500 text-brand-dark font-bold py-3 px-6 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
          >
            {isDiscovering ? <LoadingSpinner className="animate-spin h-5 w-5 text-brand-dark" /> : `💡 ${t('marketTrendsTab.discoverButton')}`}
          </button>
        </div>
      </div>

      {isDiscovering && <p className="text-center mt-4 text-neutral-medium">{t('marketTrendsTab.loading')}</p>}
      {error && <p className="text-center mt-4 text-red-600">{error}</p>}
      
      {trendsResult && (
        <div className="mt-6 animate-fade-in space-y-4">
           <h3 className="text-xl font-semibold text-brand-dark">{t('marketTrendsTab.trendingTopics')}</h3>
           <div className="space-y-3">
             {trendsResult.trends.map((trend, index) => (
               <div key={index} className="p-4 bg-white border rounded-md shadow-sm">
                 <div className="flex justify-between items-start gap-4">
                   <div>
                     <div className="flex items-center gap-3">
                        <h4 className="font-bold text-brand-primary">{trend.topic}</h4>
                        <span className="text-sm font-bold text-brand-accent bg-yellow-100 px-2 py-1 rounded-full">{trend.trendScore}%</span>
                     </div>
                     <p className="text-sm text-neutral-dark mt-1"><strong className="text-neutral-medium">{t('marketTrendsTab.trendReason')}:</strong> {trend.reason}</p>
                   </div>
                   <button
                      onClick={() => handleSelectTrend(trend.topic)}
                      className="bg-brand-secondary hover:bg-brand-dark text-white font-semibold py-1 px-3 rounded-md text-sm transition-colors flex-shrink-0"
                    >
                     {t('marketTrendsTab.researchThisTopic')}
                   </button>
                 </div>
               </div>
             ))}
           </div>
           {trendsResult.sources.length > 0 && (
              <div className="pt-4 mt-4 border-t">
                  <h4 className="text-base font-semibold text-brand-dark mb-2">{t('marketTrendsTab.sources')}</h4>
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
    </Card>
  );
};

export default MarketTrendsTab;
