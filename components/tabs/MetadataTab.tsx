import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import { fetchAmazonCategories, generateDescription } from '../../services/geminiService';
import LoadingSpinner from '../icons/LoadingSpinner';
import type { Keyword, Project, TitleSuggestion, SubtitleSuggestion } from '../../types';
import { useToast } from '../../hooks/useToast';

const MetadataTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject, addAuthorToArchive } = useProject();
  const { showToast } = useToast();

  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [isFetchingCategories, setIsFetchingCategories] = useState(false);
  const [amazonCategories, setAmazonCategories] = useState<string[]>([]);

  useEffect(() => {
    if (project && (project.metadataKeywords?.length || 0) === 0 && (project.researchData?.keywords?.length || 0) > 0) {
        updateProject({ metadataKeywords: project.researchData!.keywords });
    }
  }, [project?.researchData, project?.metadataKeywords, updateProject]);
  
  const handleFetchCategories = async () => {
    if (isFetchingCategories) return;
    setIsFetchingCategories(true);
    try {
        const cats = await fetchAmazonCategories();
        setAmazonCategories(cats);
    } catch (error) {
        console.error("Failed to fetch categories:", error);
    } finally {
        setIsFetchingCategories(false);
    }
  };

  // Carica le categorie al montaggio del componente per garantire che le selezioni vengano visualizzate
  useEffect(() => {
    handleFetchCategories();
  }, []);


  const handleFieldChange = (updates: Partial<Project>) => {
    if (project) {
      updateProject(updates);
    }
  };

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keywordsArray: Keyword[] = e.target.value
      .split(',')
      .map(k => ({ keyword: k.trim(), relevance: 0 }))
      .filter(k => k.keyword);
    updateProject({ metadataKeywords: keywordsArray });
  };
  
  const handleCategoriesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
    updateProject({ categories: selectedOptions });
  };

  const handleGenerateDescription = async () => {
    if (!project || !project.bookTitle) return;
    setIsGeneratingDesc(true);
    try {
        const desc = await generateDescription(project.bookTitle, project.bookStructure);
        const newArchive = project.descriptionsArchive.includes(desc) 
            ? project.descriptionsArchive 
            : [...project.descriptionsArchive, desc];
        updateProject({ description: desc, descriptionsArchive: newArchive });
    } catch (error) {
        console.error(error);
    } finally {
        setIsGeneratingDesc(false);
    }
  };
  
  const handleSaveMetadata = () => {
    if (!project) return;
    
    addAuthorToArchive(project.author);

    const updates: Partial<Project> = {};

    if (project.bookTitle && !project.titlesArchive.includes(project.bookTitle)) {
        updates.titlesArchive = [...project.titlesArchive, project.bookTitle];
    }
    if (project.subtitle && !project.subtitlesArchive.includes(project.subtitle)) {
        updates.subtitlesArchive = [...project.subtitlesArchive, project.subtitle];
    }
    if (project.description && !project.descriptionsArchive.includes(project.description)) {
        updates.descriptionsArchive = [...project.descriptionsArchive, project.description];
    }
    
    const categoriesString = JSON.stringify(project.categories.slice().sort());
    const isCategoriesInArchive = project.categoriesArchive.some(c => JSON.stringify(c.slice().sort()) === categoriesString);
    if (project.categories.length > 0 && !isCategoriesInArchive) {
        updates.categoriesArchive = [...project.categoriesArchive, project.categories];
    }

    updateProject(updates);
    showToast(t('metadataTab.saveSuccess'), 'success');
  };

  if (!project) return null;

  const researchTitles: TitleSuggestion[] = project.researchData?.titles || [];
  const researchSubtitles: SubtitleSuggestion[] = project.researchData?.subtitles || [];

  const titleOptions = [...researchTitles];
  if (project.bookTitle && !titleOptions.some(t => t.title === project.bookTitle)) {
      titleOptions.unshift({ title: project.bookTitle, relevance: 0 });
  }

  const subtitleOptions = [...researchSubtitles];
  if (project.subtitle && !subtitleOptions.some(s => s.subtitle === project.subtitle)) {
      subtitleOptions.unshift({ subtitle: project.subtitle, relevance: 0 });
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('metadataTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('metadataTab.description')}
      </p>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="bookTitle" className="block font-semibold mb-1">{t('metadataTab.bookTitle')}</label>
              <select
                id="bookTitle"
                name="bookTitle"
                value={project.bookTitle}
                onChange={(e) => handleFieldChange({ bookTitle: e.target.value })}
                className="w-full p-2 border rounded-md bg-white"
              >
                <option value="">{t('metadataTab.selectTitle')}</option>
                {titleOptions.map(t => <option key={t.title} value={t.title}>{t.title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="subtitle" className="block font-semibold mb-1">{t('metadataTab.subtitle')}</label>
              <select
                id="subtitle"
                name="subtitle"
                value={project.subtitle}
                onChange={(e) => handleFieldChange({ subtitle: e.target.value })}
                className="w-full p-2 border rounded-md bg-white"
              >
                <option value="">{t('metadataTab.selectSubtitle')}</option>
                {subtitleOptions.map(s => <option key={s.subtitle} value={s.subtitle}>{s.subtitle}</option>)}
              </select>
            </div>
        </div>
        <div>
          <label htmlFor="author" className="block font-semibold mb-1">{t('metadataTab.author')}</label>
          <input
            type="text"
            id="author"
            name="author"
            list="authors-list"
            value={project.author}
            onChange={(e) => handleFieldChange({ author: e.target.value })}
            onBlur={(e) => addAuthorToArchive(e.target.value)}
            className="w-full p-2 border rounded-md"
            placeholder={t('metadataTab.authorArchiveHint')}
          />
           <datalist id="authors-list">
            {(project.authorsArchive || []).map(author => (
                <option key={author} value={author} />
            ))}
          </datalist>
        </div>
        <div>
            <div className="flex justify-between items-center mb-1">
                 <label htmlFor="description" className="block font-semibold">{t('metadataTab.descriptionLabel')}</label>
                 <button onClick={handleGenerateDescription} disabled={isGeneratingDesc} className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1 disabled:opacity-50">
                    {isGeneratingDesc ? <LoadingSpinner className="animate-spin h-5 w-5 text-brand-primary" /> : '✨'}
                    {t('metadataTab.generateDescription')}
                 </button>
            </div>
            <textarea
                id="description"
                name="description"
                value={project.description}
                onChange={(e) => handleFieldChange({ description: e.target.value })}
                rows={6}
                className="w-full p-2 border rounded-md"
            ></textarea>
        </div>
        <div>
          <label htmlFor="metadataKeywords" className="block font-semibold mb-1">{t('metadataTab.kdpKeywords')}</label>
          <input
            type="text"
            id="metadataKeywords"
            name="metadataKeywords"
            value={project.metadataKeywords.map(k => k.keyword).join(', ')}
            onChange={handleKeywordsChange}
            className="w-full p-2 border rounded-md"
          />
        </div>
        <div>
            <div className="flex justify-between items-center mb-1">
                <label htmlFor="categories" className="block font-semibold">{t('metadataTab.categories')}</label>
                <button onClick={handleFetchCategories} disabled={isFetchingCategories} className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1 disabled:opacity-50">
                {isFetchingCategories ? <LoadingSpinner className="animate-spin h-5 w-5 text-brand-primary" /> : '🔄'}
                {isFetchingCategories ? t('metadataTab.fetchingCategories') : t('metadataTab.fetchCategories')}
                </button>
            </div>
            <select
                id="categories"
                name="categories"
                multiple
                value={project.categories}
                onChange={handleCategoriesChange}
                className="w-full p-2 border rounded-md h-40 bg-white"
                disabled={isFetchingCategories}
            >
                {amazonCategories.length > 0 ? (
                    amazonCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)
                ) : (
                    <option disabled>{isFetchingCategories ? t('metadataTab.fetchingCategories') : 'Nessuna categoria caricata'}</option>
                )}
            </select>
        </div>

        <div className="mt-8 pt-6 border-t text-right">
            <button
            onClick={handleSaveMetadata}
            className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-6 rounded-md transition-colors shadow"
            >
            {t('metadataTab.saveButton')}
            </button>
        </div>
      </div>
    </Card>
  );
};

export default MetadataTab;