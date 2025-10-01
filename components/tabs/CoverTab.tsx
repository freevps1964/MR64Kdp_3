import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateCoverImages, generateCoverPromptFromBestsellers } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';

const CoverTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();
  
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMetadataComplete = !!(project?.bookTitle && project?.subtitle && project?.author && project?.categories && project?.categories.length > 0);

  useEffect(() => {
    if (project) {
        const defaultPrompt = `Copertina di un libro intitolato "${project.bookTitle || 'Senza Titolo'}" sull'argomento "${project.topic || 'argomento generico'}". Stile pulito, moderno e accattivante.`;
        setPrompt(defaultPrompt);
    }
  }, [project?.bookTitle, project?.topic, t]);
  
  /**
 * Disegna un testo a capo su un canvas 2D.
 * @returns La posizione y della riga successiva sotto il testo disegnato.
 */
  const wrapText = (
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): number => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        context.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, currentY);
    return currentY + lineHeight;
  };

  /**
   * Aggiunge il titolo, il sottotitolo e l'autore a un'immagine di copertina utilizzando il canvas.
   */
  const addTextToImage = (base64Image: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!project) {
        return reject("Dati del progetto non disponibili");
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const canvasWidth = 1200; // Larghezza ad alta risoluzione
        const canvasHeight = 1600; // Altezza (rapporto 3:4)
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject('Impossibile ottenere il contesto del canvas');
        }

        // Disegna l'immagine generata come sfondo
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        // Stili del testo (bianco con ombra per la leggibilità)
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const margin = canvasWidth * 0.1;
        const contentWidth = canvasWidth - margin * 2;

        // Disegna il Titolo
        const title = project.bookTitle.toUpperCase();
        let titleFontSize = 100;
        ctx.font = `bold ${titleFontSize}px 'Montserrat', sans-serif`;
        while (ctx.measureText(title).width > contentWidth && titleFontSize > 20) {
            titleFontSize -= 5;
            ctx.font = `bold ${titleFontSize}px 'Montserrat', sans-serif`;
        }
        const titleY = canvasHeight * 0.15;
        const subtitleY = wrapText(ctx, title, canvasWidth / 2, titleY, contentWidth, titleFontSize * 1.1);
        
        // Disegna il Sottotitolo (se esiste)
        if (project.subtitle) {
            let subtitleFontSize = 40;
            ctx.font = `italic ${subtitleFontSize}px 'EB Garamond', serif`;
            while (ctx.measureText(project.subtitle).width > contentWidth && subtitleFontSize > 15) {
                subtitleFontSize -= 2;
                ctx.font = `italic ${subtitleFontSize}px 'EB Garamond', serif`;
            }
            wrapText(ctx, project.subtitle, canvasWidth / 2, subtitleY, contentWidth, subtitleFontSize * 1.2);
        }

        // Disegna l'Autore in basso
        if (project.author) {
            ctx.font = `600 48px 'Montserrat', sans-serif`;
            const authorY = canvasHeight * 0.9;
            ctx.fillText(project.author, canvasWidth / 2, authorY);
        }
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (err) => reject(err);
      img.src = `data:image/png;base64,${base64Image}`;
    });
  };


  const handleGeneratePrompt = async () => {
    if (!isMetadataComplete) {
      setError("Per favore, compila Titolo, Sottotitolo, Autore e Categoria nella scheda Metadati prima di generare un prompt.");
      return;
    }
    if (!project?.topic) return;
    setIsGeneratingPrompt(true);
    setError(null);
    try {
        const generatedPrompt = await generateCoverPromptFromBestsellers(
          project.topic, 
          project.bookTitle,
          project.researchData?.keywords || [],
          project.categories[0] // Use first category
        );
        setPrompt(generatedPrompt);
    } catch (err) {
        console.error("Error generating prompt:", err);
        setError("Failed to generate prompt. Please try again.");
    } finally {
        setIsGeneratingPrompt(false);
    }
  };

  const handleGenerate = async () => {
     if (!isMetadataComplete) {
      setError("Per favore, compila Titolo, Sottotitolo, Autore e Categoria nella scheda Metadati prima di generare le copertine.");
      return;
    }
    if (!prompt) return;
    setIsLoading(true);
    setError(null);
    updateProject({ coverOptions: [], coverImage: null });

    try {
      const response = await generateCoverImages(prompt);
      const base64Images = response.generatedImages.map(img => img.image.imageBytes);
      
      // Aggiungi testo a ciascuna immagine generata
      const coversWithText = await Promise.all(
          base64Images.map(base64 => addTextToImage(base64))
      );

      // Rimuovi il prefisso data URL prima di salvare nello stato
      const finalCovers = coversWithText.map(dataUrl => dataUrl.replace('data:image/png;base64,', ''));

      updateProject({ 
          coverOptions: finalCovers,
          coverImage: finalCovers[0] || null // Seleziona la prima copertina per impostazione predefinita
      });

    } catch (err) {
      console.error("Error generating covers:", err);
      setError("Impossibile generare le copertine. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectCover = (base64Image: string) => {
    updateProject({ coverImage: base64Image });
  };

  const handleDownloadCover = (base64Image: string, index: number) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${base64Image}`;
    link.download = `${project?.projectTitle?.replace(/ /g, '_') || 'cover'}-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <h2 className="text-2xl font-bold text-brand-dark mb-4">{t('coverTab.title')}</h2>
      <p className="text-neutral-medium mb-6">
        {t('coverTab.description')}
      </p>

      {!isMetadataComplete && (
        <div className="p-4 mb-6 text-sm text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-lg" role="alert">
          <span className="font-bold">Attenzione:</span> Per generare una copertina efficace, compila Titolo, Sottotitolo, Autore e Categoria nella scheda Metadati.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 border rounded-lg bg-neutral-light/50">
        <div>
            <h4 className="text-sm font-semibold text-neutral-medium">{t('metadataTab.bookTitle')}</h4>
            <p className="font-bold text-brand-dark truncate">{project?.bookTitle || 'N/A'}</p>
        </div>
        <div>
            <h4 className="text-sm font-semibold text-neutral-medium">{t('metadataTab.subtitle')}</h4>
            <p className="text-neutral-dark truncate">{project?.subtitle || 'N/A'}</p>
        </div>
        <div>
            <h4 className="text-sm font-semibold text-neutral-medium">{t('metadataTab.author')}</h4>
            <p className="text-neutral-dark truncate">{project?.author || 'N/A'}</p>
        </div>
        <div>
            <h4 className="text-sm font-semibold text-neutral-medium">{t('metadataTab.categories')}</h4>
            <p className="text-neutral-dark truncate">{project?.categories?.join(', ') || 'N/A'}</p>
        </div>
      </div>


      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <label htmlFor="cover-prompt" className="block font-semibold text-neutral-dark">
              {t('coverTab.promptLabel')}
            </label>
             <button
                onClick={handleGeneratePrompt}
                disabled={isGeneratingPrompt || isLoading || !isMetadataComplete}
                className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isGeneratingPrompt ? <LoadingSpinner className="animate-spin h-5 w-5 text-brand-primary" /> : '✨'}
                {isGeneratingPrompt ? t('coverTab.generatingPrompt') : t('coverTab.generatePrompt')}
            </button>
        </div>
        <textarea
          id="cover-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none"
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading || isGeneratingPrompt || !prompt || !isMetadataComplete}
          className="flex items-center justify-center bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md transition-colors shadow disabled:bg-neutral-medium disabled:cursor-not-allowed"
        >
          {isLoading ? <LoadingSpinner /> : t('coverTab.button')}
        </button>
      </div>

      {isLoading && <p className="text-center mt-6 text-neutral-medium">{t('coverTab.loading')}</p>}
      {error && <p className="text-center mt-6 text-red-600">{error}</p>}

      {project && project.coverOptions.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-brand-dark mb-4">{t('coverTab.resultsTitle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {project.coverOptions.map((base64Image, index) => {
              const imageUrl = `data:image/png;base64,${base64Image}`;
              const isSelected = project.coverImage === base64Image;
              return (
                <div key={index} className="text-center space-y-3">
                  <img 
                    src={imageUrl} 
                    alt={`Generated cover ${index + 1}`}
                    className={`rounded-lg shadow-lg w-full object-cover aspect-[3/4] ${isSelected ? 'ring-4 ring-brand-accent' : ''}`}
                  />
                   <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => handleSelectCover(base64Image)}
                        disabled={isSelected}
                        className="bg-brand-secondary hover:bg-brand-dark text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-green-600 disabled:cursor-default"
                      >
                        {isSelected ? t('coverTab.selected') : t('coverTab.selectButton')}
                      </button>
                       <button
                        onClick={() => handleDownloadCover(base64Image, index)}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                        title={t('coverTab.downloadButton')}
                      >
                        {t('coverTab.downloadButton')}
                      </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

export default CoverTab;