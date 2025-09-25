import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { BookStructure, ResearchResult } from '../types';

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
 * Esegue una ricerca approfondita su un argomento utilizzando Gemini con il grounding di Google Search.
 */
export const researchTopic = async (topic: string): Promise<{ result: ResearchResult | null; sources: any[] }> => {
  const prompt = `Esegui una ricerca approfondita per un libro da pubblicare su Amazon KDP sull'argomento: "${topic}".
  Fornisci una risposta strutturata in formato JSON con i seguenti campi:
  - "marketSummary": un'analisi concisa del mercato di riferimento e del potenziale pubblico.
  - "titles": un array di 5 oggetti, ognuno con una chiave "title" (stringa).
  - "subtitles": un array di 5 oggetti, ognuno con una chiave "subtitle" (stringa).
  - "keywords": un array di 10 oggetti, ognuno con una chiave "keyword" (stringa), pertinenti per le categorie di Amazon KDP.
  
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

    return { result: researchData, sources: groundingChunks };
  } catch (error) {
    console.error("Error during topic research:", error);
    return { result: null, sources: [] };
  }
};

/**
 * Genera una struttura di libro (capitoli e sottocapitoli) in formato JSON.
 */
export const generateStructure = async (topic: string): Promise<BookStructure | null> => {
  const prompt = `Crea una struttura logica dettagliata per un libro sull'argomento: "${topic}". Includi capitoli principali e sottocapitoli pertinenti per ogni capitolo.`;
  
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
  subchapterTitle?: string
) => {
  const prompt = `Scrivi il contenuto per il libro sull'argomento "${topic}".
  Sezione corrente: Capitolo "${chapterTitle}" ${subchapterTitle ? `- Sottocapitolo "${subchapterTitle}"` : ''}.
  Scrivi in modo chiaro, informativo e coinvolgente per un pubblico di neofiti.
  Formatta il testo con paragrafi ben definiti. Non includere il titolo del capitolo o del sottocapitolo nel testo generato.`;

  return ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
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