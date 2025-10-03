
import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateContentBlockText, generateContentBlockImage, generateContentBlockPrompt } from '../../services/geminiService';
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
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; text: string } | null>(null);
  
  useEffect(() => {
    if (selectedBlockId === 'new') {
        setCurrentBlock({
            type: 'recipe',
            title: '',
            description: '',
            textContent: '',
            image: null
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
    setGenerationProgress(null); // Reset on new generation

    // Bulk generation for new blocks
    if (selectedBlockId === 'new') {
        setGenerationProgress({ current: 0, total: numberOfItems, text: t('recipesTab.generating') });
        try {
            for (let i = 0; i < numberOfItems; i++) {
                const itemNumber = i + 1;
                const uniqueDescription = numberOfItems > 1 ? `${currentBlock.description} (variation ${itemNumber})` : currentBlock.description;

                // Update progress for the current item
                 setGenerationProgress({ 
                    current: itemNumber, 
                    total: numberOfItems, 
                    text: t('recipesTab.generatingItem', { current: itemNumber, total: numberOfItems, title: '...' })
                });

                // Generate text content for one item
                const textResults = await generateContentBlockText(project.topic, uniqueDescription, currentBlock.type, 1);

                if (textResults && textResults.length > 0) {
                    const item = textResults[0];
                    // Update progress text with the actual title
                    setGenerationProgress(prev => ({ ...prev!, text: t('recipesTab.generatingItem', { current: itemNumber, total: numberOfItems, title: item.title }) }));
                    
                    // Generate image for the item
                    const imageResult = await generateContentBlockImage(item.imagePrompt);

                    // Add the complete block to the project
                    addContentBlock({
                        type: currentBlock.type,
                        title: item.title,
                        description: currentBlock.description, // Store the original user prompt for reference
                        textContent: item.textContent,
                        image: imageResult
                    });
                    
                    // Add a delay between API calls to avoid rate limiting
                    if (i < numberOfItems - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } else {
                    console.warn(`Could not generate content for item ${itemNumber}. Skipping.`);
                }
            }
        } catch (error) {
            console.error("Error during bulk generation:", error);
        } finally {
            setGenerationProgress(null);
            setSelectedBlockId(null); // Return to the grid view after completion
        }
    } else { // Single regeneration for an existing block
        setCurrentBlock(prev => ({ ...prev, textContent: '', image: null }));
        try {
            const results = await generateContentBlockText(project.topic, currentBlock.description, currentBlock.type, 1);
            if (results && results.length > 0) {
                const item = results[0];
                const imageResult = await generateContentBlockImage(item.imagePrompt);
                setCurrentBlock(prev => ({
                    ...prev,
                    title: item.title,
                    // Note: 'description' is the user's prompt and should not be overwritten here.
                    textContent: item.textContent,
                    image: imageResult
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

  const isBusy = isLoading || isGeneratingPrompt || !!generationProgress;

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-dark">{t('recipesTab.title')}</h2>
        <p className="text-neutral-medium mt-1">{t('recipesTab.description')}</p>
      </div>

       {generationProgress && (
        <div className="my-4 p-3 bg-blue-100 border border-blue-300 rounded-md text-center animate-fade-in">
            <p className="font-semibold text-blue-800">{generationProgress.text}</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-linear" style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}></div>
            </div>
        </div>
      )}

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
                {isLoading || generationProgress ? <LoadingSpinner /> : `✨ ${t('recipesTab.generateButton')}`}
              </button>
              
              {isLoading && selectedBlockId !== 'new' && <p className="text-center mt-2 text-neutral-medium">{t('recipesTab.generating')}</p>}

              {(currentBlock.textContent || currentBlock.image) && (
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
                  <div>
                    <label className="block font-semibold">{t('recipesTab.generatedImage')}</label>
                    {currentBlock.image ? (
                        <img
                            src={`data:image/png;base64,${currentBlock.image}`}
                            alt={currentBlock.title}
                            className="mt-2 rounded-lg shadow-md border w-full max-w-sm"
                        />
                    ) : (
                        <div className="mt-2 h-48 w-full max-w-sm bg-gray-200 rounded-lg flex items-center justify-center">
                            <p className="text-neutral-medium">No image generated.</p>
                        </div>
                    )}
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
                                {block.image ? (
                                    <img src={`data:image/png;base64,${block.image}`} alt={block.title} className="w-full h-40 object-cover" />
                                ) : (
                                    <div className="w-full h-40 bg-gray-200 flex items-center justify-center">
                                        <span className="text-neutral-medium text-sm">No Image</span>
                                    </div>
                                )}
                                <div className="p-4">
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
