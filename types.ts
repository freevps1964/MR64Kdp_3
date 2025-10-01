import type { GenerateContentResponse } from "@google/genai";

export type TabKey = 'research' | 'structure' | 'content' | 'layout' | 'cover' | 'metadata' | 'validation';

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

export interface Project {
  id: string;
  projectTitle: string;
  bookTitle: string;
  topic: string;
  subtitle: string;
  author: string;
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
}