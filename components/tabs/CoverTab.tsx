import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateCoverImages } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';

const CoverTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();
  
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
        const defaultPrompt = `Copertina di un libro intitolato "${project.projectTitle || t('project.defaultTitle')}" sull'argomento "${project.topic || 'argomento generico'}". Stile pulito, moderno e accattivante.`;
        setPrompt(defaultPrompt);
    }
  }, [project?.projectTitle, project?.topic, t]);

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsLoading(true);
    setError(null);
    updateProject({ coverOptions: [] });

    try {
      const response = await generateCoverImages(prompt);
      const base64Images = response.generatedImages.map(img => img.image.imageBytes);
      updateProject({ coverOptions: base64Images });
    } catch (err) {
      console.error("Errore nella generazione delle copertine:", err);
      setError("Failed to generate covers. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectCover = (base64Image: string) => {
    updateProject({ coverImage: base64Image });
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('coverTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('coverTab.description')}
      </p>

      <div className="space-y-4">
        <label htmlFor="cover-prompt" className="block font-semibold text-neutral-dark">
          {t('coverTab.promptLabel')}
        </label>
        <textarea
          id="cover-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none"
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt}
          className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
        >
          {isLoading ? <LoadingSpinner /> : t('coverTab.button')}
        </button>
      </div>

      {isLoading && <p className="text-center mt-6 text-neutral-medium">{t('coverTab.loading')}</p>}
      {error && <p className="text-center mt-6 text-red-600">{error}</p>}

      {project && project.coverOptions.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-brand-dark mb-4">{t('coverTab.resultsTitle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {project.coverOptions.map((base64Image, index) => {
              const imageUrl = `data:image/png;base64,${base64Image}`;
              const isSelected = project.coverImage === base64Image;
              return (
                <div key={index} className="text-center space-y-3">
                  <img 
                    src={imageUrl} 
                    alt={`Generated cover ${index + 1}`}
                    className={`rounded-lg shadow-lg w-full object-cover aspect-[3/4] ${isSelected ? 'ring-4 ring-brand-accent' : ''}`}
                  />
                  <button
                    onClick={() => handleSelectCover(base64Image)}
                    disabled={isSelected}
                    className="bg-brand-secondary hover:bg-brand-dark text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-green-600 disabled:cursor-default"
                  >
                    {isSelected ? t('coverTab.selected') : t('coverTab.selectButton')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

export default CoverTab;
