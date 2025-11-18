import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';
import { useToast } from '../../hooks/useToast';
import { generateAudioSegment, pcmToWav } from '../../services/geminiService';
import AudioIcon from '../icons/AudioIcon';

const AudiobookTab: React.FC = () => {
    const { t } = useLocalization();
    const { project } = useProject();
    const { showToast } = useToast();

    const [selectedContentId, setSelectedContentId] = useState<string>('full_manuscript');
    const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
    const [isGenerating, setIsGenerating] = useState(false);
    const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

    const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

    // Determine available content options
    const contentOptions = [
        { id: 'full_manuscript', label: t('audiobookTab.fullBook') },
        ...(project?.bookStructure?.chapters.map(ch => ({
            id: ch.id,
            label: `${t('structureTab.chapter')}: ${ch.title}`
        })) || [])
    ];

    useEffect(() => {
        // Cleanup object URL on unmount
        return () => {
            if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
        };
    }, [audioBlobUrl]);

    const getTextToConvert = (): string | null => {
        if (selectedContentId === 'full_manuscript') {
            return project?.manuscript?.regenerated || null;
        }
        const chapter = project?.bookStructure?.chapters.find(c => c.id === selectedContentId);
        if (chapter) {
            // Concatenate chapter title, content, and subchapters
            let text = `${chapter.title}.\n\n${chapter.content || ''}\n\n`;
            chapter.subchapters.forEach(sub => {
                text += `${sub.title}.\n${sub.content || ''}\n\n`;
            });
            // Strip HTML tags for cleaner TTS
            const div = document.createElement('div');
            div.innerHTML = text;
            return div.textContent || div.innerText || '';
        }
        return null;
    };

    const handleGenerateAudio = async () => {
        const text = getTextToConvert();
        if (!text || !text.trim()) {
            showToast(t('audiobookTab.noTextAvailable'), 'error');
            return;
        }

        // Simple length check warning - Gemini Flash TTS has limits
        if (text.length > 40000) {
             // This is just a heuristic. Real limits depend on tokens.
             showToast("Warning: Text might be too long for a single generation. Consider generating by chapter.", 'error');
        }

        setIsGenerating(true);
        setAudioBlobUrl(null); // Clear previous

        try {
            const pcmBuffer = await generateAudioSegment(text, selectedVoice);
            if (pcmBuffer) {
                const wavBuffer = pcmToWav(pcmBuffer);
                const blob = new Blob([wavBuffer], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                setAudioBlobUrl(url);
                showToast("Audio generated successfully!", "success");
            } else {
                throw new Error("No audio data returned");
            }
        } catch (error: any) {
            console.error("Audio generation failed:", error);
            showToast(t('apiErrors.generic'), 'error');
        } finally {
            setIsGenerating(false);
        }
    };

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                    <label htmlFor="content-select" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('audiobookTab.sourceLabel')}
                    </label>
                    <select
                        id="content-select"
                        value={selectedContentId}
                        onChange={(e) => setSelectedContentId(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none bg-white"
                        disabled={isGenerating}
                    >
                        {contentOptions.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="voice-select" className="block text-sm font-medium text-gray-700 mb-2">
                        {t('audiobookTab.voiceLabel')}
                    </label>
                    <select
                        id="voice-select"
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none bg-white"
                        disabled={isGenerating}
                    >
                        {voices.map(voice => (
                            <option key={voice} value={voice}>{voice}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex justify-center mb-8">
                <button
                    onClick={handleGenerateAudio}
                    disabled={isGenerating}
                    className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-8 rounded-lg transition-colors shadow-lg disabled:bg-neutral-medium disabled:cursor-not-allowed"
                >
                    {isGenerating ? <LoadingSpinner /> : `🎧 ${t('audiobookTab.generateButton')}`}
                </button>
            </div>

            {isGenerating && (
                <div className="text-center text-neutral-medium animate-pulse">
                    <p>{t('audiobookTab.generating')}</p>
                </div>
            )}

            {audioBlobUrl && (
                <div className="bg-neutral-light/50 border border-gray-200 rounded-lg p-6 animate-fade-in">
                    <h3 className="text-lg font-semibold text-brand-dark mb-4 text-center">{t('audiobookTab.audioPlayerTitle')}</h3>
                    <audio controls className="w-full mb-4" src={audioBlobUrl}>
                        Your browser does not support the audio element.
                    </audio>
                    <div className="flex justify-center">
                        <a
                            href={audioBlobUrl}
                            download={`${project?.projectTitle || 'audiobook'}_${selectedContentId}.wav`}
                            className="flex items-center gap-2 text-brand-primary font-semibold hover:underline"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            {t('audiobookTab.downloadWav')}
                        </a>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default AudiobookTab;