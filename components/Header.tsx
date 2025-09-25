import React, { useState, useMemo } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useProject } from '../hooks/useProject';
import LanguageSelector from './LanguageSelector';
import ProgressBar from './ProgressBar';

const Header: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject, endCurrentProject } = useProject();
  
  const handleRenameProject = () => {
    if (!project) return;
    const newName = prompt(t('header.promptRenameProject'), project.projectTitle);
    if (newName && newName.trim() !== '') {
      updateProject({ projectTitle: newName.trim() });
    }
  };
  
  const lastSavedText = useMemo(() => {
    if (!project?.lastSaved) return '';
    const lastSavedDate = new Date(project.lastSaved);
    // Format to local time, e.g., "14:35"
    const timeString = lastSavedDate.toLocaleTimeString(navigator.language, {
      hour: '2-digit',
      minute: '2-digit'
    });
    return t('header.projectSavedAt', { time: timeString });
  }, [project?.lastSaved, t]);

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
                <button onClick={handleRenameProject} className="hidden md:flex items-center gap-2 group text-left">
                    <h2 className="text-lg font-semibold group-hover:underline">{project.projectTitle}</h2>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
          </div>
          <div className="flex items-center space-x-2">
             {project && (
              <div className="flex items-center space-x-4">
                 <span className="text-sm text-green-300 hidden sm:block">
                  &#10003; {lastSavedText}
                </span>
                <button 
                  onClick={endCurrentProject}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors"
                >
                  {t('header.closeProject')}
                </button>
              </div>
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