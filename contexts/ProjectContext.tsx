import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Project, BookStructure, Chapter, ContentBlock, ContentBlockType } from '../types';
import { useAuth } from '../hooks/useAuth';

export interface ProjectContextType {
  project: Project | null;
  archivedProjects: Project[];
  isProjectStarted: boolean;
  startNewProject: (title: string) => void;
  loadProject: (projectId: string) => void;
  updateProject: (updates: Partial<Project>) => void;
  updateNodeContent: (nodeId: string, content: string) => void;
  endCurrentProject: () => void;
  deleteProject: (projectId: string) => void;
  
  // Chapter/structure methods
  setBookStructure: (structure: BookStructure) => void;
  updateChapterTitle: (chapterId: string, title: string) => void;
  updateSubchapterTitle: (subchapterId: string, title: string) => void;
  addChapter: () => void;
  deleteChapter: (chapterId: string) => void;
  addSubchapter: (chapterId: string) => void;
  deleteSubchapter: (subchapterId: string) => void;
  reorderStructure: (draggedId: string, targetId: string) => void;


  // Content Block (Recipes/Exercises) methods
  addContentBlock: (block: Omit<ContentBlock, 'id'>) => void;
  updateContentBlock: (block: ContentBlock) => void;
  deleteContentBlock: (blockId: string) => void;
  
  // Author Archive methods
  addAuthorToArchive: (author: string) => void;
}


export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: React.ReactNode;
}

const generateId = () => `id_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;
const ARCHIVE_KEY_PREFIX = 'kdp-projects-archive';
const AUTHORS_ARCHIVE_KEY_PREFIX = 'kdp-authors-archive';


// Helper function to save a "lean" version of the project archive to localStorage.
// This omits potentially large fields like 'coverOptions' to prevent exceeding storage quotas.
const saveArchiveToLocalStorage = (archive: Project[], archiveKey: string) => {
    try {
        const leanArchive = archive.map(p => {
            const { coverOptions, ...rest } = p; // Omit coverOptions from persisted data
            return rest;
        });
        localStorage.setItem(archiveKey, JSON.stringify(leanArchive));
    } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
            console.error("LocalStorage quota exceeded. Could not save project changes.", e);
            // Inform the user with a more helpful message
            alert("Error: Could not save changes. The browser's local storage is full. Please delete old or unused projects to free up space.");
        } else {
            console.error("Failed to save to localStorage:", e);
            // Throw other errors to be handled elsewhere if necessary
            throw e;
        }
    }
};


export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const { user, isAuthEnabled } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [isProjectStarted, setIsProjectStarted] = useState(false);

  const getArchiveKey = useCallback(() => {
    if (user) {
      return `${ARCHIVE_KEY_PREFIX}-${user.uid}`;
    }
    // If auth is disabled, use a generic key for local-only storage.
    if (!isAuthEnabled) {
      return `${ARCHIVE_KEY_PREFIX}-guest`;
    }
    // If auth is enabled but there's no user, we are logged out.
    // No key is returned, preventing access to any project data.
    return null;
  }, [user, isAuthEnabled]);
  
  const getAuthorsArchiveKey = useCallback(() => {
    if (user) return `${AUTHORS_ARCHIVE_KEY_PREFIX}-${user.uid}`;
    if (!isAuthEnabled) return `${AUTHORS_ARCHIVE_KEY_PREFIX}-guest`;
    return null;
  }, [user, isAuthEnabled]);


  useEffect(() => {
    const archiveKey = getArchiveKey();
    if (archiveKey) {
        const savedArchive = localStorage.getItem(archiveKey);
        if (savedArchive) {
          try {
            const parsedArchive = JSON.parse(savedArchive);
            if (Array.isArray(parsedArchive)) {
              // Hydrate lean project objects with transient fields like coverOptions
              const hydratedArchive = parsedArchive.map((p: Omit<Project, 'coverOptions'>) => ({
                ...p,
                coverOptions: [], // Initialize as empty array on load
              }));
              setArchivedProjects(hydratedArchive);
            }
          } catch (error) {
            console.error("Error parsing project archive:", error);
            localStorage.removeItem(archiveKey);
          }
        } else {
            setArchivedProjects([]); // No archive for this user, reset
        }
    } else {
        // User logged out, clear all state
        setProject(null);
        setArchivedProjects([]);
        setIsProjectStarted(false);
    }
  }, [user, getArchiveKey]);

  const updateProject = useCallback((updates: Partial<Project>) => {
    const archiveKey = getArchiveKey();
    if (!archiveKey) return;

    setProject(currentProject => {
      if (!currentProject) return null;
      
      const updatedProject = { 
        ...currentProject, 
        ...updates, 
        lastSaved: new Date().toISOString() 
      };
      
      setArchivedProjects(prevArchive => {
        const existingIndex = prevArchive.findIndex(p => p.id === updatedProject.id);
        let newArchive;
        if (existingIndex > -1) {
          newArchive = [...prevArchive];
          newArchive[existingIndex] = updatedProject;
        } else {
          newArchive = [...prevArchive, updatedProject];
        }
        saveArchiveToLocalStorage(newArchive, archiveKey);
        return newArchive;
      });

      return updatedProject;
    });
  }, [getArchiveKey]);

  const startNewProject = (title: string) => {
    const archiveKey = getArchiveKey();
    if (!archiveKey) return;
    
    const authorsArchiveKey = getAuthorsArchiveKey();
    const savedAuthors = authorsArchiveKey ? localStorage.getItem(authorsArchiveKey) : null;
    const initialAuthors = savedAuthors ? JSON.parse(savedAuthors) : [];
      
    const newProject: Project = {
      id: generateId(),
      projectTitle: title,
      bookTitle: '',
      titlesArchive: [],
      topic: title,
      subtitle: '',
      subtitlesArchive: [],
      author: '',
      authorsArchive: initialAuthors,
      description: '',
      descriptionsArchive: [],
      metadataKeywords: [],
      categories: [],
      categoriesArchive: [],
      researchData: null,
      selectedSources: [],
      bookStructure: null,
      lastSaved: new Date().toISOString(),
      layoutTemplate: 'Classic',
      pageSize: '6x9',
      coverImage: null,
      coverOptions: [],
      coverPrompts: [],
      archivedCovers: [],
      contentBlocks: [],
      coverBonusCount: 0,
    };
    // Directly set and save the new project
    setProject(newProject);
    setArchivedProjects(prev => {
        const newArchive = [...prev, newProject];
        saveArchiveToLocalStorage(newArchive, archiveKey);
        return newArchive;
    });
    setIsProjectStarted(true);
  };
  
  const loadProject = (projectId: string) => {
      const projectToLoad = archivedProjects.find(p => p.id === projectId);
      if (projectToLoad) {
          setProject(projectToLoad);
          setIsProjectStarted(true);
      }
  };

  const updateNodeContent = useCallback((nodeId: string, content: string) => {
    const archiveKey = getArchiveKey();
    if (!archiveKey) return;

    setProject(currentProject => {
      if (!currentProject) return null;

      const newBookStructure = currentProject.bookStructure
        ? {
            ...currentProject.bookStructure,
            chapters: currentProject.bookStructure.chapters.map(ch => {
              if (ch.id === nodeId) {
                return { ...ch, content };
              }
              const subIndex = ch.subchapters.findIndex(sub => sub.id === nodeId);
              if (subIndex > -1) {
                const newSubchapters = [...ch.subchapters];
                newSubchapters[subIndex] = { ...newSubchapters[subIndex], content };
                return { ...ch, subchapters: newSubchapters };
              }
              return ch;
            }),
          }
        : null;

      const updatedProject = {
        ...currentProject,
        bookStructure: newBookStructure,
        lastSaved: new Date().toISOString(),
      };
      
      setArchivedProjects(prevArchive => {
        const existingIndex = prevArchive.findIndex(p => p.id === updatedProject.id);
        let newArchive;
        if (existingIndex > -1) {
          newArchive = [...prevArchive];
          newArchive[existingIndex] = updatedProject;
        } else {
          newArchive = [...prevArchive, updatedProject];
        }
        saveArchiveToLocalStorage(newArchive, archiveKey);
        return newArchive;
      });

      return updatedProject;
    });
  }, [getArchiveKey]);


  const setBookStructure = (structure: BookStructure) => {
    const hydratedChapters = structure.chapters.map(ch => ({
      ...ch,
      content: ch.content || '',
      subchapters: ch.subchapters.map(sub => ({
        ...sub,
        content: sub.content || '',
      })),
    }));
    updateProject({ bookStructure: { chapters: hydratedChapters } });
  };

  const updateChapterTitle = (chapterId: string, title: string) => {
    if (!project?.bookStructure) return;
    const newStructure = {
      ...project.bookStructure,
      chapters: project.bookStructure.chapters.map(ch => ch.id === chapterId ? { ...ch, title } : ch)
    };
    updateProject({ bookStructure: newStructure });
  };

  const updateSubchapterTitle = (subchapterId: string, title: string) => {
    if (!project?.bookStructure) return;
    const newStructure = {
      ...project.bookStructure,
      chapters: project.bookStructure.chapters.map(ch => ({
        ...ch,
        subchapters: ch.subchapters.map(sub => sub.id === subchapterId ? { ...sub, title } : sub)
      }))
    };
    updateProject({ bookStructure: newStructure });
  };

  const addChapter = () => {
    if (!project) return;
    const newChapter: Chapter = { id: generateId(), title: '', content: '', subchapters: [] };
    const newStructure: BookStructure = {
      chapters: [...(project.bookStructure?.chapters || []), newChapter]
    };
    updateProject({ bookStructure: newStructure });
  };

  const deleteChapter = (chapterId: string) => {
    if (!project?.bookStructure) return;
    const newStructure = {
      ...project.bookStructure,
      chapters: project.bookStructure.chapters.filter(ch => ch.id !== chapterId)
    };
    updateProject({ bookStructure: newStructure });
  };
  
  const addSubchapter = (chapterId: string) => {
    if (!project?.bookStructure) return;
    const newStructure = {
      ...project.bookStructure,
      chapters: project.bookStructure.chapters.map(ch => {
        if (ch.id === chapterId) {
          return {
            ...ch,
            subchapters: [...ch.subchapters, { id: generateId(), title: '', content: '' }]
          };
        }
        return ch;
      })
    };
    updateProject({ bookStructure: newStructure });
  };

  const deleteSubchapter = (subchapterId: string) => {
    if (!project?.bookStructure) return;
    const newStructure = {
      ...project.bookStructure,
      chapters: project.bookStructure.chapters.map(ch => ({
        ...ch,
        subchapters: ch.subchapters.filter(sub => sub.id !== subchapterId)
      }))
    };
    updateProject({ bookStructure: newStructure });
  };

  const reorderStructure = (draggedId: string, targetId: string) => {
    if (!project?.bookStructure || draggedId === targetId) return;

    const chapters = [...project.bookStructure.chapters];
    let newChapters: Chapter[] | null = null;
    
    // Check if we are dragging chapters
    const draggedChapterIndex = chapters.findIndex(c => c.id === draggedId);
    const targetChapterIndex = chapters.findIndex(c => c.id === targetId);
    
    if (draggedChapterIndex > -1 && targetChapterIndex > -1) {
        // Reorder chapters
        const [removed] = chapters.splice(draggedChapterIndex, 1);
        chapters.splice(targetChapterIndex, 0, removed);
        newChapters = chapters;
    } else {
        // Dragging subchapters - find which chapter they belong to
        let parentChapterIndex = -1;
        for (let i = 0; i < chapters.length; i++) {
            if (chapters[i].subchapters.some(s => s.id === draggedId)) {
                parentChapterIndex = i;
                break;
            }
        }
        
        if (parentChapterIndex > -1) {
            const chapter = chapters[parentChapterIndex];
            const subchapters = [...chapter.subchapters];
            const draggedSubIndex = subchapters.findIndex(s => s.id === draggedId);
            const targetSubIndex = subchapters.findIndex(s => s.id === targetId);

            if (draggedSubIndex > -1 && targetSubIndex > -1) {
                const [removed] = subchapters.splice(draggedSubIndex, 1);
                subchapters.splice(targetSubIndex, 0, removed);
                
                const modifiedChapters = [...chapters];
                modifiedChapters[parentChapterIndex] = { ...chapter, subchapters };
                newChapters = modifiedChapters;
            }
        }
    }

    if (newChapters) {
        updateProject({ bookStructure: { chapters: newChapters } });
    }
  };
  
  const addContentBlock = (block: Omit<ContentBlock, 'id'>) => {
    if (!project) return;
    const newBlock = { ...block, id: generateId() };
    updateProject({ contentBlocks: [...project.contentBlocks, newBlock] });
  };
  
  const updateContentBlock = (block: ContentBlock) => {
      if (!project) return;
      const newBlocks = project.contentBlocks.map(b => b.id === block.id ? block : b);
      updateProject({ contentBlocks: newBlocks });
  };

  const deleteContentBlock = (blockId: string) => {
    if (!project) return;
    const newBlocks = project.contentBlocks.filter(b => b.id !== blockId);
    updateProject({ contentBlocks: newBlocks });
  };
  
  const addAuthorToArchive = (author: string) => {
    if (!project || !author.trim()) return;

    const authorsArchiveKey = getAuthorsArchiveKey();
    if (!authorsArchiveKey) return;

    const trimmedAuthor = author.trim();
    const currentArchive = project.authorsArchive || [];
    
    if (!currentArchive.includes(trimmedAuthor)) {
        const newArchive = [...currentArchive, trimmedAuthor];
        updateProject({ authorsArchive: newArchive });
        localStorage.setItem(authorsArchiveKey, JSON.stringify(newArchive));
    }
  };

  const deleteProject = (projectId: string) => {
      const archiveKey = getArchiveKey();
      if (!archiveKey) return;
      
      setArchivedProjects(prevArchive => {
          const newArchive = prevArchive.filter(p => p.id !== projectId);
          saveArchiveToLocalStorage(newArchive, archiveKey);
          return newArchive;
      });
  };
  
  const endCurrentProject = () => {
      setProject(null);
      setIsProjectStarted(false);
  };

  return (
    <ProjectContext.Provider value={{ 
      project, 
      isProjectStarted, 
      archivedProjects,
      startNewProject, 
      loadProject,
      updateProject, 
      updateNodeContent,
      endCurrentProject,
      deleteProject,
      setBookStructure,
      updateChapterTitle,
      updateSubchapterTitle,
      addChapter,
      deleteChapter,
      addSubchapter,
      deleteSubchapter,
      reorderStructure,
      addContentBlock,
      updateContentBlock,
      deleteContentBlock,
      addAuthorToArchive,
    }}>
      {children}
    </ProjectContext.Provider>
  );
};