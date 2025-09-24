
import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import PromptForm from './components/PromptForm';
import ImageDisplay from './components/ImageDisplay';
import { generateCosmicArt } from './services/geminiService';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = useCallback(async (prompt: string, style: string) => {
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const fullPrompt = `${prompt}, in a ${style} style`;
      const imageB64 = await generateCosmicArt(fullPrompt);
      setGeneratedImage(`data:image/jpeg;base64,${imageB64}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1e] to-[#000000] text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
      <div 
        className="fixed inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" 
        style={{ backgroundSize: 'auto' }}
      ></div>
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col gap-8">
        <Header />
        <main className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-1/3">
            <PromptForm onSubmit={handleGenerate} isLoading={isLoading} />
          </div>
          <div className="lg:w-2/3">
            <ImageDisplay 
              imageSrc={generatedImage}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
