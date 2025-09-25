import type { GenerateContentResponse } from "@google/genai";

export type TabKey = 'research' | 'structure' | 'content' | 'layout' | 'cover' | 'metadata' | 'validation';

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
}

export interface TitleSuggestion {
  title: string;
}

export interface SubtitleSuggestion {
  subtitle: string;
}

export interface Keyword {
  keyword: string;
}

export interface ResearchResult {
  marketSummary: string;
  titles: TitleSuggestion[];
  subtitles: SubtitleSuggestion[];
  keywords: Keyword[];
  sources: GroundingSource[];
}

export type Language = 'it' | 'en';

export interface SubChapter {
  id: string;
  title: string;
  content: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  subchapters: SubChapter[];
}

export interface BookStructure {
  chapters: Chapter[];
}

export type LayoutTemplate = 'Classic' | 'Modern' | 'Minimalist';

export interface Project {
  id: string;
  projectTitle: string;
  topic: string;
  subtitle: string;
  author: string;
  description: string;
  metadataKeywords: Keyword[];
  categories: string;
  researchData: ResearchResult | null;
  selectedSources: GroundingSource[];
  bookStructure: BookStructure | null;
  lastSaved: string;
  layoutTemplate: LayoutTemplate;
  coverImage: string | null; // base64 string
  coverOptions: string[]; // array of base64 strings
}