import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse, Modality } from "@google/genai";
import type { BookStructure, ResearchResult, Keyword, GroundingSource, Project, ContentBlockType, Trend, Language } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Esegue una chiamata API asincrona con una logica di tentativi esponenziali di backoff.
 * Specifico per errori di rate limit (429).
 */
async function withRetry<T>(
  apiCall: () => Promise<T>,
  maxRetries = 5,
  initialDelay = 61000
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
 * Scopre argomenti di tendenza per libri KDP in un dato periodo.
 */
export const discoverTrends = async (category: string, market: string): Promise<{ trends: Trend[] | null; sources: GroundingSource[] }> => {
  const marketToDomain: { [key: string]: string } = {
    'Italy': 'amazon.it',
    'USA': 'amazon.com',
    'UK': 'amazon.co.uk',
    'Germany': 'amazon.de',
    'France': 'amazon.fr',
    'Spain': 'amazon.es',
    'Canada': 'amazon.ca',
    'Japan': 'amazon.co.jp',
  };
  const amazonDomain = marketToDomain[market] || 'amazon.com';

  const prompt = `AGISCI COME un analista di mercato KDP esperto. La tua missione è analizzare i dati di vendita e le tendenze di mercato dal sito **${amazonDomain}** per identificare le 5 nicchie di saggistica più redditizie e con meno concorrenza per il self-publishing su Amazon KDP, focalizzandoti sulla categoria: "${category}".

Se la categoria è "Tutte le Categorie" o "Libri", analizza il mercato librario nel suo complesso su **${amazonDomain}**. Altrimenti, fornisci risultati specifici per la categoria data.

Per ogni nicchia identificata, fornisci:
1. "topic": Il nome della nicchia o dell'argomento del libro, conciso e pronto per KDP.
2. "reason": Una spiegazione breve (1-2 frasi) e convincente del perché questa nicchia è profittevole, analizzando le tendenze di mercato e identificando opportunità per nuovi autori all'interno della categoria di riferimento ("${category}") e del mercato ("${market}").
3. "trendScore": un punteggio da 0 a 100 che rappresenta il potenziale di redditività della nicchia. 100 è il massimo potenziale.

Fornisci la risposta esclusivamente come un array JSON di oggetti. Ordina i risultati dal "trendScore" più alto al più basso. Assicurati che l'analisi sia basata sulle informazioni più recenti disponibili nel tuo set di dati per il mercato di riferimento. L'output deve essere solo il JSON.`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              reason: { type: Type.STRING },
              trendScore: { type: Type.NUMBER }
            },
            required: ["topic", "reason", "trendScore"]
          }
        }
      },
    }));
    
    const trendsData = JSON.parse(response.text.trim()) as Trend[];
    
    return { trends: trendsData, sources: [] };
  } catch (error) {
    console.error("Error during trend discovery:", error);
    return { trends: null, sources: [] };
  }
};


/**
 * Esegue una ricerca approfondita su un argomento utilizzando Gemini con Google Search.
 */
export const researchTopic = async (topic: string, market: string): Promise<{ result: ResearchResult | null; sources: GroundingSource[] }> => {
  const prompt = `AGISCI COME un esperto di marketing e publishing per Amazon KDP. Esegui una ricerca approfondita, basata sulle informazioni più recenti dal web e con un focus sul mercato di **${market}**, per un libro sull'argomento: "${topic}".
L'obiettivo è massimizzare le vendite e la visibilità in quel mercato specifico. Fornisci una risposta strutturata in Markdown con le seguenti sezioni ESATTE, ciascuna seguita da un elenco puntato o da un paragrafo:

### Market Summary
[Un'analisi concisa del mercato di riferimento, del potenziale pubblico e delle tendenze.]

### KDP Keywords
[Un elenco di 10 parole chiave KDP redditizie, miste tra coda corta e lunga, con il più alto intento di acquisto. Per ogni parola chiave, fornisci:
- Una valutazione del **Volume di Ricerca** (Valori possibili: Alto, Medio, Basso).
- Una valutazione della **Competizione** (Valori possibili: Alta, Media, Bassa).
- Un punteggio di **Rilevanza** (Rilevanza: X%).
Formatta ogni voce in questo modo ESATTO, ordinando per Rilevanza decrescente:
- [Parola Chiave] (Rilevanza: X%, Volume: [Valore], Competizione: [Valore])]

### Suggested Titles
- [Titolo 1] (Rilevanza: X%)
- [Titolo 2] (Rilevanza: X%)
- ... (Fornisci 5 titoli magnetici che massimizzano il CTR e incorporano parole chiave)

### Suggested Subtitles
- [Sottotitolo 1] (Rilevanza: X%)
- [Sottotitolo 2] (Rilevanza: X%)
- ... (Fornisci 5 sottotitoli che espandono il titolo e contengono parole chiave)
`;

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    }));
    
    const text = response.text.trim();
    // Regex per splittare in base a "### Header" e catturare sia l'header che il contenuto
    const sections = text.split(/#{3}\s(.+)/).slice(1);

    const researchData: Omit<ResearchResult, 'sources'> = {
        marketSummary: '',
        keywords: [],
        titles: [],
        subtitles: [],
    };

    const parseListWithRelevance = (content: string): { text: string; relevance: number }[] => {
        return content.trim().split('\n')
            .map(line => line.replace(/^- /, '').trim())
            .map(line => {
                const match = line.match(/(.+) \(Rilevanza:\s*(\d+)%\)/i);
                if (match) {
                    return { text: match[1].trim(), relevance: parseInt(match[2], 10) };
                }
                return { text: line, relevance: 0 };
            })
            .filter(item => item.text);
    };

    const parseKeywords = (content: string): Keyword[] => {
        return content.trim().split('\n')
            .map(line => line.replace(/^- /, '').trim())
            .map(line => {
                const match = line.match(/(.+) \(Rilevanza:\s*(\d+)%,\s*Volume:\s*([^,]+),\s*Competizione:\s*([^)]+)\)/i);
                if (match) {
                    return {
                        keyword: match[1].trim(),
                        relevance: parseInt(match[2], 10),
                        searchVolume: match[3].trim(),
                        competition: match[4].trim(),
                    };
                }
                // Fallback for old format or parsing errors
                const oldMatch = line.match(/(.+) \(Rilevanza:\s*(\d+)%\)/i);
                if (oldMatch) {
                    return {
                        keyword: oldMatch[1].trim(),
                        relevance: parseInt(oldMatch[2], 10),
                        searchVolume: 'N/A',
                        competition: 'N/A',
                    };
                }
                return null;
            })
            .filter((item): item is Keyword => item !== null && !!item.keyword);
    };

    for (let i = 0; i < sections.length; i += 2) {
        const header = sections[i]?.trim();
        const content = sections[i + 1]?.trim() || '';

        if (header === 'Market Summary') {
            researchData.marketSummary = content;
        } else if (header === 'KDP Keywords') {
            researchData.keywords = parseKeywords(content);
        } else if (header === 'Suggested Titles') {
            researchData.titles = parseListWithRelevance(content).map(item => ({ title: item.text, relevance: item.relevance }));
        } else if (header === 'Suggested Subtitles') {
            researchData.subtitles = parseListWithRelevance(content).map(item => ({ subtitle: item.text, relevance: item.relevance }));
        }
    }

    const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const validSources = groundingSources.filter(s => s.web?.uri && s.web.title);
    
    const finalResult: ResearchResult = {
        ...researchData,
        sources: validSources,
    };
    
    return { result: finalResult, sources: validSources };
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
I titoli dei capitoli e dei sottocapitoli devono essere pertinenti, coprire in modo esauriente l'argomento e includere in modo naturale le seguenti parole chiave per massimizzare la visibilità e le vendite su Amazon: ${keywordList}.
Fornisci la risposta come un singolo oggetto JSON con una chiave "chapters" che contiene un array di oggetti capitolo.`;
  
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

Linee Guida Fondamentali per un Contenuto da Bestseller:
1.  **Qualità Superiore**: Scrivi in modo professionale, chiaro e informativo. Il livello deve essere impeccabile, paragonabile a un libro leader nel suo settore. Evita frasi generiche e superficiali.
2.  **Stile Coinvolgente e Magnetico**: Utilizza tecniche di storytelling per catturare l'attenzione. Inizia ogni sezione con un'apertura forte e concludi con un pensiero o una transizione che inviti a continuare la lettura. Varia la struttura delle frasi per creare un ritmo di lettura dinamico.
3.  **Struttura Chiara**: Organizza il contenuto in modo logico. Dove appropriato, usa sotto-intestazioni implicite (separate da una riga vuota) o elenchi puntati/numerati per migliorare la leggibilità e la comprensione.
4.  **Tono Autorevole ma Accessibile**: Posizionati come un esperto, ma spiega concetti complessi in modo semplice e comprensibile per il pubblico di destinazione. Usa un linguaggio che risuoni con loro.
5.  **Valore Pratico Immenso**: Fornisci esempi pratici, strategie attuabili, aneddoti, analogie o casi studio che il lettore possa applicare. Il contenuto deve essere utile e trasformazionale.
6.  **Originalità e Profondità**: Non limitarti a ripetere informazioni comuni. Offri una prospettiva unica, approfondimenti non ovvi e una sintesi intelligente delle informazioni.
7.  **Accuratezza Assoluta**: Verifica che tutte le informazioni siano aggiornate, corrette e supportate da fonti attendibili se necessario.
8.  **Ottimizzazione per KDP**: ${keywordList ? `Integra in modo naturale e strategico le seguenti parole chiave per massimizzare la visibilità: ${keywordList}.` : 'Scrivi in modo naturale senza forzare parole chiave.'}

${writingGuidelines ? `\nSegui anche queste specifiche aggiuntive:\n${writingGuidelines}` : ''}

${wordCountInstruction}

Output:
- Fornisci solo il testo del contenuto, senza alcuna introduzione, titolo o preambolo.
- Formatta il testo in paragrafi ben strutturati per una leggibilità ottimale, utilizzando interruzioni di riga per separare le idee.`;

  return withRetry(() => ai.models.generateContentStream({
    model: "gemini-2.5-pro",
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
1.  **Target Audience and Emotional Tone Analysis (CRITICAL FIRST STEP)**: Based on the book's details, first analyze and define the target audience (e.g., beginners, experts, young adults) and the core emotional tone of the book (e.g., empowering, serene, urgent, mysterious). This analysis is the foundation and MUST guide all subsequent visual choices.
2.  **Conceptual and Symbolic Analysis**: Don't just do a literal representation. Dive deep into the topic "${topic}" and the title "${title}". What is the core promise to the reader? What is the key transformation or emotion (hope, power, serenity, curiosity)? Translate these abstract concepts into a **powerful and original visual metaphor**. Strictly avoid clichés and generic stock photo imagery.
3.  **Visual Market Research**: Analyze current bestsellers in the "${category}" category on Amazon to understand the visual language that attracts the target audience. Identify archetypes, color palettes, and styles, but not to imitate them. The goal is to innovate and stand out while speaking a familiar language to the reader.
4.  **Winning Concept Development**: Choose a single, strong artistic direction (e.g., photographic, illustrative, graphic, symbolic) and build the prompt around it.
5.  **Final Prompt Construction**: Write a single prompt, in English, that is a masterpiece of descriptiveness. It must be rich, evocative, and precise.

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
      model: "gemini-2.5-pro",
      contents: prompt,
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
export const generateDescription = async (title: string, structure: BookStructure | null): Promise<{ description: string, sources: GroundingSource[] }> => {
    const chapterTitles = structure?.chapters.map(c => c.title).join(', ') || 'vari argomenti';
    const prompt = `AGISCI COME un copywriter di livello mondiale specializzato in descrizioni di libri per Amazon KDP che convertono. La tua missione è scrivere una descrizione magnetica e irresistibile per un libro intitolato "${title}".
Il libro tratta i seguenti argomenti principali: ${chapterTitles}.

Segui questa struttura vincente in 3 parti per massimizzare l'impatto e le vendite:
1.  **Gancio Potente (Prime 1-2 frasi)**: Inizia con una domanda audace, una statistica scioccante o un'affermazione che colpisca direttamente il punto dolente o il desiderio più grande del lettore. Cattura immediatamente la loro attenzione.
2.  **Corpo Persuasivo (Paragrafo centrale)**: Elenca i benefici chiave e le soluzioni che il lettore otterrà leggendo il libro. Usa un linguaggio orientato all'azione. Spiega cosa impareranno, come la loro vita migliorerà o quale problema risolveranno.
3.  **Call to Action Irresistibile (Frase finale)**: Concludi con un invito all'azione chiaro, energico e ad altissima conversione che spinga il lettore a comprare ORA.

Requisiti Aggiuntivi:
-   **Linguaggio**: Scrivi in italiano fluente e naturale.
-   **Lunghezza**: Mantieni la descrizione tra le 150 e le 200 parole.
-   **Emoji Strategiche**: Inserisci 3-5 emoji altamente motivanti (es. ✨, 🚀, 💪, ✅, 📚) per spezzare il testo e aumentare l'engagement visivo. Posizionale in modo strategico per enfatizzare i punti chiave.
-   **Formattazione**: NON usare markdown o HTML. Fornisci solo il testo puro.

Esempio di Call to Action efficace: "Non aspettare un altro giorno per trasformare la tua vita. Scorri verso l'alto e clicca su 'Acquista ora' per iniziare il tuo viaggio oggi stesso!"`;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        }));
        return { description: response.text.trim(), sources: [] };
    } catch(error) {
        console.error("Error generating description:", error);
        return { description: "", sources: [] };
    }
};

/**
 * Genera un elenco di categorie di libri comuni adatte per Amazon KDP.
 */
export const fetchAmazonCategories = async (language: Language): Promise<string[]> => {
  const languageName = language === 'it' ? 'Italian' : 'English';
  const prompt = `Generate a comprehensive list of top-level book categories as found on major online bookstores like Amazon. Provide the list in ${languageName}.
  Return the result as a single, flat JSON array of strings. For example: ["Arts & Photography", "Biographies & Memoirs", "Business & Money"].
  Do not include sub-categories. The output must be only the JSON array. Do not include a general category like "Books" or "All categories".`;

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
    if (language === 'it') {
        return ['Libri', 'Adolescenti e ragazzi', 'Arte, cinema e fotografia', 'Calendari e agende', 'Diritto', 'Dizionari e opere di consultazione', 'Economia, affari e finanza', 'Famiglia, salute e benessere', 'Fantascienza e fantasy', 'Fumetti e manga', 'Gialli e thriller', 'Guide di revisione e aiuto allo studio', 'Humor', 'Informatica, web e digital media', 'Letteratura e narrativa', 'Libri per bambini', 'Libri scolastici', 'Politica', 'Religione', 'Romanzi rosa', 'Scienze, tecnologia e medicina', 'Self-help', 'Società e scienze sociali', 'Sport', 'Storia', 'Viaggi'];
    }
    return ["Arts & Photography", "Biographies & Memoirs", "Business & Money", "Children's Books", "Comics & Graphic Novels", "Computers & Technology", "Cookbooks, Food & Wine", "Crafts, Hobbies & Home", "Education & Teaching", "Engineering & Transportation", "Health, Fitness & Dieting", "History", "Humor & Entertainment", "Law", "Lesbian, Gay, Bisexual & Transgender Books", "Literature & Fiction", "Medical Books", "Mystery, Thriller & Suspense", "Parenting & Relationships", "Politics & Social Sciences", "Reference", "Religion & Spirituality", "Romance", "Science & Math", "Science Fiction & Fantasy", "Self-Help", "Sports & Outdoors", "Teen & Young Adult", "Test Preparation", "Travel"];
  }
};

/**
 * Genera un prompt per un blocco di contenuto bonus.
 */
export const generateContentBlockPrompt = async (project: Project, contentType: ContentBlockType): Promise<string> => {
    const chapterTitles = project.bookStructure?.chapters.map(c => c.title).slice(0, 5).join(', ') || '';
    const context = `Basandosi su un libro intitolato "${project.bookTitle}" sull'argomento "${project.topic}", che include capitoli come "${chapterTitles}"...`;
    
    let typeInstruction = '';
    switch (contentType) {
        case 'recipe':
            typeInstruction = "Per una 'ricetta', deve essere una singola preparazione, ad esempio: 'Una ricetta per una colazione energetica in linea con i temi del libro.'";
            break;
        case 'exercise':
            typeInstruction = "Per un 'esercizio', deve essere una singola attività, ad esempio: 'Un esercizio di respirazione per ridurre lo stress, spiegato passo dopo passo.'";
            break;
        case 'bonus':
            typeInstruction = "Per un 'bonus', deve essere un singolo contenuto aggiuntivo, ad esempio: 'Una checklist stampabile per la routine mattutina suggerita nel capitolo 3.'";
            break;
    }

    const prompt = `${context} genera un prompt creativo e altamente pertinente in **italiano** per un'appendice di tipo '${contentType}'. Il prompt deve descrivere UN SINGOLO elemento (es. una ricetta, un esercizio), NON una raccolta (es. un menù settimanale, un piano di allenamento). Esempio: ${typeInstruction} L'output deve essere solo il testo del prompt.`;
    
    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        }));
        return response.text.trim();
    } catch (error) {
        console.error(`Error generating bonus prompt:`, error);
        return "";
    }
};


/**
 * Genera il testo per uno o più blocchi di contenuto bonus.
 */
export const generateContentBlockText = async (
    project: Project,
    description: string, 
    count: number = 1,
    existingTitles: string[] = [],
    contentType: ContentBlockType
): Promise<{ title: string; textContent: string }[] | null> => {
    
    const chapterTitles = project.bookStructure?.chapters.map(c => c.title).slice(0, 5).join(', ') || '';
    const context = `per un libro intitolato "${project.bookTitle}" sull'argomento "${project.topic}", i cui capitoli principali includono: "${chapterTitles}".`;
    
    const uniquenessInstruction = existingTitles.length > 0
      ? `IMPORTANTE: Evita di generare contenuti bonus con i seguenti titoli, poiché esistono già: ${existingTitles.join(', ')}.`
      : '';

    const prompt = `Agisci come un esperto creatore di contenuti ed esperto di marketing editoriale. ${context} Basandoti sulla seguente descrizione, genera ${count} contenuti bonus unici di tipo '${contentType}': "${description}".

**REGOLA FONDAMENTALE**: Ogni contenuto bonus generato deve essere un singolo elemento specifico (es. UNA ricetta, UN esercizio, UNA checklist). NON generare raccolte o piani (es. NON un menù settimanale, NON un programma di allenamento). Se la descrizione chiede una raccolta, estrai e genera un singolo elemento rappresentativo da essa.

Per ognuno, fornisci un "title" accattivante e specifico per il singolo elemento, una "description" (un riassunto accattivante del contenuto bonus) e una lista di "items" (punti, passaggi, o elementi per il contenuto bonus).
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
                           description: { type: Type.STRING },
                           items: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["title", "description", "items"]
                    }
                }
            }
        }));
        
        const results = JSON.parse(response.text.trim());

        return results.map((item: any) => {
            let formattedText = `${item.description}\n\n`;
            if (item.items && item.items.length > 0) {
                formattedText += `- ${item.items.join('\n- ')}`;
            }
            return {
                title: item.title,
                textContent: formattedText,
            };
        });

    } catch (error) {
        console.error(`Error generating bonus text:`, error);
        return null;
    }
};

/**
 * Genera un'immagine per un blocco di contenuto bonus.
 */
export const generateContentBlockImage = async (title: string, project: Project): Promise<string | null> => {
    const stylePrompt = `Come illustratore per un libro su "${project.topic}", crea un'immagine pulita, professionale e simbolica per una voce dell'appendice intitolata "${title}". Lo stile deve essere minimalista e grafico, visivamente coerente con il tema del libro e adatto per un'appendice di un libro.`;

    try {
        const response: GenerateImagesResponse = await withRetry(() => ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: stylePrompt,
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
        console.error(`Error generating bonus image:`, error);
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

    let completedItems = 0;

    const translateChunk = async (chunk: { obj: any; key: string }[]) => {
        const promises = chunk.map(item => translateText(item.obj[item.key], targetLanguage));
        const translatedTexts = await Promise.all(promises);
        chunk.forEach((item, index) => {
            item.obj[item.key] = translatedTexts[index];
        });
        completedItems += chunk.length;
        onProgress(Math.round((completedItems / totalItems) * 100));
    };

    // Elabora in blocchi per evitare di raggiungere i limiti di velocità troppo velocemente
    const chunkSize = 5; 
    for (let i = 0; i < totalItems; i += chunkSize) {
        const chunk = textsToTranslate.slice(i, i + chunkSize);
        await translateChunk(chunk);
        // Aggiunge un ritardo significativo tra i blocchi
        if (i + chunkSize < totalItems) {
            await new Promise(resolve => setTimeout(resolve, 61000)); 
        }
    }

    return translatedProject;
};

/**
 * Elabora il testo utilizzando Gemini per varie attività di modifica.
 */
export const processTextWithGemini = async (
  text: string,
  action: 'improve' | 'summarize' | 'expand'
): Promise<string> => {
  let prompt = '';
  let model: 'gemini-2.5-pro' | 'gemini-2.5-flash' = 'gemini-2.5-flash';

  switch (action) {
    case 'improve':
      model = 'gemini-2.5-pro';
      prompt = `AGISCI COME un editor professionista. Riscrivi il seguente testo per migliorarne la chiarezza, il coinvolgimento e la qualità generale senza alterarne il significato fondamentale. Migliora la scelta delle parole, la struttura delle frasi e il flusso. Fornisci solo il testo riscritto. Testo da migliorare:\n---\n${text}\n---`;
      break;
    case 'summarize':
      model = 'gemini-2.5-flash';
      prompt = `Riassumi il seguente testo in modo conciso, cogliendo i punti principali. Fornisci solo il riassunto. Testo da riassumere:\n---\n${text}\n---`;
      break;
    case 'expand':
      model = 'gemini-2.5-pro';
      prompt = `Espandi il seguente testo. Aggiungi maggiori dettagli, esempi o spiegazioni per renderlo più completo e informativo. Mantieni uno stile di scrittura coerente. Fornisci solo il testo espanso. Testo da espandere:\n---\n${text}\n---`;
      break;
  }

  try {
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: model,
        contents: prompt
    }));
    return response.text.trim();
  } catch (error) {
    console.error(`Error during text processing with action '${action}':`, error);
    throw error;
  }
};

/**
 * Genera una breve tagline ad alta conversione per la copertina di un libro.
 */
export const generateCoverTagline = async (project: Project): Promise<string> => {
    const prompt = `AGISCI COME un copywriter specializzato in copertine di libri. Crea una tagline estremamente breve (massimo 10 parole), accattivante e ad alta conversione per un libro intitolato "${project.bookTitle}" sull'argomento "${project.topic}".
La tagline deve suscitare curiosità o promettere un beneficio immediato. Deve essere perfetta da inserire sulla copertina di un libro per catturare l'attenzione.
Fornisci solo il testo della tagline, nient'altro.`;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        }));
        return response.text.trim().replace(/"/g, ''); // Rimuove eventuali virgolette
    } catch (error) {
        console.error("Error generating cover tagline:", error);
        return "";
    }
};

/**
 * Analizza un manoscritto completo e fornisce un feedback strutturato.
 */
export const analyzeManuscript = async (manuscriptText: string): Promise<string> => {
    const prompt = `AGISCI COME un editor di libri professionista e un critico letterario di fama mondiale. La tua missione è analizzare in modo approfondito il seguente manoscritto e fornire un feedback costruttivo, dettagliato e attuabile per migliorarne drasticamente la qualità.

Il tuo output deve essere in formato **Markdown** e seguire ESATTAMENTE questa struttura, con intestazioni di terzo livello (###):

### Riepilogo Generale
[Fornisci una valutazione complessiva del manoscritto. Evidenzia i punti di forza principali (es. concetto, voce, ritmo) e le aree di debolezza più significative che necessitano di attenzione.]

### Miglioramenti Strutturali e di Trama
[Analizza la struttura generale, l'arco narrativo, lo sviluppo dei personaggi e il ritmo.
- La trama è avvincente? Ci sono buchi o incongruenze?
- I personaggi sono ben sviluppati e le loro motivazioni sono chiare?
- Il ritmo è efficace o ci sono parti lente/affrettate?
- Fornisci suggerimenti specifici per rafforzare la struttura (es. riordinare capitoli, aggiungere foreshadowing, approfondire un subplot).]

### Perfezionamento Stilistico e di Voce
[Valuta lo stile di scrittura, il tono e la voce dell'autore.
- La prosa è chiara, coinvolgente e coerente?
- La scelta delle parole (diction) è efficace e appropriata?
- Ci sono cliché, frasi ripetitive o passaggi goffi da migliorare?
- Fornisci esempi concreti presi dal testo e suggerisci delle alternative migliori.]

### Chiarezza e Coerenza
[Identifica eventuali passaggi confusi, ambigui o contraddittori.
- La cronologia è chiara?
- I concetti (specialmente in saggi o manuali) sono spiegati in modo efficace?
- Ci sono incongruenze nella caratterizzazione o nei dettagli della trama?
- Elenca i punti problematici in modo che l'autore possa individuarli e correggerli.]

### Prossimi Passi Consigliati
[Concludi con un elenco puntato di 3-5 azioni prioritarie che l'autore dovrebbe intraprendere per migliorare il manoscritto. Sii strategico e concentrati sugli interventi con il maggiore impatto.]

---
MANOSCRITTO DA ANALIZZARE:
---
${manuscriptText}
---
`;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        }));
        return response.text.trim();
    } catch (error) {
        console.error("Error analyzing manuscript:", error);
        throw error; // Rilancia l'errore per gestirlo nel componente
    }
};

/**
 * Rigenera un manoscritto basandosi sul testo originale e sull'analisi di un editor.
 */
export const regenerateManuscript = async (originalText: string, analysisText: string): Promise<string> => {
    const prompt = `AGISCI COME un autore e editor esperto di fama mondiale. La tua missione è riscrivere completamente un manoscritto, applicando i suggerimenti di revisione e aggiornandolo con le informazioni più recenti.

Di seguito troverai l'"ANALISI DELL'EDITOR" con un elenco di suggerimenti e il "MANOSCRITTO ORIGINALE".

Il tuo compito è duplice:
1.  **APPLICA LE REVISIONI**: Riscrivi l'intero "MANOSCRITTO ORIGINALE" dall'inizio alla fine, incorporando tutte le modifiche strutturali, stilistiche e di chiarezza suggerite nell'"ANALISI DELL'EDITOR".
2.  **AGGIORNA I CONTENUTI (CRITICO)**: Durante la riscrittura, DEVI aggiornare il contenuto con le informazioni, le statistiche, gli eventi e le scoperte più recenti e attuali disponibili tramite la ricerca web. Rendi il libro completamente aggiornato al momento attuale.

Il risultato finale deve essere solo il testo completo del manoscritto revisionato. Non includere alcun commento, spiegazione o intestazione aggiuntiva.

REQUISITI FONDAMENTALI DI FORMATAZIONE E CONTENUTO:
1.  **Conteggio Parole**: Assicurati che ogni capitolo e sottocapitolo nel manoscritto revisionato contenga un minimo di 1000 parole di testo sostanziale e ben sviluppato.
2.  **Formattazione Titoli**: Utilizza ESATTAMENTE la seguente sintassi Markdown per i titoli:
    - Per i **Titoli dei Capitoli (Titolo 1)**, usa '## ' seguito dal titolo (es. '## Capitolo 1: L'Inizio').
    - Per i **Titoli Secondari (Titolo 2)** all'interno di un capitolo, usa '### ' seguito dal titolo (es. '### La Prima Sfida').
    - Per i **Sottotitoli (corsivo)** all'interno di una sezione, usa '#### ' seguito dal sottotitolo (es. '#### Un nuovo punto di vista').

---
ANALISI DELL'EDITOR:
---
${analysisText}
---
MANOSCRITTO ORIGINALE:
---
${originalText}
---
MANOSCRITTO REVISIONATO E AGGIORNATO:
---
`;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                tools: [{googleSearch: {}}],
            },
        }));
        return response.text.trim();
    } catch (error) {
        console.error("Error regenerating manuscript:", error);
        throw error;
    }
};


/**
 * Highlights changes in a manuscript based on an editor's analysis.
 */
export const highlightManuscriptChanges = async (originalText: string, analysisText: string): Promise<string> => {
    const prompt = `AGISCI COME un editor esperto che usa la funzione "Revisioni". La tua missione è modificare il "MANOSCRITTO ORIGINALE" applicando i suggerimenti dall'"ANALISI DELL'EDITOR".

Il tuo output DEVE essere il manoscritto completo, ma con le modifiche chiaramente indicate usando i tag HTML <ins> per le aggiunte e <del> per le cancellazioni.

REGOLE FONDAMENTALI:
1.  **Testo Invariato**: Qualsiasi testo che non viene modificato deve rimanere esattamente com'è, senza alcun tag.
2.  **Aggiunte**: Racchiudi qualsiasi nuovo testo (parole, frasi) che aggiungi all'interno di tag <ins>...</ins>. Esempio: "Il cielo era <ins>molto</ins> blu."
3.  **Cancellazioni**: Racchiudi qualsiasi testo che rimuovi all'interno di tag <del>...</del>. Esempio: "<del>Lui era</del> Il protagonista era stanco."
4.  **Sostituzioni**: Gestisci le sostituzioni come una cancellazione seguita da un'aggiunta. Esempio: "Il suo cappello era <del>rosso</del><ins>blu</ins>."
5.  **Output Completo**: Restituisci l'INTERO manoscritto dall'inizio alla fine, con i tag di revisione applicati. Non fornire spiegazioni, solo il testo HTML formattato.
6.  **Formattazione Originale**: Mantieni la formattazione originale del manoscritto (paragrafi, interruzioni di riga).

---
ANALISI DELL'EDITOR:
---
${analysisText}
---
MANOSCRITTO ORIGINALE:
---
${originalText}
---
MANOSCRITTO CON REVISIONI EVIDENZIATE:
---
`;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        }));
        return response.text.trim();
    } catch (error) {
        console.error("Error highlighting manuscript changes:", error);
        throw error;
    }
};

/**
 * Lists specific changes for a manuscript based on an editor's analysis.
 */
export const listManuscriptChanges = async (originalText: string, analysisText: string): Promise<string> => {
    const prompt = `AGISCI COME un assistente editoriale meticoloso. La tua missione è creare una checklist di modifiche specifiche basata sull'"ANALISI DELL'EDITOR" per il "MANOSCRITTO ORIGINALE".

Crea un elenco puntato in formato **Markdown** di azioni concrete e precise che l'autore deve intraprendere. Ogni punto dell'elenco deve essere specifico e facile da applicare.

Esempi di formato desiderato:
- **Nel Capitolo 3, Paragrafo 2**: Sostituisci la frase "Era molto stanco" con "La stanchezza gli pesava sulle palpebre come macigni" per essere più descrittivo.
- **Generale**: Rimuovi le occorrenze ripetute della parola "quindi" per migliorare il flusso.
- **Nel Capitolo 5**: Considera di spostare la rivelazione sul passato del personaggio prima del confronto finale per aumentare la tensione.

REGOLE:
1.  **Formato**: Usa solo elenchi puntati Markdown (\`- \`).
2.  **Specificità**: Sii il più specifico possibile, indicando capitoli o sezioni se possibile.
3.  **Azione**: Formula ogni punto come un'azione chiara.
4.  **Output**: Fornisci solo l'elenco Markdown, senza introduzioni o conclusioni.

---
ANALISI DELL'EDITOR:
---
${analysisText}
---
MANOSCRITTO ORIGINALE:
---
${originalText}
---
ELENCO DELLE MODIFICHE:
---
`;

    try {
        const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
        }));
        return response.text.trim();
    } catch (error) {
        console.error("Error listing manuscript changes:", error);
        throw error;
    }
};