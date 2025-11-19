import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../hooks/useLocalization';
import { useProject } from '../../hooks/useProject';
import { generateCoverImages, generateCoverPromptFromBestsellers, editCoverImage, generateCoverTagline } from '../../services/geminiService';
import Card from '../common/Card';
import LoadingSpinner from '../icons/LoadingSpinner';
import type { BonusStickerShape } from '../../types';

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
  const [isGeneratingTagline, setIsGeneratingTagline] = useState(false);

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
    if (!text?.trim()) {
        return y;
    }
    // Rimuovi gli asterischi dal testo visualizzato
    const cleanText = text.replace(/\*+/g, '').trim();
    
    const words = cleanText.split(' ');
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
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            ctx.textAlign = 'center';

            const margin = canvasWidth * 0.1;
            const contentWidth = canvasWidth - margin * 2;
            let currentY = canvasHeight * 0.12; // Cursore Y iniziale leggermente più alto

            const ptToPx = (pt: number) => pt * 4 / 3;

            // Definizione spaziature fisse per evitare sovrapposizioni
            const sectionSpacing = 50; 

            // --- Draw Title ---
            if (project.bookTitle) {
                const titleFontSizePt = project.titleFontSize || 60;
                ctx.font = `bold ${titleFontSizePt}pt 'Georgia', serif`;
                currentY = wrapText(ctx, project.bookTitle, canvasWidth / 2, currentY, contentWidth, ptToPx(titleFontSizePt) * 1.1);
                currentY += sectionSpacing; // Aggiungi spaziatura dopo il titolo
            }
            
            // --- Draw Subtitle ---
            if (project.subtitle) {
                const subtitleFontSizePt = project.subtitleFontSize || 30;
                ctx.font = `bold ${subtitleFontSizePt}pt 'Georgia', serif`;
                currentY = wrapText(ctx, project.subtitle, canvasWidth / 2, currentY, contentWidth, ptToPx(subtitleFontSizePt) * 1.2);
                currentY += sectionSpacing; // Aggiungi spaziatura dopo il sottotitolo
            }
            
            // --- Draw Tagline ---
            if (project.coverTagline) {
                ctx.font = `italic 22pt 'Georgia', serif`;
                ctx.fillStyle = '#FFDD57'; // Colore accento per la tagline
                // Assicurati che il tagline parta da una nuova posizione pulita
                currentY = wrapText(ctx, project.coverTagline, canvasWidth / 2, currentY, contentWidth, ptToPx(22) * 1.1);
                ctx.fillStyle = 'white';
            }

            // --- Draw Author (bottom-right) ---
            if (project.author) {
                ctx.textAlign = 'right';
                const authorFontSizePt = project.authorFontSize || 18;
                ctx.font = `normal ${authorFontSizePt}pt 'Georgia', serif`;
                const authorY = canvasHeight - 60;
                const authorX = canvasWidth - 60;
                const cleanAuthor = project.author.replace(/\*+/g, '').trim();
                ctx.fillText(cleanAuthor, authorX, authorY);
            }
            
            // --- Draw Bonus Sticker (bottom-left) ---
            if (project.coverBonusCount && project.coverBonusCount > 0 && project.bonusStickerShape !== 'none') {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 5;
                ctx.shadowOffsetY = 5;

                const bonusNumber = project.coverBonusCount.toString();
                
                const stickerRadius = 150;
                const stickerMargin = 50;
                const stickerCenterX = stickerRadius + stickerMargin;
                const stickerCenterY = canvasHeight - stickerRadius - stickerMargin;
                
                const drawStar = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) => {
                    let rot = Math.PI / 2 * 3;
                    let x = cx;
                    let y = cy;
                    let step = Math.PI / spikes;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - outerRadius);
                    for (let i = 0; i < spikes; i++) {
                        x = cx + Math.cos(rot) * outerRadius;
                        y = cy + Math.sin(rot) * outerRadius;
                        ctx.lineTo(x, y);
                        rot += step;
                        x = cx + Math.cos(rot) * innerRadius;
                        y = cy + Math.sin(rot) * innerRadius;
                        ctx.lineTo(x, y);
                        rot += step;
                    }
                    ctx.lineTo(cx, cy - outerRadius);
                    ctx.closePath();
                };
                
                ctx.fillStyle = '#FFD700'; // Gold color

                switch(project.bonusStickerShape) {
                    case 'seal':
                        drawStar(stickerCenterX, stickerCenterY, 40, stickerRadius, stickerRadius * 0.92);
                        ctx.fill();
                        break;
                    case 'shield':
                        const shieldWidth = stickerRadius * 1.8;
                        const shieldHeight = stickerRadius * 1.8;
                        const shieldX = stickerCenterX - shieldWidth / 2;
                        const shieldY = stickerCenterY - shieldHeight / 2;
                        ctx.beginPath();
                        ctx.moveTo(shieldX, shieldY);
                        ctx.lineTo(shieldX + shieldWidth, shieldY);
                        ctx.lineTo(shieldX + shieldWidth, shieldY + shieldHeight * 0.7);
                        ctx.quadraticCurveTo(shieldX + shieldWidth / 2, shieldY + shieldHeight, shieldX, shieldY + shieldHeight * 0.7);
                        ctx.closePath();
                        ctx.fill();
                        break;
                    case 'ribbon':
                        const bannerWidth = stickerRadius * 2.5;
                        const bannerHeight = stickerRadius * 1.2;
                        const bannerX = stickerCenterX - bannerWidth / 2;
                        const bannerY = stickerCenterY - bannerHeight / 2;
                        const notch = bannerHeight / 2;
                        ctx.beginPath();
                        ctx.moveTo(bannerX, bannerY);
                        ctx.lineTo(bannerX + bannerWidth, bannerY);
                        ctx.lineTo(bannerX + bannerWidth - notch, bannerY + bannerHeight / 2);
                        ctx.lineTo(bannerX + bannerWidth, bannerY + bannerHeight);
                        ctx.lineTo(bannerX, bannerY + bannerHeight);
                        ctx.lineTo(bannerX + notch, bannerY + bannerHeight / 2);
                        ctx.closePath();
                        ctx.fill();
                        break;
                    case 'circle':
                        ctx.beginPath();
                        ctx.arc(stickerCenterX, stickerCenterY, stickerRadius, 0, Math.PI * 2);
                        ctx.fill();
                        break;
                    case 'burst':
                        drawStar(stickerCenterX, stickerCenterY, 24, stickerRadius, stickerRadius * 0.7);
                        ctx.fill();
                        break;
                    case 'star':
                    default:
                        drawStar(stickerCenterX, stickerCenterY, 5, stickerRadius * 1.1, stickerRadius * 0.5);
                        ctx.fill();
                        break;
                }
                
                ctx.shadowColor = 'transparent';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                if (project.bonusStickerShape === 'ribbon') {
                    const fullText = `${bonusNumber} ${t('coverTab.bonusText').toUpperCase()}`;
                    ctx.font = `bold 45px 'Montserrat', sans-serif`;
                    ctx.fillText(fullText, stickerCenterX, stickerCenterY);
                } else {
                    const bonusTextLines = t('coverTab.bonusText').toUpperCase().split(' ');
                    const hasMultiLineBonusText = bonusTextLines.length > 1;

                    ctx.font = `bold ${hasMultiLineBonusText ? '70px' : '80px'} 'Montserrat', sans-serif`;
                    const numberY = stickerCenterY - (hasMultiLineBonusText ? 35 : 20);
                    ctx.fillText(bonusNumber, stickerCenterX, numberY);

                    ctx.font = `bold ${hasMultiLineBonusText ? '35px' : '40px'} 'Montserrat', sans-serif`;
                    if (hasMultiLineBonusText) {
                        ctx.fillText(bonusTextLines[0], stickerCenterX, stickerCenterY + 20);
                        ctx.fillText(bonusTextLines[1], stickerCenterX, stickerCenterY + 60);
                    } else {
                        ctx.fillText(bonusTextLines[0], stickerCenterX, stickerCenterY + 45);
                    }
                }
            }
            
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => reject(err);
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
        const errorMessage = (err as Error).toString().toLowerCase();
        if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
            setError(t('apiErrors.rateLimit'));
        } else if (errorMessage.includes('400') || errorMessage.includes('invalid argument')) {
            setError(t('apiErrors.invalidInput'));
        } else {
            setError(t('apiErrors.generic'));
        }
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
      // Step 1: Generate base images from the prompt
      const response = await generateCoverImages(prompt);
      const base64Images = response.generatedImages.map(img => img.image.imageBytes);
      
      // Step 2: Add titles, author, and sticker to the base images
      const coversWithTextPromises = base64Images.map(base64 => addTextToImage(base64));
      const coversWithText = await Promise.all(coversWithTextPromises);
      
      // Add a delay before starting the refinement loop to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 31000));

      // Step 3: Enhance each generated cover with an AI refinement pass, sequentially to avoid rate limits
      const enhancementPrompt = "Enhance the quality of this book cover. Improve sharpness, colors, and lighting to make it more professional and visually appealing, but DO NOT change, add, or remove any text or its position.";
      const refinedCoverResults: (string | null)[] = [];
      for (let i = 0; i < coversWithText.length; i++) {
        const coverDataUrl = coversWithText[i];
        const refinedImage = await editCoverImage(coverDataUrl, enhancementPrompt);
        refinedCoverResults.push(refinedImage);
        // Add a delay between each API call, but not after the last one
        if (i < coversWithText.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 31000));
        }
      }
      
      // Use the refined image if the enhancement was successful, otherwise fall back to the original
      const finalCovers = coversWithText.map((originalCover, index) => refinedCoverResults[index] || originalCover);

      // Step 4: Compress the final images to JPEG for optimized file size
      const compressedCovers = await Promise.all(
        finalCovers.map(pngDataUrl => compressImage(pngDataUrl))
      );

      // Step 5: Save the results to the project state
      const newPrompts = project?.coverPrompts?.includes(prompt) ? project.coverPrompts : [...(project?.coverPrompts || []), prompt];

      updateProject({ 
          coverOptions: compressedCovers,
          coverImage: compressedCovers[0] || null,
          coverPrompts: newPrompts
      });

    } catch (err) {
      const errorMessage = (err as Error).toString().toLowerCase();
        if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
            setError(t('apiErrors.rateLimit'));
        } else if (errorMessage.includes('400') || errorMessage.includes('invalid argument')) {
            setError(t('apiErrors.invalidInput'));
        } else {
            setError(t('apiErrors.generic'));
        }
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
        const refinedImageBase64 = await editCoverImage(project.coverImage, refinePrompt);
        
        if (refinedImageBase64) {
            const compressedRefinedImage = await compressImage(refinedImageBase64);
            
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
        const errorMessage = (err as Error).toString().toLowerCase();
        if (errorMessage.includes('429') || errorMessage.includes('resource_exhausted')) {
            setError(t('apiErrors.rateLimit'));
        } else if (errorMessage.includes('400') || errorMessage.includes('invalid argument')) {
            setError(t('apiErrors.invalidInput'));
        } else {
            setError(t('apiErrors.generic'));
        }
    } finally {
        setIsRefining(false);
    }
  };

  const handleGenerateTagline = async () => {
    if (!project) return;
    setIsGeneratingTagline(true);
    try {
        const tagline = await generateCoverTagline(project);
        updateProject({ coverTagline: tagline });
    } catch(e) {
        console.error(e);
    } finally {
        setIsGeneratingTagline(false);
    }
  }

  const refineSuggestions = [
    t('coverTab.refineSuggestion1'),
    t('coverTab.refineSuggestion2'),
    t('coverTab.refineSuggestion3'),
    t('coverTab.refineSuggestion4'),
  ];


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
        <div className="p-4 mb-6 border rounded-lg bg-neutral-light/50">
            <h3 className="text-lg font-semibold text-brand-dark mb-4">Opzioni di Stile e Testo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="title-font-size" className="block text-sm font-medium text-gray-700">Dimensione Titolo (pt)</label>
                    <select
                        id="title-font-size"
                        value={project?.titleFontSize || 60}
                        onChange={(e) => updateProject({ titleFontSize: parseInt(e.target.value, 10) })}
                        className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                    >
                        {[40, 48, 54, 60, 72, 80, 90, 100].map(size => <option key={size} value={size}>{size} pt</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="subtitle-font-size" className="block text-sm font-medium text-gray-700">Dimensione Sottotitolo (pt)</label>
                    <select
                        id="subtitle-font-size"
                        value={project?.subtitleFontSize || 30}
                        onChange={(e) => updateProject({ subtitleFontSize: parseInt(e.target.value, 10) })}
                        className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                    >
                        {[20, 24, 28, 30, 36, 42, 50, 60, 70, 80, 90, 100].map(size => <option key={size} value={size}>{size} pt</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="author-font-size" className="block text-sm font-medium text-gray-700">Dimensione Autore (pt)</label>
                    <select
                        id="author-font-size"
                        value={project?.authorFontSize || 18}
                        onChange={(e) => updateProject({ authorFontSize: parseInt(e.target.value, 10) })}
                        className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                    >
                        {[14, 16, 18, 20, 22, 24, 30, 40, 50, 60, 70, 80].map(size => <option key={size} value={size}>{size} pt</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="bonus-count" className="block text-sm font-medium text-gray-700">
                        {t('coverTab.bonusCountLabel')}
                    </label>
                    <select
                        id="bonus-count"
                        value={project?.coverBonusCount || 0}
                        onChange={(e) => updateProject({ coverBonusCount: parseInt(e.target.value, 10) })}
                        className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                    >
                        {[...Array(11).keys()].map(i => (
                            <option key={i} value={i}>{i}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="bonus-shape" className="block text-sm font-medium text-gray-700">
                        Forma Adesivo Bonus
                    </label>
                    <select
                        id="bonus-shape"
                        value={project?.bonusStickerShape || 'star'}
                        onChange={(e) => updateProject({ bonusStickerShape: e.target.value as BonusStickerShape })}
                        className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-brand-light focus:border-brand-light sm:text-sm"
                    >
                        <option value="star">Stella</option>
                        <option value="circle">Cerchio</option>
                        <option value="burst">Esplosione</option>
                        <option value="seal">Sigillo</option>
                        <option value="ribbon">Nastro</option>
                        <option value="shield">Scudo</option>
                        <option value="none">Nessuno</option>
                    </select>
                </div>
            </div>
        </div>

        <div>
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
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none mt-1"
            />
        </div>
        <div>
            <div className="flex justify-between items-center mb-1">
                <label htmlFor="cover-tagline" className="block font-semibold text-neutral-dark">
                    Tagline di Copertina (Opzionale)
                </label>
                <button
                    onClick={handleGenerateTagline}
                    disabled={isGeneratingTagline || isLoading || !project?.bookTitle}
                    className="text-sm text-brand-primary font-semibold hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isGeneratingTagline ? <LoadingSpinner className="animate-spin h-5 w-5 text-brand-primary" /> : '✨'}
                    Genera Tagline
                </button>
            </div>
            <input
                type="text"
                id="cover-tagline"
                value={project?.coverTagline || ''}
                onChange={(e) => updateProject({ coverTagline: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-light focus:outline-none mt-1"
                placeholder="Una frase breve e accattivante..."
            />
        </div>
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
                    <div className="flex flex-wrap gap-2">
                        {refineSuggestions.map((s, i) => (
                            <button 
                                key={i} 
                                onClick={() => setRefinePrompt(prev => prev ? `${prev}, ${s.toLowerCase()}` : s)}
                                className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded-full transition-colors"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
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