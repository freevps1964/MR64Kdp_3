import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse, Modality } from "@google/genai";
import type { BookStructure, ResearchResult, Keyword, GroundingSource, ContentBlockType, Project } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Esegue una chiamata API asincrona con una logica di tentativi esponenziali di backoff.
 * Specifico per errori di rate limit (429).
 */
async function withRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries = 5,
  initialDelay = 5000
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

    const prompt = `Dato l'argomento di un libro "${topic}", analizza e classifica le seguenti fonti web. L'obiettivo è identificare le fonti più **affidabili e autorevoli** per la scrittura di un libro di alta qualità.

Per ogni fonte, fornisci un punteggio di "relevance" da 0 a 100 basato sui seguenti criteri, in ordine di importanza:
1.  **Affidabilità e Autorevolezza (Peso maggiore)**: Dai la priorità a fonti accademiche, governative, articoli di testate giornalistiche verificate, pubblicazioni di settore e libri di autori riconosciuti. Penalizza fortemente forum, blog personali di bassa qualità, social media e fonti non verificate.
2.  **Pertinenza**: Quanto è strettamente correlata la fonte all'argomento "${topic}".
3.  **Aggiornamento**: La fonte è recente e riflette le informazioni più attuali?

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
  const prompt = `AGISCI COME un esperto di marketing e publishing per Amazon KDP. Esegui una ricerca approfondita e aggiornata per un libro sull'argomento: "${topic}".
L'obiettivo è massimizzare le vendite e la visibilità. Fornisci una risposta strutturata in formato JSON con i seguenti campi, assicurandoti che tutti i dati riflettano le informazioni più recenti:

- "marketSummary": un'analisi concisa del mercato di riferimento, del potenziale pubblico e delle tendenze attuali.
- "keywords": un array di 10 oggetti, ognuno con "keyword" (stringa) e "relevance" (numero da 0 a 100). Queste parole chiave devono essere le più redditizie e con il più alto intento di acquisto per Amazon KDP, basate sulle tendenze di ricerca attuali. Includi un mix di parole chiave a coda corta e a coda lunga.
- "titles": un array di 5 oggetti titolo. Ogni oggetto deve avere "title" (stringa) e "relevance" (numero da 0 a 100). I titoli devono essere scritti per massimizzare il click-through rate (CTR) e le conversioni su Amazon. Devono essere magnetici, chiari, promettere un beneficio specifico al lettore e **incorporare in modo naturale e strategico le parole chiave più pertinenti generate sopra**.
- "subtitles": un array di 5 oggetti sottotitolo. Ogni oggetto deve avere "subtitle" (stringa) e "relevance" (numero da 0 a 100). I sottotitoli devono espandere il titolo, specificare il pubblico di destinazione (es. "per principianti"), menzionare i benefici chiave e **contenere le parole chiave pertinenti generate sopra per aumentare la visibilità**.

Ordina internamente ogni array in base alla pertinenza (relevance), dal più alto al più basso.
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
    ? `REQUISITO FONDAMENTALE: Il contenuto di questa sezione DEVE avere una lunghezza di circa ${wordCount} parole. Scrivi un testo completo e dettagliato che rispetti questa lunghezza target. Non fornire un breve riassunto.`
    : '';

  const regenerationInstruction = existingContent 
    ? `Migliora, espandi e riscrivi il seguente testo per renderlo più coinvolgente, dettagliato e di alta qualità. Assicurati che la nuova versione sia coerente con le linee guida fornite e che soddisfi il requisito del conteggio parole. Testo originale da migliorare:\n---\n${existingContent}\n---\n`
    : `Scrivi il contenuto per il libro sull'argomento "${topic}".`;

  const prompt = `AGISCI COME un autore di bestseller per KDP e un ghostwriter di fama mondiale. La tua missione è scrivere una sezione di capitolo della massima qualità possibile, estremamente coinvolgente e che fornisca un valore immenso al lettore. Questo contenuto DEVE essere degno di un bestseller.
${regenerationInstruction}
Sezione corrente: Capitolo "${chapterTitle}" ${subchapterTitle ? `- Sottocapitolo "${subchapterTitle}"` : ''}.

Linee Guida Fondamentali:
1.  **Qualità da Bestseller**: Scrivi in modo professionale, chiaro e informativo. Il livello deve essere impeccabile, paragonabile a un libro leader nel suo settore.
2.  **Stile Coinvolgente e Magnetico**: Usa tecniche di storytelling per catturare l'attenzione. Varia la struttura delle frasi per creare un ritmo di lettura dinamico. Garantisci un flusso logico e transizioni impeccabili tra i paragrafi.
3.  **Tono Autorevole ma Accessibile**: Posizionati come un esperto, ma spiega concetti complessi in modo semplice e comprensibile per il pubblico di destinazione.
4.  **Valore Pratico Immenso**: Fornisci esempi pratici, strategie attuabili, aneddoti o casi studio che il lettore possa applicare nella propria vita. Il contenuto deve essere utile e trasformazionale.
5.  **Accuratezza Assoluta**: Verifica che tutte le informazioni siano aggiornate, corrette e supportate da fonti attendibili se necessario.
6.  **Ottimizzazione per KDP**: ${keywordList ? `Integra in modo naturale e strategico le seguenti parole chiave per massimizzare la visibilità: ${keywordList}.` : 'Scrivi in modo naturale senza forzare parole chiave.'}

${writingGuidelines ? `\nSegui anche queste specifiche aggiuntive:\n${writingGuidelines}` : ''}

${wordCountInstruction}

Output:
- Fornisci solo il testo del contenuto, senza alcuna introduzione o preambolo.
- Non includere il titolo del capitolo o del sottocapitolo nel testo.
- Formatta il testo in paragrafi ben strutturati per una leggibilità ottimale.`;

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
  const prompt = `ACT AS an award-winning art director and an expert in book cover design for Amazon KDP. Your mission is to create a prompt for an AI image generator (like Imagen) that will produce a visually stunning, commercially effective, and deeply relevant cover image.

Book Details:
- Title: "${title}"
- Topic: "${topic}"
- Category: "${category}"
- Emotional Keywords: ${keywordList}

Your Creative Process:
1.  **Conceptual and Symbolic Analysis**: Don't just do a literal representation. Dive deep into the topic "${topic}" and the title "${title}". What is the core promise to the reader? What is the key transformation or emotion (hope, power, serenity, curiosity)? Translate these abstract concepts into a **powerful and original visual metaphor**. Strictly avoid clichés and generic stock photo imagery.
2.  **Visual Market Research**: Analyze current bestsellers in the "${category}" category on Amazon to understand the visual language that attracts the target audience. Identify archetypes, color palettes, and styles, but not to imitate them. The goal is to innovate and stand out while speaking a familiar language to the reader.
3.  **Winning Concept Development**: Choose a single, strong artistic direction (e.g., photographic, illustrative, graphic, symbolic) and build the prompt around it.
4.  **Final Prompt Construction**: Write a single prompt, in English, that is a masterpiece of descriptiveness. It must be rich, evocative, and precise.

Final Prompt Requirements:
-   **Language**: Exclusively in **English**.
-   **Focus on Symbolism**: The main subject must be a visual metaphor, not a literal depiction of the title.
-   **Absolute Specificity**: Include details on:
    *   **Subject and Scene**: Describe the central visual element and its environment with great detail. If it's an object, describe its texture, material, and symbolic meaning. If it's a scene, describe the atmosphere.
    *   **Artistic Style**: Be precise (e.g., "cinematic high-definition photography with soft bokeh", "painterly digital illustration with rich textures", "bold and minimalist vector graphic design").
    *   **Composition and Text Space**: Guide the AI on element placement. **THIS IS CRITICAL**: design the composition (e.g., "using the rule of thirds", "subject off-center to the left") to leave a large, clean area of negative space at the top for the title and subtitle.
    *   **Lighting**: Describe the lighting to create the desired mood (e.g., "dramatic, low-key lighting creating long shadows", "soft, ethereal lighting coming from above", "vibrant neon glow").
    *   **Color Palette**: Define a specific and emotional color palette (e.g., "an analogous color palette of blues and greens to evoke calm, with a single accent of orange for energy", "monochromatic tones of gray with a single bright red element").
-   **Output**: Provide **only the final prompt text**, with no introduction, explanation, analysis, or alternative options.

Example of a quality output for a book on procrastination:
"Surrealist digital illustration of an elegant glass hourglass where the falling sand transforms into a flock of paper birds flying away freely. The background is a sunset sky with warm, gradient colors from purple to orange. The lighting is soft and emanates from within the hourglass, creating a magical glow. Detailed painterly style with visible textures. Minimalist composition with the hourglass off-center, leaving ample negative space at the top for text."`;

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
    return `Book cover for a book titled "${title}" on the topic of "${topic}". Clean, modern, and eye-catching design, incorporating ideas from these keywords: ${keywordList}. The reference category is ${category}.`;
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
                responseModalities: [Modality.IMAGE],
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
    const prompt = `Basato su un libro su "${topic}", genera un prompt breve, creativo e descrittivo in **italiano** per creare un/una ${type}. Il prompt deve essere una singola frase accattivante. Ad esempio, se l'argomento è "Cucina Italiana Salutare" e il tipo è "ricetta", un buon prompt potrebbe essere "Una versione leggera e salutare delle lasagne classiche con zucchine al posto della pasta." L'output deve essere solo il testo del prompt.`;
    
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

/**
 * Genera un'immagine per un blocco di contenuto (ricetta/esercizio).
 */
export const generateContentBlockImage = async (title: string, type: ContentBlockType): Promise<string | null> => {
    const stylePrompt = type === 'recipe'
        ? 'A professional, high-quality photograph of the finished dish, cookbook style, bright lighting, clean background, appetizing, hyper-realistic.'
        : 'A clear, instructional, high-quality photograph of a person performing the exercise, studio lighting, focus on proper form, minimalist background, realistic.';

    const prompt = `${stylePrompt} Image of: "${title}".`;

    try {
        // Fix: Explicitly type the response to ensure correct type inference.
        const response: GenerateImagesResponse = await withRetry(() => ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        }));

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        return null;
    } catch (error) {
        console.error(`Error generating ${type} image:`, error);
        return null;
    }
};

/**
 * Traduce un dato testo in una lingua di destinazione.
 */
export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
    if (!text || text.trim() === '') {
        return '';
    }
    const targetLanguageName = { en: 'English', de: 'German' }[targetLanguage] || targetLanguage;

    const prompt = `You are an expert multilingual translator. Translate the following text from Italian to ${targetLanguageName}.
    Preserve original formatting such as line breaks or special characters.
    Return ONLY the translated text, without any introductory phrases or explanations.

    Text to translate:
    ---
    ${text}
    ---
    `;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        }));
        return response.text.trim();
    } catch (error) {
        console.error(`Error translating text to ${targetLanguage}:`, error);
        return `[Translation Error] ${text}`; // Restituisce il testo originale con un marcatore di errore
    }
};

/**
 * Traduce l'intero contenuto testuale di un progetto.
 */
export const translateFullProject = async (
    project: Project, 
    targetLanguage: string, 
    onProgress: (progress: number) => void
): Promise<Project> => {
    
    const translatedProject = JSON.parse(JSON.stringify(project)); // Copia profonda

    const textsToTranslate: { obj: any; key: string }[] = [];

    // Raccoglie tutti i campi di testo
    if (translatedProject.bookTitle) textsToTranslate.push({ obj: translatedProject, key: 'bookTitle' });
    if (translatedProject.subtitle) textsToTranslate.push({ obj: translatedProject, key: 'subtitle' });
    if (translatedProject.author) textsToTranslate.push({ obj: translatedProject, key: 'author' });
    
    translatedProject.bookStructure?.chapters.forEach((ch: any) => {
        if (ch.title) textsToTranslate.push({ obj: ch, key: 'title' });
        if (ch.content) textsToTranslate.push({ obj: ch, key: 'content' });
        ch.subchapters.forEach((sub: any) => {
            if (sub.title) textsToTranslate.push({ obj: sub, key: 'title' });
            if (sub.content) textsToTranslate.push({ obj: sub, key: 'content' });
        });
    });

    translatedProject.contentBlocks?.forEach((block: any) => {
        if (block.title) textsToTranslate.push({ obj: block, key: 'title' });
        if (block.textContent) textsToTranslate.push({ obj: block, key: 'textContent' });
    });
    
    const totalItems = textsToTranslate.length;
    if (totalItems === 0) {
        onProgress(100);
        return translatedProject;
    }

    for (let i = 0; i < totalItems; i++) {
        const item = textsToTranslate[i];
        const originalText = item.obj[item.key];
        const translatedText = await translateText(originalText, targetLanguage);
        item.obj[item.key] = translatedText;
        
        const progress = Math.round(((i + 1) / totalItems) * 100);
        onProgress(progress);
        
        // Aggiunge un piccolo ritardo per evitare di raggiungere i limiti di velocità
        if (i < totalItems - 1) {
             await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return translatedProject;
};