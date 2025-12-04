import type { GenerateContentResponse } from "@google/genai";

export type TabKey = 'research' | 'marketTrends' | 'structure' | 'content' | 'appendices' | 'layout' | 'cover' | 'metadata' | 'validation' | 'archive' | 'revision' | 'conversion' | 'audiobook';

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
  searchVolume: string;
  competition: string;
}

export interface Trend {
  topic: string;
  reason: string;
  trendScore: number;
}

export interface ResearchResult {
  marketSummary: string;
  titles: TitleSuggestion[];
  subtitles: SubtitleSuggestion[];
  keywords: Keyword[];
  sources: GroundingSource[];
}

export interface CompetitorBook {
  title: string;
  author: string;
  asin: string;
  reason: string;
  imageUrl: string;
}

export type Language = 'it' | 'en';

export type ToneOfVoice = 'Informal' | 'Formal' | 'Academic' | 'Persuasive' | 'Empathetic' | 'Humorous' | 'Professional' | 'Enthusiastic';
export type TargetAudience = 'Beginners' | 'Experts' | 'General';
export type WritingStyle = 'Descriptive' | 'Narrative' | 'Expository' | 'Argumentative' | 'Poetic' | 'Technical' | 'Conversational' | 'Journalistic';

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

export type LayoutTemplate = 'Classic' | 'Modern' | 'Minimalist' | 'Custom';
export type PageSize = '6x9' | '7x10';

export type ContentBlockType = 'recipe' | 'exercise' | 'bonus';

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  title: string; // From user description, can be edited
  description: string; // User's input prompt
  textContent: string; // Generated text (steps, ingredients, etc.)
  imageUrl: string | null;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
}

export interface CustomStyles {
  titleFont: string;
  titleSize: number; // pt
  subtitleFont: string;
  subtitleSize: number; // pt
  bodyFont: string;
  bodySize: number; // pt
  lineHeight: number; // multiplier
  chapterTitleFont: string;
  chapterTitleSize: number; // pt
}

export type BonusStickerShape = 'star' | 'circle' | 'burst' | 'seal' | 'ribbon' | 'shield' | 'none';

export interface Project {
  id: string;
  projectTitle: string;
  bookTitle: string;
  titlesArchive: string[];
  topic: string;
  subtitle: string;
  subtitlesArchive: string[];
  author: string;
  authorsArchive: string[];
  description: string;
  descriptionsArchive: string[];
  metadataKeywords: Keyword[];
  categories: string[];
  categoriesArchive: string[][];
  researchData: ResearchResult | null;
  selectedSources: GroundingSource[];
  bookStructure: BookStructure | null;
  lastSaved: string;
  layoutTemplate: LayoutTemplate;
  customStyles?: CustomStyles;
  pageSize: PageSize;
  coverImage: string | null; // base64 string
  coverOptions: string[]; // array of base64 strings
  coverPrompts: string[];
  archivedCovers: string[]; // New: array of selected base64 strings
  competitorBooks?: CompetitorBook[]; // New: Top 3 bestsellers
  contentBlocks: ContentBlock[]; 
  glossary: GlossaryTerm[];
  coverBonusCount: number;
  titleFontSize: number;
  subtitleFontSize: number;
  authorFontSize: number;
  bonusStickerShape: BonusStickerShape;
  coverTagline: string;
  manuscript?: {
    text: string;
    analysis: string;
    regenerated?: string;
    highlighted?: string;
    changeList?: string;
  };
}