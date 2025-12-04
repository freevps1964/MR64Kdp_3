import React, { useState, useEffect, useRef } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { generateAudioSegment, pcmToWav, parseChaptersFromMarkdown } from '../../services/geminiService';
import AudioIcon from '../icons/AudioIcon';
import SparklesIcon from '../icons/SparklesIcon';

interface ChapterAudio {
    title: string;
    content: string;
    audioBlobUrl: string | null;
    status: 'idle' | 'generating' | 'success' | 'error';
}

const AudiobookTab: React.FC = () => {
    const { t } = useLocalization();
    const { project } = useProject();
    const { showToast } = useToast();

    const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
    const [chapters, setChapters] = useState<ChapterAudio[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const isGeneratingAllRef = useRef(false);

    const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const regeneratedText = project?.manuscript?.regenerated;

    useEffect(() => {
        // Automatically parse chapters when the tab loads if we have a regenerated manuscript
        if (regeneratedText) {
            setIsParsing(true);
            const parsed = parseChaptersFromMarkdown(regeneratedText);
            
            // Initialize state based on parsed chapters
            // We preserve existing audio URLs if the title matches (simple caching mechanism)
            setChapters(prevChapters => {
                return parsed.map(p => {
                    const existing = prevChapters.find(c => c.title === p.title);
                    return {
                        title: p.title,
                        content: p.content,
                        audioBlobUrl: existing ? existing.audioBlobUrl : null,
                        status: existing ? existing.status : 'idle'
                    };
                });
            });
            setSelectedIndices(new Set()); // Reset selection on new parse
            setIsParsing(false);
        } else {
            setChapters([]);
            setSelectedIndices(new Set());
        }
    }, [regeneratedText]);

    useEffect(() => {
        // Cleanup object URLs on unmount
        return () => {
            chapters.forEach(ch => {
                if (ch.audioBlobUrl) URL.revokeObjectURL(ch.audioBlobUrl);
            });
        };
    }, []); // Empty dependency ensures cleanup on unmount

    const handleToggleSelect = (index: number) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedIndices(newSet);
    };

    const handleSelectAll = () => {
        if (selectedIndices.size === chapters.length) {
            setSelectedIndices(new Set());
        } else {
            const allIndices = new Set(chapters.map((_, i) => i));
            setSelectedIndices(allIndices);
        }
    };

    const handleDownloadSelected = async () => {
        const selectedList = Array.from(selectedIndices).sort((a: number, b: number) => a - b);
        const readyToDownload = selectedList.filter(i => chapters[i].audioBlobUrl);

        if (readyToDownload.length === 0) {
            showToast("Nessun audio pronto tra i capitoli selezionati.", 'error');
            return;
        }

        showToast(`Avvio download di ${readyToDownload.length} file...`, 'success');

        for (const index of readyToDownload) {
            const chapter = chapters[index];
            if (chapter.audioBlobUrl) {
                handleDownload(chapter.audioBlobUrl, chapter.title);
                // Small delay to allow browser to process downloads without blocking
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }
    };

    const handleGenerateChapterAudio = async (index: number) => {
        const chapter = chapters[index];
        if (!chapter.content || !chapter.content.trim()) {
            showToast("Contenuto vuoto per questo capitolo.", 'error');
            return;
        }

        // Update status to generating
        setChapters(prev => prev.map((c, i) => i === index ? { ...c, status: 'generating' } : c));

        try {
            const pcmBuffer = await generateAudioSegment(chapter.content, selectedVoice);
            if (pcmBuffer) {
                const wavBuffer = pcmToWav(pcmBuffer);
                const blob = new Blob([wavBuffer], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                
                // Update state with new URL
                setChapters(prev => prev.map((c, i) => i === index ? { ...c, status: 'success', audioBlobUrl: url } : c));
                if (!isGeneratingAllRef.current) {
                    showToast(`Audio generato per: ${chapter.title}`, "success");
                }
            } else {
                throw new Error("Nessun dato audio restituito");
            }
        } catch (error: any) {
            console.error(`Errore generazione audio capitolo ${index}:`, error);
            setChapters(prev => prev.map((c, i) => i === index ? { ...c, status: 'error' } : c));
            if (!isGeneratingAllRef.current) {
                showToast(t('apiErrors.generic'), 'error');
            }
        }
    };

    const handleGenerateAll = async () => {
        if (isGeneratingAllRef.current) {
            // Stop requested
            isGeneratingAllRef.current = false;
            setIsGeneratingAll(false);
            showToast("Generazione di massa interrotta.", "success");
            return;
        }

        if (chapters.length === 0) return;

        const hasExistingAudio = chapters.some(ch => ch.audioBlobUrl);
        if (hasExistingAudio) {
            if (!window.confirm("Alcuni capitoli hanno già un audio. Vuoi rigenerarli tutti con la voce selezionata?")) {
                return;
            }
        }

        isGeneratingAllRef.current = true;
        setIsGeneratingAll(true);
        showToast("Avvio generazione di tutti i capitoli...", "success");

        for (let i = 0; i < chapters.length; i++) {
            if (!isGeneratingAllRef.current) break;
            
            // Skip if already generating (unlikely unless race condition)
            if (chapters[i].status === 'generating') continue;

            await handleGenerateChapterAudio(i);

            // Delay to avoid rate limiting and ensure smooth UI
            if (i < chapters.length - 1 && isGeneratingAllRef.current) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        isGeneratingAllRef.current = false;
        setIsGeneratingAll(false);
        showToast("Generazione completa terminata.", "success");
    };

    const handleDownload = (url: string, title: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project?.projectTitle || 'audiobook'} - ${title}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (!regeneratedText) {
         return (
            <Card>
                <div className="flex flex-col items-center justify-center p-10 text-center space-y-4">
                    <div className="p-4 bg-gray-100 rounded-full text-gray-400">
                        <AudioIcon className="w-12 h-12" />
                    </div>
                    <h2 className="text-xl font-bold text-neutral-dark">Nessun Manoscritto Trovato</h2>
                    <p className="text-neutral-medium max-w-md">
                        Per creare l'audiolibro, devi prima completare la fase di <strong>Revisione</strong> e generare il manoscritto finale.
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div className="flex items-center gap-3 mb-6">
                 <div className="p-2 bg-brand-light/20 rounded-full text-brand-primary">
                    <AudioIcon className="w-8 h-8" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-bold text-brand-dark">{t('audiobookTab.title')}</h2>
                    <p className="text-neutral-medium">{t('audiobookTab.description')}</p>
                 </div>
            </div>

            <div className="mb-8 p-4 bg-neutral-light/50 rounded-lg border border-gray-200">
                <label htmlFor="voice-select" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('audiobookTab.voiceLabel')}
                </label>
                <div className="flex flex-wrap gap-3">
                    {voices.map(voice => (
                        <button
                            key={voice}
                            onClick={() => setSelectedVoice(voice)}
                            disabled={isGeneratingAll}
                            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                                selectedVoice === voice 
                                ? 'bg-brand-primary text-white shadow-md' 
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            } ${isGeneratingAll ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {selectedVoice === voice ? '✓ ' : ''}{voice}
                        </button>
                    ))}
                </div>
            </div>

            {isParsing ? (
                <div className="text-center py-10">
                    <LoadingSpinner className="w-8 h-8 text-brand-primary mx-auto mb-2" />
                    <p className="text-neutral-medium">Analisi dei capitoli in corso...</p>
                </div>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm sticky top-20 z-10">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 rounded text-brand-primary focus:ring-brand-light border-gray-300"
                                checked={chapters.length > 0 && selectedIndices.size === chapters.length}
                                onChange={handleSelectAll}
                                disabled={chapters.length === 0 || isGeneratingAll}
                            />
                            <span className="font-semibold text-neutral-dark">Seleziona Tutti</span>
                        </label>
                        
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <button 
                                onClick={handleGenerateAll}
                                disabled={chapters.length === 0}
                                className={`flex items-center justify-center gap-2 text-white font-bold py-2 px-4 rounded-md transition-colors shadow-sm w-full sm:w-auto ${
                                    isGeneratingAll 
                                    ? 'bg-red-500 hover:bg-red-600' 
                                    : 'bg-brand-accent hover:bg-yellow-500 text-brand-dark'
                                }`}
                            >
                                {isGeneratingAll ? (
                                    <>
                                        <LoadingSpinner /> Stop Generazione
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon /> Genera Tutto
                                    </>
                                )}
                            </button>

                            <button 
                                onClick={handleDownloadSelected}
                                disabled={selectedIndices.size === 0 || isGeneratingAll}
                                className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                Scarica Selezionati ({selectedIndices.size})
                            </button>
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-brand-dark mb-4 border-b pb-2">
                        Capitoli Rilevati ({chapters.length})
                    </h3>
                    
                    {chapters.map((chapter, index) => (
                        <div key={index} className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-all ${selectedIndices.has(index) ? 'border-brand-primary ring-1 ring-brand-primary bg-brand-light/5' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 rounded text-brand-primary focus:ring-brand-light border-gray-300"
                                        checked={selectedIndices.has(index)}
                                        onChange={() => handleToggleSelect(index)}
                                        disabled={isGeneratingAll}
                                    />
                                </div>
                                
                                <div className="flex-grow min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="bg-brand-light/10 text-brand-primary text-xs font-bold px-2 py-1 rounded flex-shrink-0">
                                            #{index + 1}
                                        </span>
                                        <h4 className="font-bold text-neutral-dark truncate">{chapter.title}</h4>
                                    </div>
                                    <p className="text-xs text-neutral-medium mt-1 truncate">
                                        {chapter.content.substring(0, 80)}...
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
                                    {chapter.status === 'generating' ? (
                                        <div className="flex items-center gap-2 text-brand-primary text-sm font-medium px-4 py-2 bg-brand-light/5 rounded-md">
                                            <LoadingSpinner className="w-4 h-4" />
                                            <span className="hidden sm:inline">Generazione...</span>
                                        </div>
                                    ) : chapter.audioBlobUrl ? (
                                        <div className="flex items-center gap-3">
                                            <audio controls src={chapter.audioBlobUrl} className="h-8 w-32 sm:w-48" />
                                            <button 
                                                onClick={() => handleDownload(chapter.audioBlobUrl!, chapter.title)}
                                                className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-50"
                                                title="Scarica WAV"
                                                disabled={isGeneratingAll}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                             <button 
                                                onClick={() => handleGenerateChapterAudio(index)}
                                                className="text-xs text-neutral-medium hover:text-brand-primary underline"
                                                title="Rigenera Audio"
                                                disabled={isGeneratingAll}
                                            >
                                                ↻
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleGenerateChapterAudio(index)}
                                            disabled={isGeneratingAll}
                                            className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-secondary text-white text-sm font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <AudioIcon className="w-4 h-4" />
                                            <span className="hidden sm:inline">Genera</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            {chapter.status === 'error' && (
                                <p className="text-xs text-red-600 mt-2 ml-9">Errore durante la generazione. Riprova.</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};

export default AudiobookTab;