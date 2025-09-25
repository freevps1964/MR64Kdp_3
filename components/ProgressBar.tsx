import React from 'react';
import type { Project } from '../types';
import { useLocalization } from '../hooks/useLocalization';

interface ProgressBarProps {
  project: Project;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ project }) => {
  const { t } = useLocalization();

  const calculateProgress = (): number => {
    if (!project) return 0;

    let completedSteps = 0;
    const totalSteps = 5; // Research, Structure, Content, Cover, Metadata

    // 1. Research
    if (project.researchData) {
      completedSteps++;
    }

    // 2. Structure
    if (project.bookStructure && project.bookStructure.chapters.length > 0) {
      completedSteps++;
    }
    
    // 3. Content (complete if all content nodes are written)
    if (project.bookStructure && project.bookStructure.chapters.length > 0) {
      const contentNodes = project.bookStructure.chapters.flatMap(chapter =>
        chapter.subchapters.length > 0 ? chapter.subchapters : [chapter]
      );
      if (contentNodes.length > 0 && contentNodes.every(node => node.content?.trim())) {
        completedSteps++;
      }
    }

    // 4. Cover
    if (project.coverImage) {
      completedSteps++;
    }
    
    // 5. Metadata
    if (project.projectTitle && project.author && project.description) {
      completedSteps++;
    }

    return Math.round((completedSteps / totalSteps) * 100);
  };

  const progress = calculateProgress();

  return (
    <div className="w-full bg-brand-dark px-4 sm:px-6 lg:px-8 pb-1">
        <div className="flex items-center justify-between text-xs text-white mb-1">
            <span>{t('header.progress')}</span>
            <span>{progress}%</span>
        </div>
      <div className="w-full bg-neutral-light/30 rounded-full h-2">
        <div
          className="bg-brand-accent h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;