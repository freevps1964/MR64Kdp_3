import React, { useState } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateStructure } from '../../services/geminiService';
import LoadingSpinner from '../icons/LoadingSpinner';
import Card from '../common/Card';
import type { BookStructure, Chapter as ChapterType, SubChapter } from '../../types';

const StructureTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateStructure = async () => {
    if (!project?.topic) {
      setError(t('structureTab.error'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const structure = await generateStructure(project.topic);
      if (structure) {
        // Aggiungi ID univoci se mancano
        const structureWithIds: BookStructure = {
            chapters: structure.chapters.map((chapter, cIndex) => ({
                ...chapter,
                id: chapter.id || `ch_${cIndex}_${Date.now()}`,
                subchapters: chapter.subchapters.map((sub, sIndex) => ({
                    ...sub,
                    id: sub.id || `sub_${cIndex}_${sIndex}_${Date.now()}`
                }))
            }))
        };
        updateProject({ bookStructure: structureWithIds });
      }
    } catch (err) {
      setError(t('structureTab.error'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('structureTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('structureTab.description')}
      </p>

      {!project?.bookStructure && (
        <div className="text-center">
          <button
            onClick={handleGenerateStructure}
            disabled={isLoading || !project?.topic}
            className="flex items-center justify-center mx-auto bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
          >
            {isLoading ? <LoadingSpinner /> : t('structureTab.button')}
          </button>
          {isLoading && <p className="mt-4 text-neutral-medium">{t('structureTab.loading')}</p>}
          {error && <p className="mt-4 text-red-600">{error}</p>}
        </div>
      )}

      {project?.bookStructure && (
        <div className="mt-6 space-y-4 animate-fade-in">
          {project.bookStructure.chapters.map((chapter, index) => (
            <div key={chapter.id} className="p-4 border border-gray-200 rounded-lg bg-neutral-light/50">
              <h3 className="font-bold text-lg text-brand-dark">{`${t('structureTab.chapter')} ${index + 1}: ${chapter.title}`}</h3>
              {chapter.subchapters && chapter.subchapters.length > 0 && (
                <ul className="mt-2 ml-6 list-disc list-outside space-y-1">
                  {chapter.subchapters.map((sub) => (
                    <li key={sub.id} className="text-neutral-dark">{sub.title}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default StructureTab;
