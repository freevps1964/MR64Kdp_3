import type { GenerateContentResponse } from "@google/genai";

export type TabKey = 'research' | 'structure' | 'content' | 'recipes' | 'layout' | 'cover' | 'metadata' | 'validation';

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
  relevance?: number;
}

export interface TitleSuggestion {
  title: string;
  relevance: number;
}

export interface SubtitleSuggestion {
  subtitle: string;
  relevance: number;
}

export interface Keyword {
  keyword: string;
  relevance: number;
}

export interface ResearchResult {
  marketSummary: string;
  titles: TitleSuggestion[];
  subtitles: SubtitleSuggestion[];
  keywords: Keyword[];
  sources: GroundingSource[];
}

export type Language = 'it' | 'en';

export type ToneOfVoice = 'Informal' | 'Formal' | 'Academic' | 'Persuasive';
export type TargetAudience = 'Beginners' | 'Experts' | 'General';
export type WritingStyle = 'Descriptive' | 'Narrative' | 'Expository' | 'Argumentative';

export interface SubChapter {
  id: string;
  title: string;
  content: string;
}

export interface Chapter {
  id:string;
  title: string;
  content: string;
  subchapters: SubChapter[];
}

export interface BookStructure {
  chapters: Chapter[];
}

export type LayoutTemplate = 'Classic' | 'Modern' | 'Minimalist';
export type PageSize = '6x9' | '7x10';

export type ContentBlockType = 'recipe' | 'exercise';

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  title: string; // From user description, can be edited
  description: string; // User's input prompt
  textContent: string; // Generated text (steps, ingredients, etc.)
  image: string | null; // Generated base64 image
}


export interface Project {
  id: string;
  projectTitle: string;
  bookTitle: string;
  topic: string;
  subtitle: string;
  author: string;
  authorsArchive: string[];
  description: string;
  metadataKeywords: Keyword[];
  categories: string[];
  researchData: ResearchResult | null;
  selectedSources: GroundingSource[];
  bookStructure: BookStructure | null;
  lastSaved: string;
  layoutTemplate: LayoutTemplate;
  pageSize: PageSize;
  coverImage: string | null; // base64 string
  coverOptions: string[]; // array of base64 strings
  archivedCovers: string[]; // New: array of selected base64 strings
  contentBlocks: ContentBlock[]; // New: for recipes/exercises
}