import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateStructure } from '../../services/geminiService';
import LoadingSpinner from '../icons/LoadingSpinner';
import Card from '../common/Card';
import type { BookStructure, Chapter as ChapterType } from '../../types';
import TrashIcon from '../icons/TrashIcon';
import PlusIcon from '../icons/PlusIcon';

const StructureTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedStructure, setEditedStructure] = useState<BookStructure | null>(null);

  useEffect(() => {
    // Sync local state with global project state when it changes (e.g., loading a project)
    // Deep copy to prevent mutating the original project state directly
    setEditedStructure(project?.bookStructure ? JSON.parse(JSON.stringify(project.bookStructure)) : null);
  }, [project?.bookStructure]);
  
  const hasUnsavedChanges = project?.bookStructure && editedStructure 
    ? JSON.stringify(project.bookStructure) !== JSON.stringify(editedStructure) 
    : (project?.bookStructure === null && editedStructure !== null);

  const generateUniqueId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const handleGenerateStructure = async () => {
    if (hasUnsavedChanges) {
      if (!window.confirm(t('structureTab.unsavedChanges'))) {
        return;
      }
    }
    
    if (!project?.topic) {
      setError(t('structureTab.error'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const structure = await generateStructure(project.topic);
      if (structure) {
        const structureWithIds: BookStructure = {
            chapters: structure.chapters.map((chapter) => ({
                ...chapter,
                id: chapter.id || generateUniqueId('ch'),
                subchapters: chapter.subchapters.map((sub) => ({
                    ...sub,
                    id: sub.id || generateUniqueId('sub')
                }))
            }))
        };
        updateProject({ bookStructure: structureWithIds });
        // The useEffect will update the local state
      }
    } catch (err) {
      setError(t('structureTab.error'));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChapterChange = (chapterId: string, newTitle: string) => {
    setEditedStructure(prev => {
        if (!prev) return null;
        return {
            ...prev,
            chapters: prev.chapters.map(ch => ch.id === chapterId ? { ...ch, title: newTitle } : ch)
        };
    });
  };

  const handleSubchapterChange = (subchapterId: string, newTitle: string) => {
    setEditedStructure(prev => {
        if (!prev) return null;
        return {
            ...prev,
            chapters: prev.chapters.map(ch => ({
                ...ch,
                subchapters: ch.subchapters.map(sub => sub.id === subchapterId ? { ...sub, title: newTitle } : sub)
            }))
        };
    });
  };

  const handleAddChapter = () => {
    const newChapter: ChapterType = {
        id: generateUniqueId('ch'),
        title: '',
        subchapters: []
    };
    setEditedStructure(prev => ({
        chapters: [...(prev?.chapters || []), newChapter]
    }));
  };

  const handleAddSubchapter = (chapterId: string) => {
    setEditedStructure(prev => {
        if (!prev) return null;
        return {
            ...prev,
            chapters: prev.chapters.map(ch => {
                if (ch.id === chapterId) {
                    return {
                        ...ch,
                        subchapters: [...ch.subchapters, { id: generateUniqueId('sub'), title: '' }]
                    };
                }
                return ch;
            })
        };
    });
  };
  
  const handleDeleteChapter = (chapterId: string) => {
    if (window.confirm(t('structureTab.confirmDeleteChapter'))) {
        setEditedStructure(prev => {
            if (!prev) return null;
            return {
                ...prev,
                chapters: prev.chapters.filter(ch => ch.id !== chapterId)
            };
        });
    }
  };

  const handleDeleteSubchapter = (subchapterId: string) => {
     setEditedStructure(prev => {
        if (!prev) return null;
        return {
            ...prev,
            chapters: prev.chapters.map(ch => ({
                ...ch,
                subchapters: ch.subchapters.filter(sub => sub.id !== subchapterId)
            }))
        };
    });
  };
  
  const handleSaveChanges = () => {
    if (editedStructure) {
        updateProject({ bookStructure: editedStructure });
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('structureTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('structureTab.description')}
      </p>

      {!editedStructure ? (
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
      ) : (
        <div className="animate-fade-in">
            <div className="space-y-4">
            {editedStructure.chapters.map((chapter, index) => (
                <div key={chapter.id} className="p-4 border border-gray-200 rounded-lg bg-neutral-light/50">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-lg text-brand-dark">{`${t('structureTab.chapter')} ${index + 1}:`}</span>
                        <input
                            type="text"
                            value={chapter.title}
                            onChange={(e) => handleChapterChange(chapter.id, e.target.value)}
                            placeholder={t('structureTab.editTitlePlaceholder')}
                            className="flex-grow p-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-light focus:outline-none"
                            aria-label={`${t('structureTab.chapter')} ${index + 1} title`}
                        />
                         <button onClick={() => handleDeleteChapter(chapter.id)} className="p-1 text-red-600 hover:text-red-800" title={t('structureTab.deleteChapterTitle')}>
                            <TrashIcon />
                        </button>
                    </div>
                
                    <div className="mt-2 ml-6 space-y-2">
                        {chapter.subchapters.map((sub, subIndex) => (
                             <div key={sub.id} className="flex items-center gap-2">
                                <span className="text-neutral-dark">&#8226;</span>
                                <input
                                    type="text"
                                    value={sub.title}
                                    onChange={(e) => handleSubchapterChange(sub.id, e.target.value)}
                                    placeholder={t('structureTab.editTitlePlaceholder')}
                                    className="flex-grow p-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-light focus:outline-none"
                                    aria-label={`${t('structureTab.subchapter')} ${subIndex + 1} title for chapter ${index + 1}`}
                                />
                                <button onClick={() => handleDeleteSubchapter(sub.id)} className="p-1 text-red-500 hover:text-red-700" title={t('structureTab.deleteSubchapterTitle')}>
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                         <button onClick={() => handleAddSubchapter(chapter.id)} className="flex items-center gap-1 text-sm text-brand-secondary hover:text-brand-dark font-semibold mt-2">
                            <PlusIcon className="w-4 h-4" />
                            {t('structureTab.addSubchapter')}
                        </button>
                    </div>
                </div>
            ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <button onClick={handleAddChapter} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-neutral-light text-brand-dark font-bold py-2 px-4 rounded-md border border-brand-dark">
                    <PlusIcon />
                    {t('structureTab.addChapter')}
                </button>
                <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-4">
                    <button
                        onClick={handleGenerateStructure}
                        disabled={isLoading || !project?.topic}
                        className="flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
                    >
                        {isLoading ? <LoadingSpinner /> : '✨ ' + t('structureTab.button')}
                    </button>
                    <button
                        onClick={handleSaveChanges}
                        disabled={!hasUnsavedChanges}
                        className={`font-bold py-2 px-4 rounded-md transition-colors shadow ${
                            !hasUnsavedChanges
                            ? 'bg-green-600 text-white cursor-default'
                            : 'bg-brand-primary hover:bg-brand-secondary text-white'
                        }`}
                    >
                        {hasUnsavedChanges ? t('structureTab.saveButton') : t('header.projectSaved')}
                    </button>
                </div>
            </div>

            {isLoading && <p className="text-center mt-4 text-neutral-medium">{t('structureTab.loading')}</p>}
            {error && <p className="text-center mt-4 text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  );
};

export default StructureTab;