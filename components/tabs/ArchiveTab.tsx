import React, { useState, useMemo, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import type { GlossaryTerm } from '../../types';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';


const GlossaryManager: React.FC = () => {
    const { t } = useLocalization();
    const { project, addGlossaryTerm, updateGlossaryTerm, deleteGlossaryTerm } = useProject();
    
    const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTerm, setCurrentTerm] = useState('');
    const [currentDefinition, setCurrentDefinition] = useState('');

    const glossary = project?.glossary || [];

    const filteredAndSortedGlossary = useMemo(() => {
        return glossary
            .filter(item => item.term.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.term.localeCompare(b.term));
    }, [glossary, searchTerm]);

    useEffect(() => {
        if (selectedTermId) {
            const term = glossary.find(t => t.id === selectedTermId);
            if (term) {
                setCurrentTerm(term.term);
                setCurrentDefinition(term.definition);
            } else {
                handleNewTerm();
            }
        } else {
            handleNewTerm();
        }
    }, [selectedTermId, glossary]);

    const handleSelectTerm = (term: GlossaryTerm) => setSelectedTermId(term.id);
    const handleNewTerm = () => {
        setSelectedTermId(null);
        setCurrentTerm('');
        setCurrentDefinition('');
    };

    const handleSave = () => {
        if (!currentTerm.trim() || !currentDefinition.trim()) {
            alert(t('archiveTab.glossary.errorEmpty'));
            return;
        }
        if (selectedTermId) {
            updateGlossaryTerm({ id: selectedTermId, term: currentTerm, definition: currentDefinition });
        } else {
            addGlossaryTerm({ term: currentTerm, definition: currentDefinition });
            handleNewTerm();
        }
    };

    const handleDelete = () => {
        if (selectedTermId && window.confirm(t('archiveTab.glossary.confirmDelete', { term: currentTerm }))) {
            deleteGlossaryTerm(selectedTermId);
            handleNewTerm();
        }
    };
    
    const isFormDirty = useMemo(() => {
        if (!selectedTermId) return currentTerm.trim() !== '' || currentDefinition.trim() !== '';
        const selectedTerm = glossary.find(t => t.id === selectedTermId);
        if (!selectedTerm) return false;
        return selectedTerm.term !== currentTerm || selectedTerm.definition !== currentDefinition;
    }, [selectedTermId, currentTerm, currentDefinition, glossary]);

    return (
        <div>
            <p className="text-neutral-medium mb-6">{t('archiveTab.glossary.description')}</p>
            <div className="flex flex-col md:flex-row gap-6">
                <aside className="w-full md:w-1/3 p-4 bg-neutral-light rounded-lg border">
                    <div className="flex justify-between items-center mb-3">
                         <h3 className="font-semibold text-lg text-brand-dark">{t('archiveTab.glossary.termList')}</h3>
                         <button onClick={handleNewTerm} className="p-1 text-brand-primary hover:bg-brand-light/20 rounded-full" title={t('archiveTab.glossary.newTerm')}>
                            <PlusIcon />
                         </button>
                    </div>
                    <input
                        type="text"
                        placeholder={t('archiveTab.glossary.searchPlaceholder')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md mb-3"
                    />
                    <div className="space-y-1 max-h-96 overflow-y-auto pr-2">
                        {filteredAndSortedGlossary.length > 0 ? (
                            filteredAndSortedGlossary.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelectTerm(item)}
                                    className={`w-full text-left p-2 rounded truncate ${selectedTermId === item.id ? 'bg-brand-accent/30 font-semibold' : 'hover:bg-gray-200'}`}
                                >
                                    {item.term}
                                </button>
                            ))
                        ) : (
                            <p className="text-sm text-neutral-medium text-center py-4">{t('archiveTab.glossary.noTerms')}</p>
                        )}
                    </div>
                </aside>
                <main className="w-full md:w-2/3">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="term-input" className="block font-semibold text-neutral-dark mb-1">{t('archiveTab.glossary.termLabel')}</label>
                            <input
                                id="term-input" type="text" value={currentTerm}
                                onChange={e => setCurrentTerm(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label htmlFor="definition-input" className="block font-semibold text-neutral-dark mb-1">{t('archiveTab.glossary.definitionLabel')}</label>
                            <textarea
                                id="definition-input" value={currentDefinition}
                                onChange={e => setCurrentDefinition(e.target.value)}
                                rows={8} className="w-full p-2 border border-gray-300 rounded-md"
                            ></textarea>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleSave} disabled={!isFormDirty}
                                className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-6 rounded-md transition-colors shadow disabled:bg-neutral-medium"
                            >
                                {selectedTermId ? t('archiveTab.glossary.saveChanges') : t('archiveTab.glossary.addTerm')}
                            </button>
                            {selectedTermId && (
                                <button
                                    onClick={handleDelete}
                                    className="bg-red-600 hover:bg-red-800 text-white font-bold p-2 rounded-md transition-colors shadow"
                                    title={t('archiveTab.glossary.deleteTerm')}
                                >
                                    <TrashIcon />
                                </button>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

const AssetsArchive: React.FC = () => {
    const { t } = useLocalization();
    const { project, updateProject } = useProject();
    if (!project) return null;

    const {
        authorsArchive = [], titlesArchive = [], subtitlesArchive = [],
        descriptionsArchive = [], categoriesArchive = [], archivedCovers = [],
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
            <button onClick={onUse} className="bg-brand-secondary hover:bg-brand-dark text-white font-semibold py-1 px-3 rounded-md text-sm transition-colors flex-shrink-0">
                {t('archiveTab.useButton')}
            </button>
        </div>
    );
    
    return (
         <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <ArchiveSection title={t('archiveTab.titlesTitle')}>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {titlesArchive.length > 0 ? titlesArchive.map(item => (
                                <ArchiveItem key={item} onUse={() => updateProject({ bookTitle: item })}><p>{item}</p></ArchiveItem>
                            )) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                        </div>
                    </ArchiveSection>
                    <ArchiveSection title={t('archiveTab.subtitlesTitle')}>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {subtitlesArchive.length > 0 ? subtitlesArchive.map(item => (
                                <ArchiveItem key={item} onUse={() => updateProject({ subtitle: item })}><p>{item}</p></ArchiveItem>
                            )) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                        </div>
                    </ArchiveSection>
                    <ArchiveSection title={t('archiveTab.authorsTitle')}>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {authorsArchive.length > 0 ? authorsArchive.map(item => (
                                <ArchiveItem key={item} onUse={() => updateProject({ author: item })}><p>{item}</p></ArchiveItem>
                            )) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                        </div>
                    </ArchiveSection>
                </div>
                <div className="space-y-6">
                    <ArchiveSection title={t('archiveTab.descriptionsTitle')}>
                            <div className="space-y-2 max-h-[20.5rem] overflow-y-auto pr-2">
                            {descriptionsArchive.length > 0 ? descriptionsArchive.map((item, index) => (
                                <ArchiveItem key={index} onUse={() => updateProject({ description: item })}><p className="text-sm truncate">{item}</p></ArchiveItem>
                            )) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                        </div>
                    </ArchiveSection>
                        <ArchiveSection title={t('archiveTab.categoriesTitle')}>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {categoriesArchive.length > 0 ? categoriesArchive.map((item, index) => (
                                <ArchiveItem key={index} onUse={() => updateProject({ categories: item })}><p className="text-xs truncate">{item.join(', ')}</p></ArchiveItem>
                            )) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
                        </div>
                    </ArchiveSection>
                </div>
            </div>
            <ArchiveSection title={t('archiveTab.coversTitle')}>
                {archivedCovers.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {archivedCovers.map((cover, index) => (
                            <div key={index} className="relative group">
                                <img src={cover} alt={`Archived cover ${index + 1}`} className="rounded-lg shadow-md w-full object-cover aspect-[3/4]" />
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => updateProject({ coverImage: cover })} className="bg-white/80 hover:bg-white text-brand-dark font-bold py-2 px-4 rounded-full">
                                        {t('archiveTab.useButton')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
            </ArchiveSection>
            <ArchiveSection title={t('archiveTab.promptsTitle')}>
                {coverPrompts.length > 0 ? (
                    <ul className="list-disc list-inside space-y-2 text-sm font-mono text-gray-700 max-h-60 overflow-y-auto">
                        {coverPrompts.map((prompt, index) => <li key={index}>{prompt}</li>)}
                    </ul>
                ) : <p className="text-neutral-medium text-sm">{t('archiveTab.noItems')}</p>}
            </ArchiveSection>
        </div>
    );
};

const ArchiveTab: React.FC = () => {
    const { t } = useLocalization();
    const { project } = useProject();
    const [activeSubTab, setActiveSubTab] = useState<'assets' | 'glossary'>('assets');

    if (!project) {
        return <Card><p>Loading project data...</p></Card>;
    }
    
    const SubTabButton: React.FC<{ tabId: 'assets' | 'glossary'; label: string }> = ({ tabId, label }) => (
      <button
        onClick={() => setActiveSubTab(tabId)}
        className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
          activeSubTab === tabId
            ? 'border-brand-primary text-brand-primary'
            : 'border-transparent text-neutral-medium hover:text-brand-dark'
        }`}
      >
        {label}
      </button>
    );

    return (
        <Card className="bg-neutral-light/50">
            <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('archiveTab.title')}</h2>
            
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-4">
                    <SubTabButton tabId="assets" label={t('archiveTab.assetsSubTab')} />
                    <SubTabButton tabId="glossary" label={t('archiveTab.glossarySubTab')} />
                </nav>
            </div>

            {activeSubTab === 'assets' ? <AssetsArchive /> : <GlossaryManager />}
        </Card>
    );
};

export default ArchiveTab;
