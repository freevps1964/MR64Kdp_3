import { useContext } from 'react';
import { ProjectContext, ProjectContextType } from '../contexts/ProjectContext';


export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export { ProjectProvider } from '../contexts/ProjectContext';
