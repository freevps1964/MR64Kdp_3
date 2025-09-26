import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { BookStructure, ResearchResult, Keyword, GroundingSource } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        const response = await ai.models.generateContent({
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
        });
        
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
  - "keywords": un array di 10 oggetti, ognuno con "keyword" (stringa) e "relevance" (numero da 0 a 100).
  
  Ordina internamente ogni array in base alla pertinenza, dal più alto al più basso.
  Assicurati che l'output sia un oggetto JSON valido.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

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
  const prompt = `Dato il seguente argomento per un libro KDP: "${topic}", con il titolo provvisorio "${title}" e sottotitolo "${subtitle}", e tenendo conto delle seguenti parole chiave per il posizionamento: ${keywordList}. Crea una struttura logica dettagliata per il libro. La struttura deve essere ben organizzata in capitoli principali e sottocapitoli pertinenti per ogni capitolo, coprendo in modo esauriente l'argomento per un pubblico di riferimento.`;
  
  try {
    const response = await ai.models.generateContent({
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
    });

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
  wordCount?: number
) => {
  const prompt = `Scrivi il contenuto per il libro sull'argomento "${topic}".
  Sezione corrente: Capitolo "${chapterTitle}" ${subchapterTitle ? `- Sottocapitolo "${subchapterTitle}"` : ''}.
  Scrivi in modo chiaro, informativo e coinvolgente per un pubblico di neofiti.
  ${wordCount ? `Scrivi un contenuto estremamente dettagliato, approfondito e completo, di almeno ${wordCount} parole.` : ''}
  Formatta il testo con paragrafi ben definiti. Non includere il titolo del capitolo o del sottocapitolo nel testo generato.`;

  return ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
};

/**
 * Genera un prompt per la copertina analizzando i bestseller su Amazon.
 */
export const generateCoverPromptFromBestsellers = async (topic: string, title: string): Promise<string> => {
  const prompt = `Research the current best-selling book covers on Amazon.com for the topic "${topic}". 
Analyze the common design trends, color palettes, typography styles (e.g., serif, sans-serif, script), and imagery used in the top results.
Based on this analysis, create a highly detailed and effective prompt for an AI image generator (like Imagen) to design a book cover for a book titled "${title}".
The prompt should be in English, descriptive, and aim for a commercially successful design that would stand out in its category.
The output must be only the text of the prompt, without any other introductory text or explanation.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating cover prompt from bestsellers:", error);
    // Fallback to a generic but good prompt
    return `Book cover for a title "${title}" on the topic of "${topic}". Clean, modern, and eye-catching design.`;
  }
};


/**
 * Genera immagini di copertina per il libro.
 */
export const generateCoverImages = (prompt: string) => {
    return ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 2,
          outputMimeType: 'image/png',
          aspectRatio: '3:4',
        },
    });
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
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text;
    } catch(error) {
        console.error("Error generating description:", error);
        return "";
    }
};