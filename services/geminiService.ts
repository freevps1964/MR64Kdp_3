import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse, Modality } from "@google/genai";
import type { BookStructure, ResearchResult, Keyword, GroundingSource, ContentBlockType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Esegue una chiamata API asincrona con una logica di tentativi esponenziali di backoff.
 * Specifico per errori di rate limit (429).
 */
async function withRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries = 5,
  initialDelay = 2000
): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await apiCall();
    } catch (error: any) {
      const errorMessage = error.toString();
      // Controlla se l'errore è un errore di rate limit
      if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('resource_exhausted')) {
        retries++;
        if (retries > maxRetries) {
          console.error("Massimo numero di tentativi raggiunto. L'operazione non è riuscita.", error);
          throw error;
        }
        // Calcola il ritardo con backoff esponenziale e un po' di jitter
        const delay = initialDelay * (2 ** (retries - 1)) + Math.random() * 1000;
        console.warn(`Rate limit raggiunto. Nuovo tentativo in ${Math.round(delay / 1000)}s... (Tentativo ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Errore non recuperabile, lancia immediatamente
        throw error;
      }
    }
  }
}

/**
 * Pulisce e analizza una stringa JSON che potrebbe essere incorporata in un blocco di codice markdown.
 */
function parseJsonFromMarkdown<T>(jsonString: string): T | null {
  try {
    // Rimuove i backtick del blocco di codice e la parola "json"
    const cleanedString = jsonString.replace(/```json\n|```/g, '').trim();
    return JSON.parse(cleanedString) as T;
  } catch (error) {
    console.error("Error parsing JSON:", error, "Original string:", jsonString);
    // Tenta un'analisi più permissiva se la prima fallisce
    try {
        const permissiveClean = jsonString.substring(jsonString.indexOf('{'), jsonString.lastIndexOf('}') + 1);
        return JSON.parse(permissiveClean) as T;
    } catch (permissiveError) {
        console.error("Permissive parsing attempt failed:", permissiveError);
        return null;
    }
  }
}

/**
 * Classifica le fonti web in base alla pertinenza per un dato argomento.
 */
const rankSources = async (topic: string, sources: GroundingSource[]): Promise<GroundingSource[]> => {
    if (!sources || sources.length === 0) {
        return [];
    }
    const sourcesToRank = sources.map(s => ({ uri: s.web?.uri, title: s.web?.title })).filter(s => s.uri && s.title);

    const prompt = `Dato l'argomento di un libro "${topic}", classifica le seguenti fonti web in base alla loro pertinenza per la scrittura del libro. Fornisci un punteggio di pertinenza da 0 a 100 per ciascuna.
    Rispondi con un array JSON di oggetti. Ogni oggetto deve contenere "uri", "title" e "relevance".

    Fonti da classificare:
    ${JSON.stringify(sourcesToRank)}
    `;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            uri: { type: Type.STRING },
                            title: { type: Type.STRING },
                            relevance: { type: Type.NUMBER }
                        },
                        required: ["uri", "title", "relevance"]
                    }
                }
            }
        }));
        
        const rankedSources = JSON.parse(response.text.trim()) as { uri: string; title: string; relevance: number }[];
        
        const relevanceMap = new Map(rankedSources.map(s => [s.uri, s.relevance]));

        return sources.map(originalSource => ({
            ...originalSource,
            relevance: originalSource.web?.uri ? relevanceMap.get(originalSource.web.uri) ?? 0 : 0
        })).sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));

    } catch (error) {
        console.error("Error ranking sources:", error);
        return sources; // Restituisce le fonti originali non classificate in caso di errore
    }
};


/**
 * Esegue una ricerca approfondita su un argomento utilizzando Gemini con il grounding di Google Search.
 */
export const researchTopic = async (topic: string): Promise<{ result: ResearchResult | null; sources: any[] }> => {
  const prompt = `Esegui una ricerca approfondita e aggiornata per un libro da pubblicare su Amazon KDP sull'argomento: "${topic}".
  Fornisci una risposta strutturata in formato JSON con i seguenti campi, assicurandoti che tutti i dati e le analisi riflettano le informazioni più recenti disponibili:
  - "marketSummary": un'analisi concisa del mercato di riferimento e del potenziale pubblico, basata su dati attuali.
  - "titles": un array di 5 oggetti, ognuno con "title" (stringa) e "relevance" (un numero da 0 a 100 che indica la pertinenza).
  - "subtitles": un array di 5 oggetti, ognuno con "subtitle" (stringa) e "relevance" (numero da 0 a 100).
  - "keywords": un array di 10 oggetti, ognuno con "keyword" (stringa) e "relevance" (numero da 0 a 100). Queste parole chiave devono essere altamente performanti per Amazon KDP, concentrandosi su un alto intento di acquisto, redditività commerciale e un forte potenziale di conversione, basate sulle tendenze attuali. Includi un mix di parole chiave a coda corta e a coda lunga.
  
  Ordina internamente ogni array in base alla pertinenza, dal più alto al più basso.
  Assicurati che l'output sia un oggetto JSON valido.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    }));

    const researchData = parseJsonFromMarkdown<ResearchResult>(response.text);
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    if (researchData) {
        researchData.sources = await rankSources(topic, groundingChunks);
    }
    
    return { result: researchData, sources: groundingChunks };
  } catch (error) {
    console.error("Error during topic research:", error);
    return { result: null, sources: [] };
  }
};

/**
 * Genera una struttura di libro (capitoli e sottocapitoli) in formato JSON.
 */
export const generateStructure = async (topic: string, title: string, subtitle: string, keywords: Keyword[]): Promise<BookStructure | null> => {
  const keywordList = keywords.map(k => k.keyword).join(', ');
  const prompt = `Crea una struttura logica e dettagliata per un libro KDP sull'argomento "${topic}", con il titolo "${title}" e il sottotitolo "${subtitle}".
La struttura deve seguire rigorosamente i seguenti requisiti:
1.  Deve contenere esattamente 10 capitoli.
2.  Ogni capitolo deve contenere esattamente 4 sottocapitoli.
I titoli dei capitoli e dei sottocapitoli devono essere pertinenti, coprire in modo esauriente l'argomento e includere in modo naturale le seguenti parole chiave per massimizzare la visibilità e le vendite su Amazon: ${keywordList}.`;
  
  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  subchapters: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                      },
                      required: ["id", "title"]
                    }
                  }
                },
                required: ["id", "title", "subchapters"]
              }
            }
          },
          required: ["chapters"]
        },
      },
    }));

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error generating structure:", error);
    return null;
  }
};

/**
 * Genera il contenuto per un capitolo o sottocapitolo specifico in streaming.
 */
export const generateContentStream = (
  topic: string,
  chapterTitle: string,
  subchapterTitle?: string,
  wordCount?: number,
  keywords?: Keyword[],
  tone?: string,
  audience?: string,
  style?: string,
  existingContent?: string
): Promise<AsyncGenerator<GenerateContentResponse>> => {
  const keywordList = keywords && keywords.length > 0 ? keywords.map(k => k.keyword).join(', ') : '';
  
  const writingGuidelines = [
    tone && `- Tono di voce: ${tone}`,
    audience && `- Pubblico di destinazione: ${audience}`,
    style && `- Stile di scrittura: ${style}`
  ].filter(Boolean).join('\n');

  const wordCountInstruction = wordCount 
    ? `REQUISITO FONDAMENTALE: Il contenuto di questa sezione DEVE essere di almeno ${wordCount} parole. Scrivi un testo completo, dettagliato e approfondito. Non fornire un breve riassunto. Approfondisci ogni punto per assicurarti che il requisito del conteggio parole sia soddisfatto.`
    : '';

  const regenerationInstruction = existingContent 
    ? `Migliora, espandi e riscrivi il seguente testo per renderlo più coinvolgente, dettagliato e di alta qualità. Assicurati che la nuova versione sia coerente con le linee guida fornite e che soddisfi il requisito del conteggio parole. Testo originale da migliorare:\n---\n${existingContent}\n---\n`
    : `Scrivi il contenuto per il libro sull'argomento "${topic}".`;

  const prompt = `Sei un autore esperto e ghostwriter specializzato nella creazione di libri bestseller per Amazon KDP. Il tuo compito è scrivere un contenuto di altissima qualità.
${regenerationInstruction}
Sezione corrente: Capitolo "${chapterTitle}" ${subchapterTitle ? `- Sottocapitolo "${subchapterTitle}"` : ''}.

Linee Guida Fondamentali:
1.  **Qualità Superiore**: Scrivi in modo professionale, chiaro e informativo. La qualità deve essere paragonabile a quella di un bestseller.
2.  **Stile Coinvolgente**: Utilizza tecniche di storytelling dove appropriato. Varia la lunghezza e la struttura delle frasi per creare un ritmo di lettura piacevole. Assicura un flusso logico e transizioni fluide tra i paragrafi.
3.  **Tono Autorevole e Accessibile**: Mantieni un tono esperto ma comprensibile per il pubblico di destinazione specificato.
4.  **Praticità**: Includi esempi pratici, aneddoti o casi studio per illustrare i punti chiave, rendendo il contenuto più concreto e facilmente comprensibile.
5.  **Accuratezza**: Assicurati che tutte le informazioni fornite siano attuali, verificate e accurate.
6.  **SEO**: ${keywordList ? `Integra in modo naturale e strategico le seguenti parole chiave: ${keywordList}.` : 'Scrivi in modo naturale senza forzare parole chiave.'}

${writingGuidelines ? `\nSegui anche queste specifiche aggiuntive:\n${writingGuidelines}` : ''}

${wordCountInstruction}

Output:
- Fornisci solo il testo del contenuto.
- Non includere il titolo del capitolo o del sottocapitolo.
- Formatta il testo in paragrafi ben definiti per una facile leggibilità.`;

  return withRetry(() => ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: prompt,
  }));
};

/**
 * Genera un prompt per la copertina analizzando i bestseller su Amazon.
 */
export const generateCoverPromptFromBestsellers = async (
  topic: string,
  title: string,
  keywords: Keyword[],
  category: string
): Promise<string> => {
  const keywordList = keywords.map(k => k.keyword).join(', ');
  const prompt = `Research the current best-selling book covers on Amazon.com within the "${category}" category, focusing on the topic of "${topic}".
Analyze common design trends, color palettes, typography styles (e.g., serif, sans-serif, bold, minimalist), and imagery used in the top results.
Based on this analysis, create a highly detailed and effective prompt for an AI image generator (like Imagen) to design a book cover for a book titled "${title}".
The prompt should incorporate concepts from the following keywords: ${keywordList}.
The prompt must be in English, descriptive, and aim for a commercially successful design that would stand out. Emphasize visual elements, mood, and composition. Ensure the prompt describes a design with significant clear or uncluttered space at the top (for the title and subtitle) and bottom (for the author's name) to prevent text from obscuring key visual elements.
For example: "A minimalist book cover with a deep blue background. In the center, a stylized, golden line art of a brain with interconnected nodes, leaving the top third and bottom fifth of the cover empty. The title '${title}' is in a clean, white, sans-serif font at the top. The overall mood is intelligent, modern, and professional."
The output must be only the text of the prompt, without any other introductory text or explanation.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    }));
    return response.text.trim();
  } catch (error) {
    console.error("Error generating cover prompt from bestsellers:", error);
    return `Book cover for a title "${title}" on the topic of "${topic}". Clean, modern, and eye-catching design, incorporating ideas from these keywords: ${keywordList}. The target category is ${category}.`;
  }
};


/**
 * Genera immagini di copertina per il libro.
 */
export const generateCoverImages = (prompt: string): Promise<GenerateImagesResponse> => {
    return withRetry(() => ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 3,
          outputMimeType: 'image/png',
          aspectRatio: '3:4',
        },
    }));
};

/**
 * Modifica un'immagine di copertina esistente utilizzando un prompt di testo.
 */
const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1];

export const editCoverImage = async (base64ImageDataUrl: string, prompt: string): Promise<string | null> => {
    const imagePart = {
        inlineData: {
            data: dataUrlToBase64(base64ImageDataUrl),
            mimeType: 'image/jpeg', // Le immagini compresse sono JPEG
        },
    };
    const textPart = { text: prompt };

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [imagePart, textPart]
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        }));
        
        const imageResponsePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (imageResponsePart?.inlineData) {
            // L'output di Nano Banana è PNG
            return `data:image/png;base64,${imageResponsePart.inlineData.data}`;
        }
        console.warn("Nessuna parte immagine trovata nella risposta di modifica della copertina.");
        return null;
    } catch(error) {
        console.error("Errore durante la modifica dell'immagine di copertina:", error);
        return null;
    }
};


/**
 * Genera una descrizione del libro per i metadati KDP.
 */
export const generateDescription = async (title: string, structure: BookStructure | null): Promise<string> => {
    const chapterTitles = structure?.chapters.map(c => c.title).join(', ') || 'vari argomenti';
    const prompt = `Scrivi una descrizione di prodotto avvincente per un libro intitolato "${title}".
    Il libro tratta i seguenti argomenti principali: ${chapterTitles}.
    La descrizione deve essere persuasiva, ottimizzata per Amazon KDP e lunga circa 150-200 parole.
    Evita di usare markdown o formattazione speciale.`;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        }));
        return response.text;
    } catch(error) {
        console.error("Error generating description:", error);
        return "";
    }
};

/**
 * Genera un elenco di categorie di libri comuni adatte per Amazon KDP.
 */
export const fetchAmazonCategories = async (): Promise<string[]> => {
  const prompt = `Generate a comprehensive list of top-level book categories as found on major online bookstores like Amazon.
  Return the result as a single, flat JSON array of strings. For example: ["Arts & Photography", "Biographies & Memoirs", "Business & Money"].
  Do not include sub-categories. The output must be only the JSON array.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    }));

    const categories = JSON.parse(response.text.trim()) as string[];
    return categories?.sort() || [];
  } catch (error) {
    console.error("Error fetching Amazon categories:", error);
    return ["Arts & Photography", "Biographies & Memoirs", "Business & Money", "Children's Books", "Comics & Graphic Novels", "Computers & Technology", "Cookbooks, Food & Wine", "Crafts, Hobbies & Home", "Education & Teaching", "Engineering & Transportation", "Health, Fitness & Dieting", "History", "Humor & Entertainment", "Law", "Lesbian, Gay, Bisexual & Transgender Books", "Literature & Fiction", "Medical Books", "Mystery, Thriller & Suspense", "Parenting & Relationships", "Politics & Social Sciences", "Reference", "Religion & Spirituality", "Romance", "Science & Math", "Science Fiction & Fantasy", "Self-Help", "Sports & Outdoors", "Teen & Young Adult", "Test Preparation", "Travel"];
  }
};

/**
 * Genera un prompt per un blocco di contenuto (ricetta/esercizio).
 */
export const generateContentBlockPrompt = async (topic: string, type: ContentBlockType): Promise<string> => {
    const prompt = `Based on a book about "${topic}", generate a short, creative, and descriptive prompt for creating a ${type}. The prompt should be a single sentence that can be used to generate the full ${type} content. For example, if the topic is "Healthy Italian Cooking" and the type is "recipe", a good prompt would be "A light and healthy version of classic lasagna with zucchini instead of pasta." The output must be only the text of the prompt.`;
    
    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        }));
        return response.text.trim();
    } catch (error) {
        console.error(`Error generating ${type} prompt:`, error);
        return "";
    }
};


/**
 * Genera il testo per uno o più blocchi di contenuto (ricetta/esercizio).
 */
export const generateContentBlockText = async (
    topic: string, 
    description: string, 
    type: ContentBlockType,
    count: number = 1,
    existingTitles: string[] = []
): Promise<{ title: string; textContent: string }[] | null> => {
    
    const recipeProperties = {
      description: { type: Type.STRING, description: "A captivating summary of the recipe." },
      ingredients: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of ingredients." },
      instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Step-by-step instructions." },
    };
    
    const exerciseProperties = {
      description: { type: Type.STRING, description: "A summary of the exercise and its benefits." },
      muscles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Muscles involved." },
      instructions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Step-by-step instructions for proper form." },
    };

    const itemProperties = type === 'recipe' ? recipeProperties : exerciseProperties;
    
    const uniquenessInstruction = existingTitles.length > 0
      ? `IMPORTANTE: Evita di generare ${type} con i seguenti titoli, poiché esistono già: ${existingTitles.join(', ')}.`
      : '';

    const prompt = `Basato sull'argomento del libro "${topic}", genera ${count} ${type} unici relativi a "${description}".
    Per ognuno, fornisci un "title" univoco e i dettagli del contenuto.
    ${uniquenessInstruction}
    Rispondi con un array JSON di oggetti, anche se ne generi solo uno.`;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                           title: { type: Type.STRING },
                           ...itemProperties
                        },
                        required: ["title", ...Object.keys(itemProperties)]
                    }
                }
            }
        }));
        
        const results = JSON.parse(response.text.trim());

        return results.map((item: any) => {
            let formattedText = `${item.description}\n\n`;
            if (type === 'recipe') {
                formattedText += `INGREDIENTI:\n- ${item.ingredients.join('\n- ')}\n\nISTRUZIONI:\n${item.instructions.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}`;
            } else {
                formattedText += `MUSCOLI COINVOLTI:\n- ${item.muscles.join('\n- ')}\n\nISTRUZIONI:\n${item.instructions.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}`;
            }
            return {
                title: item.title,
                textContent: formattedText,
            };
        });

    } catch (error) {
        console.error(`Error generating ${type} text:`, error);
        return null;
    }
};