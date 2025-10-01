import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse } from "@google/genai";
import type { BookStructure, ResearchResult, Keyword, GroundingSource } from '../types';

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
        // FIX: Explicitly type the response to avoid 'unknown' type error.
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
  const prompt = `Esegui una ricerca approfondita per un libro da pubblicare su Amazon KDP sull'argomento: "${topic}".
  Fornisci una risposta strutturata in formato JSON con i seguenti campi:
  - "marketSummary": un'analisi concisa del mercato di riferimento e del potenziale pubblico.
  - "titles": un array di 5 oggetti, ognuno con "title" (stringa) e "relevance" (un numero da 0 a 100 che indica la pertinenza).
  - "subtitles": un array di 5 oggetti, ognuno con "subtitle" (stringa) e "relevance" (numero da 0 a 100).
  - "keywords": un array di 10 oggetti, ognuno con "keyword" (stringa) e "relevance" (numero da 0 a 100). Queste parole chiave devono essere altamente performanti per Amazon KDP, concentrandosi su un alto intento di acquisto, redditività commerciale e un forte potenziale di conversione. Includi un mix di parole chiave a coda corta e a coda lunga.
  
  Ordina internamente ogni array in base alla pertinenza, dal più alto al più basso.
  Assicurati che l'output sia un oggetto JSON valido.`;

  try {
    // FIX: Explicitly type the response to avoid 'unknown' type error.
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    }));

    // FIX: Explicitly type the response to avoid 'unknown' type error.
    const researchData = parseJsonFromMarkdown<ResearchResult>(response.text);
    // FIX: Explicitly type the response to avoid 'unknown' type error.
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
    // FIX: Explicitly type the response to avoid 'unknown' type error.
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
// FIX: Add explicit return type for better type inference.
): Promise<AsyncGenerator<GenerateContentResponse>> => {
  const keywordList = keywords && keywords.length > 0 ? keywords.map(k => k.keyword).join(', ') : '';
  
  const writingGuidelines = [
    tone && `- Tono di voce: ${tone}`,
    audience && `- Pubblico di destinazione: ${audience}`,
    style && `- Stile di scrittura: ${style}`
  ].filter(Boolean).join('\n');

  const prompt = `Scrivi il contenuto per il libro sull'argomento "${topic}".
Sezione corrente: Capitolo "${chapterTitle}" ${subchapterTitle ? `- Sottocapitolo "${subchapterTitle}"` : ''}.
${writingGuidelines ? `\nAderisci alle seguenti linee guida di scrittura:\n${writingGuidelines}` : ''}
Scrivi in modo chiaro, informativo e coinvolgente.
${keywordList ? `Integra in modo naturale e strategico le seguenti parole chiave nel testo per migliorare l'ottimizzazione SEO: ${keywordList}.` : ''}
${wordCount ? `Scrivi un contenuto estremamente dettagliato, approfondito e completo, di almeno ${wordCount} parole.` : ''}
Formatta il testo con paragrafi ben definiti. Non includere il titolo del capitolo o del sottocapitolo nel testo generato.`;

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
The prompt must be in English, descriptive, and aim for a commercially successful design that would stand out. Emphasize visual elements, mood, and composition. For example: "A minimalist book cover with a deep blue background. In the center, a stylized, golden line art of a brain with interconnected nodes. The title '${title}' is in a clean, white, sans-serif font at the top. The overall mood is intelligent, modern, and professional."
The output must be only the text of the prompt, without any other introductory text or explanation.`;

  try {
    // FIX: Explicitly type the response to avoid 'unknown' type error.
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
// FIX: Add explicit return type for better type inference.
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
 * Genera una descrizione del libro per i metadati KDP.
 */
export const generateDescription = async (title: string, structure: BookStructure | null): Promise<string> => {
    const chapterTitles = structure?.chapters.map(c => c.title).join(', ') || 'vari argomenti';
    const prompt = `Scrivi una descrizione di prodotto avvincente per un libro intitolato "${title}".
    Il libro tratta i seguenti argomenti principali: ${chapterTitles}.
    La descrizione deve essere persuasiva, ottimizzata per Amazon KDP e lunga circa 150-200 parole.
    Evita di usare markdown o formattazione speciale.`;

    try {
        // FIX: Explicitly type the response to avoid 'unknown' type error.
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
    // FIX: Explicitly type the response to avoid 'unknown' type error.
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

    // Con responseMimeType: "application/json", la risposta dovrebbe essere una stringa JSON valida.
    const categories = JSON.parse(response.text.trim()) as string[];
    // Ordina alfabeticamente per una visualizzazione coerente
    return categories?.sort() || [];
  } catch (error) {
    console.error("Error fetching Amazon categories:", error);
    // Restituisce un elenco predefinito in caso di errore per garantire la funzionalità
    return ["Arts & Photography", "Biographies & Memoirs", "Business & Money", "Children's Books", "Comics & Graphic Novels", "Computers & Technology", "Cookbooks, Food & Wine", "Crafts, Hobbies & Home", "Education & Teaching", "Engineering & Transportation", "Health, Fitness & Dieting", "History", "Humor & Entertainment", "Law", "Lesbian, Gay, Bisexual & Transgender Books", "Literature & Fiction", "Medical Books", "Mystery, Thriller & Suspense", "Parenting & Relationships", "Politics & Social Sciences", "Reference", "Religion & Spirituality", "Romance", "Science & Math", "Science Fiction & Fantasy", "Self-Help", "Sports & Outdoors", "Teen & Young Adult", "Test Preparation", "Travel"];
  }
};