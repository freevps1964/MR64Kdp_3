import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import { generateDescription } from '../../services/geminiService';
import LoadingSpinner from '../icons/LoadingSpinner';

const MetadataTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();

  const [formData, setFormData] = useState({
    projectTitle: '',
    subtitle: '',
    author: '',
    description: '',
    metadataKeywords: '',
    categories: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (project) {
      setFormData({
        projectTitle: project.projectTitle || '',
        subtitle: project.subtitle || '',
        author: project.author || '',
        description: project.description || '',
        metadataKeywords: project.metadataKeywords?.map(k => k.keyword).join(', ') || '',
        categories: project.categories || '',
      });
    }
  }, [project]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBlur = () => {
    // Salva i dati quando l'utente lascia un campo
    updateProject({
        ...formData,
        metadataKeywords: formData.metadataKeywords.split(',').map(k => ({ keyword: k.trim() })).filter(k => k.keyword),
    });
  };

  const handleGenerateDescription = async () => {
    if (!project) return;
    setIsGenerating(true);
    try {
        const desc = await generateDescription(project.projectTitle, project.bookStructure);
        setFormData(prev => ({ ...prev, description: desc }));
        updateProject({ description: desc });
    } catch (error) {
        console.error(error);
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('metadataTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('metadataTab.description')}
      </p>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="projectTitle" className="block font-semibold mb-1">{t('metadataTab.projectTitle')}</label>
              <input type="text" id="projectTitle" name="projectTitle" value={formData.projectTitle} onChange={handleChange} onBlur={handleBlur} className="w-full p-2 border rounded-md" />
            </div>
            <div>
              <label htmlFor="subtitle" className="block font-semibold mb-1">{t('metadataTab.subtitle')}</label>
              <input type="text" id="subtitle" name="subtitle" value={formData.subtitle} onChange={handleChange} onBlur={handleBlur} className="w-full p-2 border rounded-md" />
            </div>
        </div>
        <div>
          <label htmlFor="author" className="block font-semibold mb-1">{t('metadataTab.author')}</label>
          <input type="text" id="author" name="author" value={formData.author} onChange={handleChange} onBlur={handleBlur} className="w-full p-2 border rounded-md" />
        </div>
        <div>
            <div className="flex justify-between items-center mb-1">
                 <label htmlFor="description" className="block font-semibold">{t('metadataTab.descriptionLabel')}</label>
                 <button onClick={handleGenerateDescription} disabled={isGenerating} className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1 disabled:opacity-50">
                    {isGenerating ? <LoadingSpinner /> : '✨'}
                    {t('metadataTab.generateDescription')}
                 </button>
            </div>
            <textarea id="description" name="description" value={formData.description} onChange={handleChange} onBlur={handleBlur} rows={6} className="w-full p-2 border rounded-md"></textarea>
        </div>
        <div>
          <label htmlFor="metadataKeywords" className="block font-semibold mb-1">{t('metadataTab.kdpKeywords')}</label>
          <input type="text" id="metadataKeywords" name="metadataKeywords" value={formData.metadataKeywords} onChange={handleChange} onBlur={handleBlur} className="w-full p-2 border rounded-md" />
        </div>
        <div>
          <label htmlFor="categories" className="block font-semibold mb-1">{t('metadataTab.categories')}</label>
          <input type="text" id="categories" name="categories" value={formData.categories} onChange={handleChange} onBlur={handleBlur} className="w-full p-2 border rounded-md" />
        </div>
      </div>
    </Card>
  );
};

export default MetadataTab;
