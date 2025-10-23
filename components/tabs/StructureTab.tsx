import React, { useState, useRef } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateStructure } from '../../services/geminiService';
import LoadingSpinner from '../icons/LoadingSpinner';
import Card from '../common/Card';
import type { BookStructure } from '../../types';
import TrashIcon from '../icons/TrashIcon';
import PlusIcon from '../icons/PlusIcon';

const StructureTab: React.FC = () => {
  const { t } = useLocalization();
  const { 
    project, 
    updateProject,
    setBookStructure, 
    updateChapterTitle, 
    updateSubchapterTitle,
    addChapter,
    deleteChapter,
    addSubchapter,
    deleteSubchapter,
    reorderStructure,
  } = useProject();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drag and Drop State
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragCounter = useRef(0);

  const generateUniqueId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const handleGenerateStructure = async () => {
    if (project?.bookStructure?.chapters?.length > 0) {
      if (!window.confirm(t('structureTab.unsavedChanges'))) {
        return;
      }
    }
    
    if (!project?.topic || !project.researchData || !project.bookTitle) {
      setError(t('structureTab.error'));
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const structure = await generateStructure(project.topic, project.bookTitle, project.subtitle, project.researchData.keywords);
      if (structure) {
        const structureWithIds: BookStructure = {
            chapters: structure.chapters.map((chapter) => ({
                ...chapter,
                id: chapter.id || generateUniqueId('ch'),
                content: chapter.content || '',
                subchapters: chapter.subchapters.map((sub) => ({
                    ...sub,
                    id: sub.id || generateUniqueId('sub'),
                    content: sub.content || '',
                }))
            }))
        };
        setBookStructure(structureWithIds);
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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string, type: 'chapter' | 'subchapter', parentId?: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setData('type', type);
    if (parentId) {
      e.dataTransfer.setData('parentId', parentId);
    }
    setDraggedId(id);
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, id: string, type: 'chapter' | 'subchapter', parentId?: string) => {
    e.preventDefault();
    const draggedType = e.dataTransfer.getData('type');
    let isTargetValid = false;

    if (draggedType === 'chapter' && type === 'chapter') {
        isTargetValid = true;
    } else if (draggedType === 'subchapter' && type === 'subchapter') {
        const draggedParentId = e.dataTransfer.getData('parentId');
        if (draggedParentId === parentId) {
            isTargetValid = true;
        }
    }

    if (isTargetValid) {
        dragCounter.current++;
        setDragOverId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) {
          setDragOverId(null);
      }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== targetId) {
        reorderStructure(sourceId, targetId);
    }
    setDraggedId(null);
    setDragOverId(null);
    dragCounter.current = 0;
  };
  
  const handleDragEnd = () => {
      setDraggedId(null);
      setDragOverId(null);
      dragCounter.current = 0;
  };
  
  const currentStructure = project?.bookStructure;

  return (
    <Card>
      <style>{`
        .dragging {
          opacity: 0.4;
          transform: scale(0.98);
        }
        .drag-over {
          background-color: #E0F2FE !important; /* sky-100 */
          border: 2px dashed #0284C7; /* sky-600 */
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }
      `}</style>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('structureTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('structureTab.description')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {project?.researchData?.titles && project.researchData.titles.length > 0 && (
          <div>
            <label htmlFor="bookTitleSelect" className="block text-sm font-medium text-gray-700 mb-1">
              {t('metadataTab.bookTitle')}
            </label>
            <select
              id="bookTitleSelect"
              value={project.bookTitle || ''}
              onChange={(e) => updateProject({ bookTitle: e.target.value, subtitle: '' })}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-light focus:border-brand-light bg-white"
            >
              <option value="" disabled>{t('metadataTab.selectTitle')}</option>
              {project.researchData.titles.map((item) => (
                <option key={item.title} value={item.title}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {project?.researchData?.subtitles && project.researchData.subtitles.length > 0 && (
          <div>
            <label htmlFor="bookSubtitleSelect" className="block text-sm font-medium text-gray-700 mb-1">
              {t('structureTab.subtitleLabel')}
            </label>
            <select
              id="bookSubtitleSelect"
              value={project.subtitle || ''}
              onChange={(e) => updateProject({ subtitle: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-light focus:border-brand-light bg-white"
            >
              <option value="">{t('metadataTab.selectSubtitle')}</option>
              {project.researchData.subtitles.map((item) => (
                <option key={item.subtitle} value={item.subtitle}>
                  {item.subtitle}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>


      {!currentStructure || currentStructure.chapters.length === 0 ? (
        <div className="text-center">
          <button
            onClick={handleGenerateStructure}
            disabled={isLoading || !project?.bookTitle}
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
            {currentStructure.chapters.map((chapter, index) => (
                <div 
                  key={chapter.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, chapter.id, 'chapter')}
                  onDragEnter={(e) => handleDragEnter(e, chapter.id, 'chapter')}
                  onDragLeave={handleDragLeave}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, chapter.id)}
                  onDragEnd={handleDragEnd}
                  className={`p-4 border border-gray-200 rounded-lg bg-neutral-light/50 transition-all cursor-grab ${draggedId === chapter.id ? 'dragging' : ''} ${dragOverId === chapter.id ? 'drag-over' : ''}`}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-lg text-brand-dark">{`${t('structureTab.chapter')} ${index + 1}:`}</span>
                        <input
                            type="text"
                            value={chapter.title}
                            onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                            placeholder={t('structureTab.editTitlePlaceholder')}
                            className="flex-grow p-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-light focus:outline-none"
                            aria-label={`${t('structureTab.chapter')} ${index + 1} title`}
                        />
                         <button onClick={() => deleteChapter(chapter.id)} className="p-1 text-red-600 hover:text-red-800" title={t('structureTab.deleteChapterTitle')}>
                            <TrashIcon />
                        </button>
                    </div>
                
                    <div className="mt-2 ml-6 space-y-2">
                        {chapter.subchapters.map((sub, subIndex) => (
                             <div 
                                key={sub.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, sub.id, 'subchapter', chapter.id)}
                                onDragEnter={(e) => handleDragEnter(e, sub.id, 'subchapter', chapter.id)}
                                onDragLeave={handleDragLeave}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, sub.id)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center gap-2 transition-all p-1 rounded-md cursor-grab ${draggedId === sub.id ? 'dragging' : ''} ${dragOverId === sub.id ? 'drag-over' : ''}`}
                             >
                                <span className="text-neutral-dark">&#8226;</span>
                                <input
                                    type="text"
                                    value={sub.title}
                                    onChange={(e) => updateSubchapterTitle(sub.id, e.target.value)}
                                    placeholder={t('structureTab.editTitlePlaceholder')}
                                    className="flex-grow p-1 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-light focus:outline-none"
                                    aria-label={`${t('structureTab.subchapter')} ${subIndex + 1} title for chapter ${index + 1}`}
                                />
                                <button onClick={() => deleteSubchapter(sub.id)} className="p-1 text-red-500 hover:text-red-700" title={t('structureTab.deleteSubchapterTitle')}>
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                         <button onClick={() => addSubchapter(chapter.id)} className="flex items-center gap-1 text-sm text-brand-secondary hover:text-brand-dark font-semibold mt-2">
                            <PlusIcon className="w-4 h-4" />
                            {t('structureTab.addSubchapter')}
                        </button>
                    </div>
                </div>
            ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <button onClick={addChapter} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-neutral-light text-brand-dark font-bold py-2 px-4 rounded-md border border-brand-dark">
                    <PlusIcon />
                    {t('structureTab.addChapter')}
                </button>
                <div className="w-full sm:w-auto flex items-center justify-center sm:justify-end gap-4">
                    <button
                        onClick={handleGenerateStructure}
                        disabled={isLoading || !project?.bookTitle}
                        className="flex items-center justify-center bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
                    >
                        {isLoading ? <LoadingSpinner /> : '✨ ' + t('structureTab.button')}
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