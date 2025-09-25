import React, { createContext, useState, useEffect, useCallback } from 'react';
import { Project } from '../types';

export interface ProjectContextType {
  project: Project | null;
  archivedProjects: Project[];
  isProjectStarted: boolean;
  startNewProject: (title: string) => void;
  loadProject: (projectId: string) => void;
  updateProject: (updates: Partial<Project>) => void;
  updateChapterContent: (chapterId: string, content: string) => void;
  archiveCurrentProject: (projectName: string) => void;
  deleteProject: (projectId: string) => void;
  endCurrentProject: () => void;
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
    // Carica l'archivio all'avvio
    const savedArchive = localStorage.getItem(ARCHIVE_KEY);
    if (savedArchive) {
      setArchivedProjects(JSON.parse(savedArchive));
    }
  }, []);
  
  const saveArchive = (projects: Project[]) => {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(projects));
  };

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
      chapterContents: {},
      lastSaved: new Date().toISOString(),
      layoutTemplate: 'Classic',
      coverImage: null,
      coverOptions: [],
    };
    setProject(newProject);
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
    setProject(prevProject => {
      if (!prevProject) return null;
      const updatedProject = { ...prevProject, ...updates, lastSaved: new Date().toISOString() };
      
      // Salva automaticamente il progetto attivo nell'archivio
      setArchivedProjects(prevArchive => {
        const existingIndex = prevArchive.findIndex(p => p.id === updatedProject.id);
        let newArchive;
        if (existingIndex > -1) {
          newArchive = [...prevArchive];
          newArchive[existingIndex] = updatedProject;
        } else {
          newArchive = [...prevArchive, updatedProject];
        }
        saveArchive(newArchive);
        return newArchive;
      });

      return updatedProject;
    });
  }, []);

  const updateChapterContent = (chapterId: string, content: string) => {
    if (project) {
      const updatedContents = { ...project.chapterContents, [chapterId]: content };
      updateProject({ chapterContents: updatedContents });
    }
  };
  
  const archiveCurrentProject = (projectName: string) => {
      if (!project) return;
      const updatedProject = { ...project, projectTitle: projectName, lastSaved: new Date().toISOString() };
      
      setArchivedProjects(prevArchive => {
          const existingIndex = prevArchive.findIndex(p => p.id === updatedProject.id);
          let newArchive;
          if (existingIndex > -1) {
              newArchive = [...prevArchive];
              newArchive[existingIndex] = updatedProject;
          } else {
              newArchive = [...prevArchive, updatedProject];
          }
          saveArchive(newArchive);
          return newArchive;
      });
      
      setProject(null);
      setIsProjectStarted(false);
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
      updateChapterContent,
      archiveCurrentProject,
      deleteProject,
      endCurrentProject
    }}>
      {children}
    </ProjectContext.Provider>
  );
};