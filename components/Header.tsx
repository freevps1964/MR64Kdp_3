import React from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useProject } from '../hooks/useProject';
import LanguageSelector from './LanguageSelector';
import ProgressBar from './ProgressBar';

const Header: React.FC = () => {
  const { t } = useLocalization();
  const { project, archiveCurrentProject } = useProject();

  const handleSave = () => {
    const newName = prompt(t('header.promptProjectName'), project?.projectTitle);
    if (newName && project) {
      archiveCurrentProject(newName);
    }
  };

  return (
    <header className="bg-brand-primary text-white shadow-md sticky top-0 z-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold sm:text-2xl">
              <span className="text-brand-accent">MR64</span>Kdp Book
            </h1>
            {project && (
               <span className="hidden md:block mx-4 text-neutral-light/50">|</span>
            )}
            {project && (
                <h2 className="hidden md:block text-lg font-semibold">{project.projectTitle}</h2>
            )}
          </div>
          <div className="flex items-center space-x-4">
             {project && (
              <button 
                onClick={handleSave}
                className="bg-brand-accent/80 hover:bg-brand-accent text-brand-dark font-bold py-2 px-4 rounded-md text-sm transition-colors"
              >
                {t('header.saveAndArchive')}
              </button>
            )}
            <LanguageSelector />
          </div>
        </div>
      </div>
      {project && <ProgressBar project={project} />}
    </header>
  );
};

export default Header;