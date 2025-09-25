import React, { useState, useEffect, useRef } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateContentStream } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';
import type { Chapter, SubChapter } from '../../types';

const ContentTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateNodeContent } = useProject();
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{ running: boolean; current: number; total: number; nodeTitle: string } | null>(null);

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

  const handleGenerate = async () => {
    if (!project?.topic || !selectedItem || !parentChapter) return;

    setIsGenerating(true);
    setContent('');
    
    const isSubchapter = parentChapter.id !== selectedItem.id;

    try {
      const stream = await generateContentStream(
        project.topic, 
        parentChapter.title, 
        isSubchapter ? selectedItem.title : undefined
      );

      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk.text;
        setContent(fullText);
      }
      handleContentChange(fullText);

    } catch (error) {
      console.error("Error generating content:", error);
      setContent(t('contentTab.error'));
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
                5000
            );

            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.text;
                if (node.id === selectedChapterId) {
                    setContent(fullText); // Live update for selected item
                }
            }
            updateNodeContent(node.id, fullText);

        } catch (error) {
            console.error(`Error generating content for ${node.title}:`, error);
            const errorMsg = t('contentTab.error');
            updateNodeContent(node.id, `// ERROR: ${errorMsg}`);
            if (node.id === selectedChapterId) {
                setContent(`// ERROR: ${errorMsg}`);
            }
        }
        
        // Add a delay between requests to avoid rate limiting
        if (i < allNodes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5-second delay
        }
    }
    setGenerationStatus(null);
  };

  const isBusy = isGenerating || !!generationStatus?.running;

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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-brand-primary">{selectedItem.title}</h3>
                <button
                  onClick={handleGenerate}
                  disabled={isBusy}
                  className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors shadow disabled:bg-neutral-medium"
                >
                  {isGenerating ? <LoadingSpinner /> : '✨ ' + t('contentTab.generateButton')}
                </button>
              </div>
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder={isGenerating ? t('contentTab.generating') : ''}
                className="w-full h-96 p-4 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none"
                readOnly={isBusy}
              />
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
