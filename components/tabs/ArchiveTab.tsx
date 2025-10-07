import React from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';

const ArchiveTab: React.FC = () => {
    const { t } = useLocalization();
    const { project, updateProject } = useProject();

    if (!project) {
        return <Card><p>Loading project data...</p></Card>;
    }

    const {
        authorsArchive = [],
        titlesArchive = [],
        subtitlesArchive = [],
        descriptionsArchive = [],
        categoriesArchive = [],
        archivedCovers = [],
        coverPrompts = [],
    } = project;

    const ArchiveSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
        <section className="p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="text-lg font-semibold text-brand-dark border-b pb-2 mb-3">{title}</h3>
            {children}
        </section>
    );

    const ArchiveItem: React.FC<{ onUse: () => void; children: React.ReactNode }> = ({ onUse, children }) => (
        <div className="flex justify-between items-center p-2 bg-neutral-light rounded-md hover:bg-gray-200 transition-colors">
            <div className="text-neutral-dark pr-4 flex-grow">{children}</div>
            <button
                onClick={onUse}
                className="bg-brand-secondary hover:bg-brand-dark text-white font-semibold py-1 px-3 rounded-md text-sm transition-colors flex-shrink-0"
            >
                {t('archiveTab.useButton')}
            </button>
        </div>
    );

    return (
        <Card className="bg-neutral-light/50">
            <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('archiveTab.title')}</h2>
            <p className="text-neutral-medium mb-8">{t('archiveTab.description')}</p>

            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <ArchiveSection title={t('archiveTab.titlesTitle')}>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {titlesArchive.length > 0 ? (
                                    titlesArchive.map(item => (
                                        <ArchiveItem key={item} onUse={() => updateProject({ bookTitle: item })}>
                                            <p>{item}</p>
                                        </ArchiveItem>
                                    ))
                                ) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                            </div>
                        </ArchiveSection>
                        <ArchiveSection title={t('archiveTab.subtitlesTitle')}>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {subtitlesArchive.length > 0 ? (
                                    subtitlesArchive.map(item => (
                                        <ArchiveItem key={item} onUse={() => updateProject({ subtitle: item })}>
                                            <p>{item}</p>
                                        </ArchiveItem>
                                    ))
                                ) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                            </div>
                        </ArchiveSection>
                        <ArchiveSection title={t('archiveTab.authorsTitle')}>
                             <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {authorsArchive.length > 0 ? (
                                    authorsArchive.map(item => (
                                        <ArchiveItem key={item} onUse={() => updateProject({ author: item })}>
                                            <p>{item}</p>
                                        </ArchiveItem>
                                    ))
                                ) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                            </div>
                        </ArchiveSection>
                    </div>

                    <div className="space-y-6">
                        <ArchiveSection title={t('archiveTab.descriptionsTitle')}>
                             <div className="space-y-2 max-h-[20.5rem] overflow-y-auto pr-2">
                                {descriptionsArchive.length > 0 ? (
                                    descriptionsArchive.map((item, index) => (
                                        <ArchiveItem key={index} onUse={() => updateProject({ description: item })}>
                                            <p className="text-sm truncate">{item}</p>
                                        </ArchiveItem>
                                    ))
                                ) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                            </div>
                        </ArchiveSection>
                         <ArchiveSection title={t('archiveTab.categoriesTitle')}>
                             <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {categoriesArchive.length > 0 ? (
                                    categoriesArchive.map((item, index) => (
                                        <ArchiveItem key={index} onUse={() => updateProject({ categories: item })}>
                                            <p className="text-xs truncate">{item.join(', ')}</p>
                                        </ArchiveItem>
                                    ))
                                ) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                            </div>
                        </ArchiveSection>
                    </div>
                </div>

                <ArchiveSection title={t('archiveTab.coversTitle')}>
                    {archivedCovers.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {archivedCovers.map((cover, index) => (
                                <div key={index} className="relative group">
                                    <img 
                                        src={cover} 
                                        alt={`Archived cover ${index + 1}`}
                                        className="rounded-lg shadow-md w-full object-cover aspect-[3/4]"
                                    />
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => updateProject({ coverImage: cover })} className="bg-white/80 hover:bg-white text-brand-dark font-bold py-2 px-4 rounded-full">
                                            {t('archiveTab.useButton')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-neutral-medium text-sm">{t('archiveTab.noCovers')}</p>}
                </ArchiveSection>

                <ArchiveSection title={t('archiveTab.promptsTitle')}>
                    {coverPrompts.length > 0 ? (
                        <ul className="list-disc list-inside space-y-2 text-sm font-mono text-gray-700 max-h-60 overflow-y-auto">
                            {coverPrompts.map((prompt, index) => <li key={index}>{prompt}</li>)}
                        </ul>
                    ) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                </ArchiveSection>
            </div>
        </Card>
    );
};

export default ArchiveTab;