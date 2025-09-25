import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Project, BookStructure, Chapter } from '../types';

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
  
  // New specific structure methods
  setBookStructure: (structure: BookStructure) => void;
  updateChapterTitle: (chapterId: string, title: string) => void;
  updateSubchapterTitle: (subchapterId: string, title: string) => void;
  addChapter: () => void;
  deleteChapter: (chapterId: string) => void;
  addSubchapter: (chapterId: string) => void;
  deleteSubchapter: (subchapterId: string) => void;
}


export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: React.ReactNode;
}

const generateId = () => `id_${new Date().getTime()}_${Math.random().toString(36).substring(2, 9)}`;
const ARCHIVE_KEY = 'kdp-projects-archive';

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [isProjectStarted, setIsProjectStarted] = useState(false);

  useEffect(() => {
    const savedArchive = localStorage.getItem(ARCHIVE_KEY);
    if (savedArchive) {
      try {
        const parsedArchive = JSON.parse(savedArchive);
        if (Array.isArray(parsedArchive)) {
          setArchivedProjects(parsedArchive);
        }
      } catch (error) {
        console.error("Error parsing project archive:", error);
        localStorage.removeItem(ARCHIVE_KEY);
      }
    }
  }, []);
  
  const saveArchive = (projects: Project[]) => {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(projects));
  };

  const saveProject = useCallback((proj: Project | null) => {
    if (!proj) return;
    
    setProject(proj);

    setArchivedProjects(prevArchive => {
      const existingIndex = prevArchive.findIndex(p => p.id === proj.id);
      let newArchive;
      if (existingIndex > -1) {
        newArchive = [...prevArchive];
        newArchive[existingIndex] = proj;
      } else {
        newArchive = [...prevArchive, proj];
      }
      saveArchive(newArchive);
      return newArchive;
    });
  }, []);

  const startNewProject = (title: string) => {
    const newProject: Project = {
      id: generateId(),
      projectTitle: title,
      topic: title,
      subtitle: '',
      author: '',
      description: '',
      metadataKeywords: [],
      categories: '',
      researchData: null,
      selectedSources: [],
      bookStructure: null,
      lastSaved: new Date().toISOString(),
      layoutTemplate: 'Classic',
      coverImage: null,
      coverOptions: [],
    };
    saveProject(newProject);
    setIsProjectStarted(true);
  };
  
  const loadProject = (projectId: string) => {
      const projectToLoad = archivedProjects.find(p => p.id === projectId);
      if (projectToLoad) {
          setProject(projectToLoad);
          setIsProjectStarted(true);
      }
  };

  const updateProject = useCallback((updates: Partial<Project>) => {
    if (!project) return;
    const updatedProject = { ...project, ...updates, lastSaved: new Date().toISOString() };
    saveProject(updatedProject);
  }, [project, saveProject]);

  const updateNodeContent = (nodeId: string, content: string) => {
    if (!project || !project.bookStructure) return;

    const newChapters = project.bookStructure.chapters.map(ch => {
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
    });

    updateProject({ bookStructure: { chapters: newChapters } });
  };

  const setBookStructure = (structure: BookStructure) => {
    // Hydrate structure with content fields if they are missing from the source (e.g., Gemini API)
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
    if (!project || !project.bookStructure) return;
    const newStructure = {
      ...project.bookStructure,
      chapters: project.bookStructure.chapters.map(ch => ch.id === chapterId ? { ...ch, title } : ch)
    };
    updateProject({ bookStructure: newStructure });
  };

  const updateSubchapterTitle = (subchapterId: string, title: string) => {
    if (!project || !project.bookStructure) return;
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
    if (!project || !project.bookStructure) return;
    
    const newStructure = {
      ...project.bookStructure,
      chapters: project.bookStructure.chapters.filter(ch => ch.id !== chapterId)
    };
    updateProject({ bookStructure: newStructure });
  };
  
  const addSubchapter = (chapterId: string) => {
    if (!project || !project.bookStructure) return;
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
    if (!project || !project.bookStructure) return;

    const newStructure = {
      ...project.bookStructure,
      chapters: project.bookStructure.chapters.map(ch => ({
        ...ch,
        subchapters: ch.subchapters.filter(sub => sub.id !== subchapterId)
      }))
    };
    updateProject({ bookStructure: newStructure });
  };
  
  const deleteProject = (projectId: string) => {
      setArchivedProjects(prevArchive => {
          const newArchive = prevArchive.filter(p => p.id !== projectId);
          saveArchive(newArchive);
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
    }}>
      {children}
    </ProjectContext.Provider>
  );
};