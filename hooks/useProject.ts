import { useContext } from 'react';
import { ProjectContext, ProjectContextType } from '../contexts/ProjectContext';


export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (!context) {
    // Fix: The original Italian error message caused parsing errors. Replaced with English equivalent.
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export { ProjectProvider } from '../contexts/ProjectContext';
