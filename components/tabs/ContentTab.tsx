import React, { useState, useEffect, useRef } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateContentStream, processTextWithGemini } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';
import RichTextEditor from '../common/RichTextEditor';
import type { Chapter, SubChapter, ToneOfVoice, TargetAudience, WritingStyle } from '../../types';
import SparklesIcon from '../icons/SparklesIcon';

const countWords = (html: string) => {
    if (!html) return 0;
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.trim().split(/\s+/).filter(Boolean).length;
};

const ContentTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateNodeContent } = useProject();
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{ running: boolean; current: number; total: number; nodeTitle: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const [tone, setTone] = useState<ToneOfVoice>('Informal');
  const [audience, setAudience] = useState<TargetAudience>('Beginners');
  const [style, setStyle] = useState<WritingStyle>('Expository');
  const [wordCount, setWordCount] = useState<number>(1000);

  const isSavingRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);
  
  const structure = project?.bookStructure;

  const getSelectedItem = () => {
    if (!selectedChapterId || !structure) return null;
    for (const chapter of structure.chapters) {
      if (chapter.id === selectedChapterId) return chapter;
      const subchapter = chapter.subchapters.find(sub => sub.id === selectedChapterId);
      if (subchapter) return subchapter;
    }
    return null;
  };

  const selectedItem = getSelectedItem();
    
  const parentChapter = selectedChapterId && structure
    ? structure.chapters.find(c => c.subchapters.some(s => s.id === selectedChapterId) || c.id === selectedChapterId)
    : null;


  useEffect(() => {
    const item = getSelectedItem();
    setContent(item?.content || '');
  }, [selectedChapterId, structure]);
  
  useEffect(() => {
    // Funzione di pulizia per cancellare il timeout quando il componente si smonta
    return () => {
        if(saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
    }
  }, []);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    isSavingRef.current = true;
    
    // Cancella il timeout precedente se esiste
    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }
    
    // Imposta un nuovo timeout per salvare dopo 1 secondo di inattività
    saveTimeoutRef.current = window.setTimeout(() => {
        if (selectedChapterId) {
            updateNodeContent(selectedChapterId, newContent);
            isSavingRef.current = false;
        }
    }, 1000);
  };

  const handleGenerate = async (isRegeneration = false) => {
    if (!project?.topic || !selectedItem || !parentChapter) return;

    setIsGenerating(true);
    let initialContent = '';
    if (isRegeneration) {
        // To regenerate, we need the plain text content, not HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        initialContent = tempDiv.textContent || tempDiv.innerText || '';
    } else {
        setContent('');
    }
    
    const isSubchapter = parentChapter.id !== selectedItem.id;

    try {
      const stream = await generateContentStream(
        project.topic, 
        parentChapter.title, 
        isSubchapter ? selectedItem.title : undefined,
        wordCount,
        project.researchData?.keywords,
        tone,
        audience,
        style,
        isRegeneration ? initialContent : undefined
      );

      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk.text;
        setContent(fullText.replace(/\n/g, '<br />'));
      }
      handleContentChange(fullText.replace(/\n/g, '<br />'));

    } catch (error) {
      console.error("Error generating content:", error);
      setContent(`<p style="color: red;">${t('contentTab.error')}</p>`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleGenerateAll = async () => {
    if (!project?.topic || !structure) return;

    const allNodes: { node: Chapter | SubChapter; parent: Chapter }[] = [];
    structure.chapters.forEach(ch => {
        if (ch.subchapters.length === 0) {
            if (ch.title.trim()) allNodes.push({ node: ch, parent: ch });
        } else {
            ch.subchapters.forEach(sub => {
                if (sub.title.trim()) allNodes.push({ node: sub, parent: ch });
            });
        }
    });

    if (allNodes.length === 0) return;

    setGenerationStatus({ running: true, current: 0, total: allNodes.length, nodeTitle: '' });

    for (let i = 0; i < allNodes.length; i++) {
        const { node, parent } = allNodes[i];
        setGenerationStatus(prev => ({ ...prev!, current: i + 1, nodeTitle: node.title }));

        const isSubchapter = node.id !== parent.id;

        try {
            const stream = await generateContentStream(
                project.topic,
                parent.title,
                isSubchapter ? (node as SubChapter).title : undefined,
                wordCount,
                project.researchData?.keywords,
                tone,
                audience,
                style
            );

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.text;
                if (node.id === selectedChapterId) {
                    setContent(fullText.replace(/\n/g, '<br />'));
                }
            }
            updateNodeContent(node.id, fullText.replace(/\n/g, '<br />'));

        } catch (error) {
            console.error(`Error generating content for ${node.title}:`, error);
            const errorMsg = `<p style="color: red;">// ERROR: ${t('contentTab.error')}</p>`;
            updateNodeContent(node.id, errorMsg);
            if (node.id === selectedChapterId) {
                setContent(errorMsg);
            }
        }
        
        // Add a delay between requests to avoid rate limiting
        if (i < allNodes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 61000)); // 61-second delay
        }
    }
    setGenerationStatus(null);
  };
  
  const handleProcessText = async (action: 'improve' | 'summarize' | 'expand') => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';

    if (!plainText.trim()) return;

    setIsProcessing(action);
    try {
        const result = await processTextWithGemini(plainText, action);
        handleContentChange(result.replace(/\n/g, '<br />')); 
    } catch (error) {
        console.error(`Error processing text: ${action}`, error);
        // TODO: show a toast notification
    } finally {
        setIsProcessing(null);
    }
  };

  const isBusy = isGenerating || !!generationStatus?.running || !!isProcessing;
  
  const currentWordCount = countWords(content);
  const progress = wordCount > 0 ? Math.min((currentWordCount / wordCount) * 100, 100) : 0;
  const isTargetMet = wordCount > 0 && currentWordCount >= wordCount;

  const GenerationOptions = () => (
    <div className={`mt-4 p-4 border border-gray-200 rounded-lg bg-neutral-light/50 ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}>
        <h4 className="font-semibold text-brand-dark mb-3">{t('contentTab.options.title')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
                <label htmlFor="tone-select" className="block text-sm font-medium text-gray-700">{t('contentTab.options.tone')}</label>
                <select 
                    id="tone-select" 
                    value={tone} 
                    onChange={(e) => setTone(e.target.value as ToneOfVoice)}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                >
                    <option value="Informal">{t('contentTab.options.tones.Informal')}</option>
                    <option value="Formal">{t('contentTab.options.tones.Formal')}</option>
                    <option value="Academic">{t('contentTab.options.tones.Academic')}</option>
                    <option value="Persuasive">{t('contentTab.options.tones.Persuasive')}</option>
                    <option value="Empathetic">{t('contentTab.options.tones.Empathetic')}</option>
                    <option value="Humorous">{t('contentTab.options.tones.Humorous')}</option>
                    <option value="Professional">{t('contentTab.options.tones.Professional')}</option>
                    <option value="Enthusiastic">{t('contentTab.options.tones.Enthusiastic')}</option>
                </select>
            </div>
            <div>
                <label htmlFor="audience-select" className="block text-sm font-medium text-gray-700">{t('contentTab.options.audience')}</label>
                <select 
                    id="audience-select" 
                    value={audience} 
                    onChange={(e) => setAudience(e.target.value as TargetAudience)}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                >
                    <option value="Beginners">{t('contentTab.options.audiences.Beginners')}</option>
                    <option value="Experts">{t('contentTab.options.audiences.Experts')}</option>
                    <option value="General">{t('contentTab.options.audiences.General')}</option>
                </select>
            </div>
            <div>
                <label htmlFor="style-select" className="block text-sm font-medium text-gray-700">{t('contentTab.options.style')}</label>
                <select 
                    id="style-select" 
                    value={style} 
                    onChange={(e) => setStyle(e.target.value as WritingStyle)}
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                >
                    <option value="Descriptive">{t('contentTab.options.styles.Descriptive')}</option>
                    <option value="Narrative">{t('contentTab.options.styles.Narrative')}</option>
                    <option value="Expository">{t('contentTab.options.styles.Expository')}</option>
                    <option value="Argumentative">{t('contentTab.options.styles.Argumentative')}</option>
                    <option value="Poetic">{t('contentTab.options.styles.Poetic')}</option>
                    <option value="Technical">{t('contentTab.options.styles.Technical')}</option>
                    <option value="Conversational">{t('contentTab.options.styles.Conversational')}</option>
                    <option value="Journalistic">{t('contentTab.options.styles.Journalistic')}</option>
                </select>
            </div>
        </div>
    </div>
  );
  
  const AIToolButton: React.FC<{ action: 'improve' | 'summarize' | 'expand', label: string }> = ({ action, label }) => (
    <button
        onClick={() => handleProcessText(action)}
        disabled={isBusy || countWords(content) === 0}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-brand-dark bg-white border border-gray-300 rounded-md shadow-sm hover:bg-neutral-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {isProcessing === action ? <LoadingSpinner className="h-4 w-4 text-brand-dark" /> : <SparklesIcon className="h-4 w-4 text-brand-accent" />}
        {label}
    </button>
  );

  return (
    <Card>
       <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-brand-dark">{t('contentTab.title')}</h2>
            <p className="text-neutral-medium mt-1">
                {t('contentTab.description')}
            </p>
          </div>
          <button
              onClick={handleGenerateAll}
              disabled={isBusy || !structure?.chapters?.length}
              className="flex-shrink-0 flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
          >
              {generationStatus?.running ? <LoadingSpinner /> : '🚀 ' + t('contentTab.generateAllButton')}
          </button>
      </div>
      
      {generationStatus?.running && (
        <div className="my-4 p-3 bg-blue-100 border border-blue-300 rounded-md text-center animate-fade-in">
            <p className="font-semibold text-blue-800">{t('contentTab.generatingAll')}</p>
            <p className="text-sm text-blue-700">{t('contentTab.generatingProgress', { nodeTitle: generationStatus.nodeTitle, current: generationStatus.current, total: generationStatus.total })}</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-linear" style={{ width: `${(generationStatus.current / generationStatus.total) * 100}%` }}></div>
            </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar della Struttura */}
        <aside className={`w-full md:w-1/3 lg:w-1/4 p-4 bg-neutral-light rounded-lg border transition-opacity ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="font-semibold text-lg mb-3 text-brand-dark">{t('tabs.structure')}</h3>
          {structure?.chapters.map(chapter => (
            <div key={chapter.id} className="mb-3">
              <button
                onClick={() => setSelectedChapterId(chapter.id)}
                className={`w-full text-left font-bold p-2 rounded ${selectedChapterId === chapter.id ? 'bg-brand-accent/30' : 'hover:bg-gray-200'}`}
              >
                {chapter.title}
              </button>
              <ul className="ml-4 mt-1 border-l-2 border-gray-200">
                {chapter.subchapters.map(sub => (
                  <li key={sub.id}>
                    <button
                      onClick={() => setSelectedChapterId(sub.id)}
                      className={`w-full text-left p-2 text-sm ${selectedChapterId === sub.id ? 'bg-brand-accent/30' : 'hover:bg-gray-200'}`}
                    >
                      {sub.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>

        {/* Area Contenuto Principale */}
        <main className="w-full md:w-2/3 lg:w-3/4">
          {selectedChapterId && selectedItem ? (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-semibold text-brand-primary">{selectedItem.title}</h3>
                <div className="flex items-center gap-2">
                    {content && (
                      <button
                        onClick={() => handleGenerate(true)}
                        disabled={isBusy}
                        className="flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-md transition-colors shadow disabled:bg-neutral-medium"
                        title={t('contentTab.regenerateButton')}
                      >
                        {isGenerating && content ? <LoadingSpinner /> : '♻️'}
                      </button>
                    )}
                    <button
                      onClick={() => handleGenerate(false)}
                      disabled={isBusy}
                      className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors shadow disabled:bg-neutral-medium"
                    >
                      {isGenerating ? <LoadingSpinner /> : '✨ ' + t('contentTab.generateButton')}
                    </button>
                </div>
              </div>
              
              <GenerationOptions />

              <div className="mt-4">
                <RichTextEditor
                    value={content}
                    onChange={handleContentChange}
                    placeholder={isGenerating ? t('contentTab.generating') : ''}
                    disabled={isBusy}
                />
              </div>
              
               <div className="mt-4 p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-neutral-dark">AI Writing Tools:</span>
                      <div className="flex items-center gap-2">
                          <AIToolButton action="improve" label="Migliora" />
                          <AIToolButton action="summarize" label="Riassumi" />
                          <AIToolButton action="expand" label="Espandi" />
                      </div>
                  </div>
                   <div className="flex items-center justify-end flex-wrap gap-4 text-sm text-neutral-medium">
                        <div className="flex items-center gap-2">
                            <label htmlFor="word-count-target" className="font-semibold">{t('contentTab.options.wordCount')}:</label>
                            <input
                                id="word-count-target"
                                type="number"
                                value={wordCount}
                                onChange={(e) => setWordCount(parseInt(e.target.value, 10) || 0)}
                                className="w-20 p-1 border border-gray-300 rounded-md text-center bg-white"
                                min="0"
                                step="50"
                                disabled={isBusy}
                            />
                        </div>
                        <div className="flex items-center gap-2 w-48">
                            <span className={`font-semibold tabular-nums ${isTargetMet ? 'text-green-600' : ''}`}>
                                {t('contentTab.wordCountProgress', { current: currentWordCount, target: wordCount })}
                            </span>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div 
                                className={`h-2.5 rounded-full transition-all duration-300 ${isTargetMet ? 'bg-green-500' : 'bg-brand-primary'}`} 
                                style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-neutral-light rounded-lg border-2 border-dashed">
              <p className="text-neutral-medium">{t('contentTab.placeholder')}</p>
            </div>
          )}
        </main>
      </div>
    </Card>
  );
};

export default ContentTab;