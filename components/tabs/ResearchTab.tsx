import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { researchTopic } from '../../services/geminiService';
import LoadingSpinner from '../icons/LoadingSpinner';
import Card from '../common/Card';
import type { GroundingSource } from '../../types';

const ResearchTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();
  const [topic, setTopic] = useState(project?.topic || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project?.topic) {
      setTopic(project.topic);
    }
  }, [project?.topic]);

  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setError(null);
    updateProject({ researchData: null, topic });

    try {
      const { result, sources } = await researchTopic(topic);
      if (result) {
        result.sources = sources;
        updateProject({ researchData: result });
      } else {
        throw new Error('No data returned from research.');
      }
    } catch (err) {
      setError(t('researchTab.error'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTitle = (title: string) => {
    updateProject({ projectTitle: title });
  };
  
  const handleSelectSubtitle = (subtitle: string) => {
    updateProject({ subtitle: subtitle });
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

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('researchTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('researchTab.description')}
      </p>
      <form onSubmit={handleResearch}>
        <div className="flex flex-col sm:flex-row gap-4">
          <input
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
            <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.marketSummary')}</h3>
            <p className="text-neutral-dark bg-neutral-light p-4 rounded-md">{project.researchData.marketSummary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.suggestedTitles')}</h3>
              <div className="space-y-2">
                {project.researchData.titles.map((item, index) => (
                    <button key={index} onClick={() => handleSelectTitle(item.title)} className={`w-full text-left p-3 rounded-md transition-colors ${project.projectTitle === item.title ? 'bg-brand-accent/30 ring-2 ring-brand-accent' : 'bg-neutral-light hover:bg-gray-200'}`}>
                        {item.title}
                    </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.suggestedSubtitles')}</h3>
               <div className="space-y-2">
                {project.researchData.subtitles.map((item, index) => (
                    <button key={index} onClick={() => handleSelectSubtitle(item.subtitle)} className={`w-full text-left p-3 rounded-md transition-colors ${project.subtitle === item.subtitle ? 'bg-brand-accent/30 ring-2 ring-brand-accent' : 'bg-neutral-light hover:bg-gray-200'}`}>
                        {item.subtitle}
                    </button>
                ))}
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.kdpKeywords')}</h3>
            <div className="flex flex-wrap gap-2">
              {project.researchData.keywords.map((item, index) => (
                <span key={index} className="bg-brand-accent/20 text-brand-dark font-semibold px-3 py-1 rounded-full text-sm">
                  {item.keyword}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-brand-dark mb-3">{t('researchTab.sources')}</h3>
             <div className="space-y-2">
                {project.researchData.sources?.map((source, index) => (
                    source.web?.uri && (
                        <div key={index} className="flex items-center gap-3 p-2 bg-neutral-light rounded-md">
                            <input 
                                type="checkbox" 
                                id={`source-${index}`}
                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-light"
                                checked={project.selectedSources?.some(s => s.web?.uri === source.web?.uri)}
                                onChange={(e) => handleSourceSelectionChange(source, e.target.checked)}
                            />
                            <label htmlFor={`source-${index}`} className="text-sm">
                                <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-brand-secondary hover:underline">
                                    {source.web.title || source.web.uri}
                                </a>
                            </label>
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