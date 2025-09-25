import React from 'react';
import { useProject } from '../hooks/useProject';
import { useLocalization } from '../hooks/useLocalization';
import LoadingSpinner from './icons/LoadingSpinner';

const WelcomeScreen: React.FC = () => {
    const { startNewProject, archivedProjects, loadProject, deleteProject } = useProject();
    const { t } = useLocalization();

    const handleStartProject = () => {
        startNewProject(t('project.defaultTitle'));
    };

    const handleDelete = (projectId: string, projectTitle: string) => {
        if (window.confirm(t('welcome.confirmDelete', { title: projectTitle }))) {
            deleteProject(projectId);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 max-w-4xl mx-auto mt-10 animate-fade-in">
            <div className="w-full text-center bg-white p-8 rounded-lg shadow-xl mb-8">
                <h1 className="text-4xl font-bold text-brand-dark mb-4">{t('welcome.title')}</h1>
                <p className="text-lg text-neutral-medium mb-8">
                    {t('welcome.description')}
                </p>
                <button
                    onClick={handleStartProject}
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-lg"
                >
                    {t('welcome.startProject')}
                </button>
            </div>

            {archivedProjects.length > 0 && (
                <div className="w-full bg-white p-8 rounded-lg shadow-xl">
                    <h2 className="text-2xl font-bold text-brand-dark mb-6 text-center">{t('welcome.archiveTitle')}</h2>
                    <div className="space-y-4">
                        {archivedProjects.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-4 bg-neutral-light rounded-md border border-gray-200">
                                <div>
                                    <h3 className="font-semibold text-lg text-neutral-dark">{p.projectTitle}</h3>
                                    <p className="text-sm text-neutral-medium">{t('welcome.lastSaved')}: {new Date(p.lastSaved).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => loadProject(p.id)}
                                        className="bg-brand-secondary hover:bg-brand-dark text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors"
                                    >
                                        {t('welcome.loadProject')}
                                    </button>
                                     <button
                                        onClick={() => handleDelete(p.id, p.projectTitle)}
                                        className="bg-red-600 hover:bg-red-800 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors"
                                    >
                                        {t('welcome.deleteProject')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default WelcomeScreen;