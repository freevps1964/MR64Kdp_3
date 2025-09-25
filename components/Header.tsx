import React, { useState, useMemo, useEffect } from 'react';
import { useLocalization } from '../hooks/useLocalization';
import { useProject } from '../hooks/useProject';
import LanguageSelector from './LanguageSelector';
import ProgressBar from './ProgressBar';
import UserMenu from './UserMenu';

const Header: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editableTitle, setEditableTitle] = useState('');

  useEffect(() => {
    if (project) {
        setEditableTitle(project.projectTitle);
    }
  }, [project?.projectTitle]);
  
  const handleTitleBlur = () => {
    if (project && editableTitle.trim() && editableTitle.trim() !== project.projectTitle) {
      updateProject({ projectTitle: editableTitle.trim() });
    } else if (project) {
        setEditableTitle(project.projectTitle); // Revert if empty or unchanged
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleTitleBlur();
    } else if (e.key === 'Escape') {
        if (project) setEditableTitle(project.projectTitle);
        setIsEditingTitle(false);
    }
  };
  
  const handleSaveProject = () => {
    updateProject({}); // This will update the 'lastSaved' timestamp and save the project
  };

  const lastSavedText = useMemo(() => {
    if (!project?.lastSaved) return '';
    const lastSavedDate = new Date(project.lastSaved);
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
                <div className="hidden md:flex items-center gap-2 group text-left">
                    {isEditingTitle ? (
                        <input
                            type="text"
                            value={editableTitle}
                            onChange={(e) => setEditableTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            onKeyDown={handleTitleKeyDown}
                            className="text-lg font-semibold bg-brand-secondary px-2 py-1 rounded-md outline-none ring-2 ring-brand-accent"
                            autoFocus
                        />
                    ) : (
                        <button onClick={() => setIsEditingTitle(true)} className="flex items-center gap-2 group">
                             <h2 className="text-lg font-semibold group-hover:underline">{project.projectTitle}</h2>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                </div>
            )}
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
             {project && (
              <div className="flex items-center space-x-2 sm:space-x-4">
                 <span className="text-sm text-green-300 hidden sm:block whitespace-nowrap">
                  &#10003; {lastSavedText}
                </span>
                 <button 
                  onClick={handleSaveProject}
                  className="bg-brand-light hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md text-sm transition-colors"
                >
                  {t('header.saveProject')}
                </button>
              </div>
            )}
            <LanguageSelector />
            <UserMenu />
          </div>
        </div>
      </div>
      {project && <ProgressBar project={project} />}
    </header>
  );
};

export default Header;