


import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateCoverImages, generateCoverPromptFromBestsellers, editCoverImage } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';

/**
 * Comprime un'immagine fornita come data URL in formato JPEG.
 * @param dataUrl L'URL dei dati dell'immagine (es. 'data:image/png;base64,...').
 * @param quality La qualità del JPEG (0.0 - 1.0). Il default è 0.75.
 * @returns Una Promise che si risolve con il nuovo data URL dell'immagine compressa in JPEG.
 */
const compressImage = (dataUrl: string, quality = 0.75): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject('Impossibile ottenere il contesto del canvas');
            }
            ctx.drawImage(img, 0, 0);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
        img.src = dataUrl;
    });
};


const CoverTab: React.FC = () => {
  const { t } = useLocalization();
  const { project, updateProject } = useProject();
  
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [refinePrompt, setRefinePrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);

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
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            const margin = canvasWidth * 0.1;
            const contentWidth = canvasWidth - margin * 2;
            let currentY = canvasHeight * 0.15; // Cursore Y iniziale

            // Disegna il Titolo
            const title = project.bookTitle.toUpperCase();
            let titleFontSize = 100;
            ctx.textAlign = 'center';
            ctx.font = `bold ${titleFontSize}px 'Montserrat', sans-serif`;
            while (ctx.measureText(title).width > contentWidth && titleFontSize > 20) {
                titleFontSize -= 5;
                ctx.font = `bold ${titleFontSize}px 'Montserrat', sans-serif`;
            }
            currentY = wrapText(ctx, title, canvasWidth / 2, currentY, contentWidth, titleFontSize * 1.1);

            // Aggiungi spazio prima del sottotitolo
            currentY += titleFontSize * 0.5;

            // Disegna il Sottotitolo (se esiste)
            if (project.subtitle) {
                let subtitleFontSize = 45;
                ctx.font = `italic ${subtitleFontSize}px 'EB Garamond', serif`;
                while (ctx.measureText(project.subtitle).width > contentWidth && subtitleFontSize > 15) {
                    subtitleFontSize -= 2;
                    ctx.font = `italic ${subtitleFontSize}px 'EB Garamond', serif`;
                }
                wrapText(ctx, project.subtitle, canvasWidth / 2, currentY, contentWidth, subtitleFontSize * 1.2);
            }

            // Disegna l'Autore in basso a destra
            if (project.author) {
                ctx.textAlign = 'right';
                ctx.font = `600 48px 'Montserrat', sans-serif`;
                const authorY = canvasHeight - 60; // Posizione fissa dal basso
                const authorX = canvasWidth - 60; // Posizione fissa da destra
                ctx.fillText(project.author, authorX, authorY);
            }
            
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => reject(err);
        // Assicura che l'immagine base64 abbia il prefisso corretto
        const src = base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`;
        img.src = src;
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
      
      const coversWithTextPromises = base64Images.map(base64 => addTextToImage(base64));
      const coversWithText = await Promise.all(coversWithTextPromises);
      
      const compressedCovers = await Promise.all(
        coversWithText.map(pngDataUrl => compressImage(pngDataUrl))
      );

      const newPrompts = project?.coverPrompts?.includes(prompt) ? project.coverPrompts : [...(project?.coverPrompts || []), prompt];

      updateProject({ 
          coverOptions: compressedCovers,
          coverImage: compressedCovers[0] || null,
          coverPrompts: newPrompts
      });

    } catch (err) {
      console.error("Error generating covers:", err);
      setError("Impossibile generare le copertine. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectCover = (dataUrl: string) => {
    updateProject({ coverImage: dataUrl });
  };
  
  const handleSaveCover = (dataUrl: string) => {
    if (!project) return;
    const currentArchived = project.archivedCovers || [];
    if (!currentArchived.includes(dataUrl)) {
        updateProject({ archivedCovers: [...currentArchived, dataUrl] });
    }
  };


  const handleDownloadCover = (dataUrl: string, index: number) => {
    const mimeType = dataUrl.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const extension = mimeType.split('/')[1] || 'jpg';
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${project?.projectTitle?.replace(/ /g, '_') || 'cover'}-${index + 1}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRefineImage = async () => {
    if (!project?.coverImage || !refinePrompt.trim()) return;

    setIsRefining(true);
    setError(null);
    try {
        // Step 1: Edit the visual part of the cover (without text)
        const originalBaseImage = project.coverOptions.find(opt => opt === project.coverImage);
        if (!originalBaseImage) {
            throw new Error("Original image not found for refinement.");
        }
        
        const refinedImageBase64 = await editCoverImage(originalBaseImage, refinePrompt);
        
        if (refinedImageBase64) {
            // Step 2: Add text to the newly refined image
            const refinedImageWithText = await addTextToImage(refinedImageBase64);
            // Step 3: Compress the final image
            const compressedRefinedImage = await compressImage(refinedImageWithText);
            
            const newCoverOptions = project.coverOptions.map(opt =>
                opt === project.coverImage ? compressedRefinedImage : opt
            );
            
            updateProject({
                coverImage: compressedRefinedImage,
                coverOptions: newCoverOptions,
            });
            setRefinePrompt('');

        } else {
            setError(t('coverTab.refineError'));
        }
    } catch (err) {
        console.error("Error refining cover:", err);
        setError("An error occurred while refining the cover.");
    } finally {
        setIsRefining(false);
    }
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
            {project.coverOptions.map((dataUrl, index) => {
              const isSelected = project.coverImage === dataUrl;
              const isArchived = project.archivedCovers.includes(dataUrl);
              return (
                <div key={index} className="text-center space-y-3">
                  <img 
                    src={dataUrl} 
                    alt={`Generated cover ${index + 1}`}
                    className={`rounded-lg shadow-lg w-full object-cover aspect-[3/4] ${isSelected ? 'ring-4 ring-brand-accent' : ''}`}
                  />
                   <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => handleSelectCover(dataUrl)}
                        disabled={isSelected}
                        className="bg-brand-secondary hover:bg-brand-dark text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-green-600 disabled:cursor-default"
                      >
                        {isSelected ? t('coverTab.selected') : t('coverTab.selectButton')}
                      </button>
                       <button
                        onClick={() => handleSaveCover(dataUrl)}
                        disabled={isArchived}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
                      >
                        {isArchived ? t('coverTab.savedButton') : t('coverTab.saveButton')}
                      </button>
                       <button
                        onClick={() => handleDownloadCover(dataUrl, index)}
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

       {project?.coverImage && (
        <div className="mt-10 pt-6 border-t animate-fade-in">
            <h3 className="text-xl font-semibold text-brand-dark mb-4">{t('coverTab.refineCoverTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start p-4 bg-neutral-light/50 rounded-lg">
                <div>
                    <img src={project.coverImage} alt="Selected cover" className="rounded-lg shadow-lg w-full object-cover aspect-[3/4]" />
                </div>
                <div className="space-y-4">
                    <label htmlFor="refine-prompt" className="block font-semibold text-neutral-dark">
                        {t('coverTab.refinePromptLabel')}
                    </label>
                    <textarea
                        id="refine-prompt"
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        rows={4}
                        placeholder={t('coverTab.refinePromptPlaceholder')}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none"
                    />
                    <button
                        onClick={handleRefineImage}
                        disabled={isRefining || !refinePrompt.trim()}
                        className="flex items-center justify-center bg-brand-accent hover:bg-yellow-500 text-brand-dark font-bold py-2 px-6 rounded-md transition-colors shadow disabled:opacity-50"
                    >
                        {isRefining ? <LoadingSpinner className="animate-spin h-5 w-5 text-brand-dark" /> : `✨ ${t('coverTab.refineButton')}`}
                    </button>
                </div>
            </div>
        </div>
        )}

       {project && project.archivedCovers.length > 0 && (
        <div className="mt-12 pt-6 border-t">
            <h3 className="text-xl font-semibold text-brand-dark mb-4">{t('coverTab.favoritesTitle')}</h3>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                 {project.archivedCovers.map((dataUrl, index) => {
                    const isSelected = project.coverImage === dataUrl;
                    return (
                        <button key={index} onClick={() => handleSelectCover(dataUrl)} className="relative group">
                            <img 
                                src={dataUrl}
                                alt={`Archived cover ${index + 1}`}
                                className={`rounded-md shadow-md w-full object-cover aspect-[3/4] transition-all ${isSelected ? 'ring-4 ring-brand-accent' : 'group-hover:ring-2 group-hover:ring-brand-light'}`}
                            />
                        </button>
                    )
                 })}
             </div>
        </div>
      )}
    </Card>
  );
};

export default CoverTab;