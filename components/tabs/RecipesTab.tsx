import React, { useState, useEffect, useRef } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateContentBlockText, generateContentBlockPrompt } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';
import PlusIcon from '../icons/PlusIcon';
import TrashIcon from '../icons/TrashIcon';
import type { ContentBlock, ContentBlockType } from '../../types';

const RecipesTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, addContentBlock, updateContentBlock, deleteContentBlock } = useProject();
  
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [currentBlock, setCurrentBlock] = useState<Partial<ContentBlock> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [numberOfItems, setNumberOfItems] = useState(1);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const generationMeta = useRef<{ initialCount: number } | null>(null);
  
  useEffect(() => {
    // Effect to select the first generated item after a bulk creation
    if (generationMeta.current && project) {
      const { initialCount } = generationMeta.current;
      if (project.contentBlocks.length > initialCount) {
        const firstNewBlock = project.contentBlocks[initialCount];
        if (firstNewBlock) {
          setSelectedBlockId(firstNewBlock.id);
        }
        generationMeta.current = null; // Reset the trigger
      }
    }
  }, [project?.contentBlocks]);

  useEffect(() => {
    if (selectedBlockId === 'new') {
        setCurrentBlock({
            type: 'recipe',
            title: '',
            description: '',
            textContent: '',
        });
    } else if (selectedBlockId) {
        const block = project?.contentBlocks.find(b => b.id === selectedBlockId);
        setCurrentBlock(block || null);
    } else {
        setCurrentBlock(null);
    }
  }, [selectedBlockId, project?.contentBlocks]);

  const handleFieldChange = (field: keyof ContentBlock, value: string) => {
    if (currentBlock) {
        setCurrentBlock({ ...currentBlock, [field]: value });
    }
  };
  
  const handleGeneratePrompt = async () => {
    if (!project?.topic || !currentBlock?.type) return;
    setIsGeneratingPrompt(true);
    try {
        const prompt = await generateContentBlockPrompt(project.topic, currentBlock.type);
        if (prompt) {
            handleFieldChange('description', prompt);
        }
    } catch (error) {
        console.error("Error generating prompt:", error);
    } finally {
        setIsGeneratingPrompt(false);
    }
  };

  const handleGenerate = async () => {
    if (!project?.topic || !currentBlock?.description || !currentBlock.type) return;

    setIsLoading(true);

    if (selectedBlockId === 'new') {
        generationMeta.current = { initialCount: project.contentBlocks.length };
        setGenerationProgress({ current: 0, total: numberOfItems, title: '' });
        const generatedTitles: string[] = [];
        try {
            for (let i = 0; i < numberOfItems; i++) {
                setGenerationProgress(prev => ({ ...prev!, current: i + 1, title: '' }));
                const generatedItems = await generateContentBlockText(
                    project.topic,
                    currentBlock.description,
                    currentBlock.type,
                    1,
                    generatedTitles
                );

                if (generatedItems && generatedItems.length > 0) {
                    const item = generatedItems[0];
                    setGenerationProgress(prev => ({ ...prev!, title: item.title }));
                    addContentBlock({
                        type: currentBlock.type!,
                        title: item.title,
                        description: currentBlock.description!,
                        textContent: item.textContent,
                    });
                    generatedTitles.push(item.title);
                } else {
                    console.warn(`Failed to generate item ${i + 1}/${numberOfItems}. Stopping.`);
                    break;
                }
                
                if (i < numberOfItems - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }
        } catch (error) {
            console.error("Error during bulk generation:", error);
            generationMeta.current = null;
        } finally {
            setGenerationProgress(null);
        }
    } else {
        setCurrentBlock(prev => ({ ...prev, textContent: '' }));
        try {
            const results = await generateContentBlockText(project.topic, currentBlock.description, currentBlock.type, 1);
            if (results && results.length > 0) {
                const item = results[0];
                setCurrentBlock(prev => ({
                    ...prev,
                    title: item.title,
                    textContent: item.textContent,
                }));
            }
        } catch (error) {
            console.error("Error regenerating content block:", error);
        }
    }
    setIsLoading(false);
  };
  
  const handleSave = () => {
    if (!currentBlock || !currentBlock.type || !currentBlock.title) return;
    if (currentBlock.id) {
        updateContentBlock(currentBlock as ContentBlock);
    }
  };
  
  const handleDelete = () => {
    if (currentBlock?.id) {
        deleteContentBlock(currentBlock.id);
        setSelectedBlockId(null);
    }
  };

  const contentBlocks = project?.contentBlocks || [];
  const currentIndex = contentBlocks.findIndex(b => b.id === selectedBlockId);
  const totalBlocks = contentBlocks.length;

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (currentIndex === -1 || totalBlocks <= 1) return;
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < totalBlocks) {
      setSelectedBlockId(contentBlocks[newIndex].id);
    }
  };

  const isBusy = isLoading || isGeneratingPrompt || !!generationProgress;

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-dark">{t('recipesTab.title')}</h2>
        <p className="text-neutral-medium mt-1">{t('recipesTab.description')}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-1/3 lg:w-1/4 p-4 bg-neutral-light rounded-lg border">
          <h3 className="font-semibold text-lg mb-3 text-brand-dark">{t('tabs.content')}</h3>
          <button
            onClick={() => setSelectedBlockId('new')}
            className="w-full flex items-center justify-center gap-2 mb-4 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            <PlusIcon /> {t('recipesTab.newBlock')}
          </button>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {project?.contentBlocks.map(block => (
              <button
                key={block.id}
                onClick={() => setSelectedBlockId(block.id)}
                className={`w-full text-left p-2 rounded truncate ${selectedBlockId === block.id ? 'bg-brand-accent/30 font-semibold' : 'hover:bg-gray-200'}`}
              >
                {block.title}
              </button>
            ))}
          </div>
        </aside>

        <main className="w-full md:w-2/3 lg:w-3/4">
          {currentBlock ? (
            <div className="space-y-4 animate-fade-in">
              {selectedBlockId && selectedBlockId !== 'new' && totalBlocks > 1 && currentIndex > -1 && (
                  <div className="flex items-center justify-between p-2 bg-neutral-light rounded-md mb-4 border">
                    <button
                      onClick={() => handleNavigate('prev')}
                      disabled={currentIndex === 0}
                      className="px-4 py-1 text-sm font-semibold bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      &larr; {t('recipesTab.prevBlock')}
                    </button>
                    <span className="font-semibold text-sm text-neutral-dark">
                      {t('recipesTab.blockOf', { current: currentIndex + 1, total: totalBlocks })}
                    </span>
                    <button
                      onClick={() => handleNavigate('next')}
                      disabled={currentIndex === totalBlocks - 1}
                      className="px-4 py-1 text-sm font-semibold bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('recipesTab.nextBlock')} &rarr;
                    </button>
                  </div>
                )}

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-grow">
                  <label className="block text-sm font-medium text-gray-700">{t('recipesTab.selectType')}</label>
                  <div className="flex gap-4 mt-1">
                    {(['recipe', 'exercise'] as ContentBlockType[]).map(type => (
                      <label key={type} className="flex items-center">
                        <input
                          type="radio"
                          name="contentType"
                          value={type}
                          checked={currentBlock.type === type}
                          onChange={() => handleFieldChange('type', type)}
                          className="h-4 w-4 text-brand-primary border-gray-300 focus:ring-brand-light"
                          disabled={isBusy}
                        />
                        <span className="ml-2 capitalize">{t(`recipesTab.${type}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                 {selectedBlockId === 'new' && (
                    <div className="flex-shrink-0">
                        <label htmlFor="item-count" className="block text-sm font-medium text-gray-700">{t('recipesTab.itemCount')}</label>
                        <input
                            type="number"
                            id="item-count"
                            value={numberOfItems}
                            onChange={e => setNumberOfItems(Math.max(1, parseInt(e.target.value, 10)))}
                            min="1"
                            max="10"
                            className="w-24 p-2 mt-1 border border-gray-300 rounded-md"
                            disabled={isBusy}
                        />
                    </div>
                 )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">Prompt</label>
                    <button onClick={handleGeneratePrompt} disabled={isBusy} className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1 disabled:opacity-50">
                        {isGeneratingPrompt ? <LoadingSpinner className="animate-spin h-4 w-4 text-brand-primary"/> : '✨'}
                        {isGeneratingPrompt ? t('recipesTab.generatingPrompt') : t('recipesTab.generatePrompt')}
                    </button>
                </div>
                <textarea
                  value={currentBlock.description}
                  onChange={e => handleFieldChange('description', e.target.value)}
                  placeholder={t('recipesTab.descriptionPlaceholder')}
                  rows={4}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none"
                  disabled={isBusy}
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={isBusy || !currentBlock.description}
                className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors shadow disabled:bg-neutral-medium"
              >
                {isLoading ? <LoadingSpinner /> : `✨ ${t('recipesTab.generateButton')}`}
              </button>
              
              {generationProgress && (
                <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-md text-center animate-fade-in">
                    <p className="font-semibold text-blue-800">
                        {t('recipesTab.generating')} {generationProgress.current} / {generationProgress.total}
                    </p>
                    {generationProgress.title && <p className="text-sm text-blue-700 h-5 truncate">✅ {generationProgress.title}</p>}
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                        <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-linear" 
                        style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}>
                        </div>
                    </div>
                </div>
              )}

              {isLoading && !generationProgress && <p className="text-center mt-2 text-neutral-medium">{t('recipesTab.generating')}</p>}

              {currentBlock.textContent && (
                <div className="mt-4 space-y-4 pt-4 border-t">
                  <div>
                    <label className="block font-semibold">{t('recipesTab.editTitle')}</label>
                    <input
                      type="text"
                      value={currentBlock.title}
                      onChange={e => handleFieldChange('title', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold">{t('recipesTab.generatedText')}</label>
                    <textarea
                      value={currentBlock.textContent}
                      onChange={e => handleFieldChange('textContent', e.target.value)}
                      rows={10}
                      className="w-full p-2 border border-gray-300 rounded-md whitespace-pre-wrap"
                    />
                  </div>
                   <div className="flex gap-4 pt-4 border-t">
                    <button
                        onClick={handleSave}
                        disabled={!currentBlock.title || selectedBlockId === 'new'}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors shadow disabled:bg-neutral-medium"
                    >
                       {t('recipesTab.saveButton')}
                    </button>
                    {currentBlock.id && (
                         <button
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded-md transition-colors shadow"
                        >
                            <TrashIcon />
                        </button>
                    )}
                </div>
                </div>
              )}
            </div>
            ) : project && project.contentBlocks.length > 0 ? (
                <div className="animate-fade-in">
                    <h3 className="text-xl font-bold text-brand-dark mb-4">{t('recipesTab.title')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {project.contentBlocks.map(block => (
                            <button 
                                key={block.id} 
                                onClick={() => setSelectedBlockId(block.id)}
                                className="border rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:ring-2 hover:ring-brand-light transition-all text-left"
                            >
                                <div className="w-full h-40 bg-neutral-light/50 p-4 flex flex-col justify-start text-clip overflow-hidden">
                                  <p className="text-sm text-neutral-dark italic" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 6, overflow: 'hidden' }}>
                                    {block.textContent}
                                  </p>
                                </div>
                                <div className="p-4 border-t bg-white">
                                    <h4 className="font-semibold text-brand-dark truncate">{block.title}</h4>
                                    <p className="text-sm text-neutral-medium capitalize">{t(`recipesTab.${block.type}`)}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
            <div className="flex items-center justify-center h-96 bg-neutral-light rounded-lg border-2 border-dashed">
              <p className="text-neutral-medium text-center">{t('recipesTab.selectBlock')}</p>
            </div>
          )}
        </main>
      </div>
    </Card>
  );
};

export default RecipesTab;
