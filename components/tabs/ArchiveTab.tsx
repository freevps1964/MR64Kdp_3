
import React from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';

const ArchiveTab: React.FC = () => {
    const { t } = useLocalization();
    const { project } = useProject();

    if (!project) {
        return (
            <Card>
                <p>Loading project data...</p>
            </Card>
        );
    }

    const {
        bookTitle,
        subtitle,
        author,
        description,
        categories,
        researchData,
        archivedCovers,
        coverPrompts
    } = project;

    return (
        <Card>
            <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('archiveTab.title')}</h2>
            <p className="text-neutral-medium mb-8">{t('archiveTab.description')}</p>

            <div className="space-y-8">
                {/* Final Metadata Section */}
                <section>
                    <h3 className="text-xl font-semibold text-brand-dark border-b pb-2 mb-4">{t('archiveTab.metadataTitle')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-500">{t('archiveTab.bookTitle')}</label>
                            <p className="mt-1 text-lg text-gray-900">{bookTitle || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">{t('archiveTab.subtitle')}</label>
                            <p className="mt-1 text-gray-700">{subtitle || 'N/A'}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-500">{t('archiveTab.author')}</label>
                            <p className="mt-1 text-gray-700">{author || 'N/A'}</p>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-gray-500">{t('archiveTab.categories')}</label>
                            <p className="mt-1 text-gray-700">{categories?.join(', ') || 'N/A'}</p>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-500">{t('archiveTab.descriptionLabel')}</label>
                            <p className="mt-1 text-gray-700 whitespace-pre-wrap">{description || 'N/A'}</p>
                        </div>
                    </div>
                </section>
                
                {/* Generated Suggestions Section */}
                {researchData && (
                    <section>
                        <h3 className="text-xl font-semibold text-brand-dark border-b pb-2 mb-4">{t('archiveTab.suggestionsTitle')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="font-semibold text-lg text-neutral-dark mb-2">{t('archiveTab.suggestedTitles')}</h4>
                                <ul className="list-disc list-inside space-y-1 text-gray-700">
                                    {researchData.titles.map(t => <li key={t.title}>{t.title}</li>)}
                                </ul>
                            </div>
                            <div>
                                 <h4 className="font-semibold text-lg text-neutral-dark mb-2">{t('archiveTab.suggestedSubtitles')}</h4>
                                 <ul className="list-disc list-inside space-y-1 text-gray-700">
                                    {researchData.subtitles.map(s => <li key={s.subtitle}>{s.subtitle}</li>)}
                                </ul>
                            </div>
                        </div>
                    </section>
                )}

                {/* Favorite Covers Section */}
                <section>
                    <h3 className="text-xl font-semibold text-brand-dark border-b pb-2 mb-4">{t('archiveTab.coversTitle')}</h3>
                    {archivedCovers && archivedCovers.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                            {archivedCovers.map((cover, index) => (
                                <div key={index}>
                                    <img 
                                        src={`data:image/png;base64,${cover}`} 
                                        alt={`Archived cover ${index + 1}`}
                                        className="rounded-lg shadow-lg w-full object-cover aspect-[3/4]"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-neutral-medium">{t('archiveTab.noCovers')}</p>
                    )}
                    {coverPrompts && coverPrompts.length > 0 && (
                         <div className="mt-6">
                            <h4 className="font-semibold text-lg text-neutral-dark mb-2">{t('archiveTab.promptLabel')}</h4>
                            <ul className="list-disc list-inside space-y-2 bg-neutral-light p-4 rounded-md">
                                {coverPrompts.map((p, i) => <li key={i} className="text-gray-700 font-mono text-sm">{p}</li>)}
                            </ul>
                        </div>
                    )}
                </section>

            </div>
        </Card>
    );
};

export default ArchiveTab;
