/**
 * Type definitions for the AutoResearch Agent
 */

export interface ResearchTopic {
  topic: string;
  depth?: 'basic' | 'intermediate' | 'comprehensive';
  maxSources?: number;
  includeVisualization?: boolean;
  outputFormats?: ('markdown' | 'pdf' | 'googledocs')[];
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  publishDate?: string;
  author?: string;
  relevanceScore?: number;
}

export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  metadata: {
    author?: string;
    publishDate?: string;
    wordCount: number;
  };
}

export interface Citation {
  id: string;
  title: string;
  url: string;
  author?: string;
  publishDate?: string;
  accessDate: string;
}

export interface ResearchSection {
  title: string;
  content: string;
  citations: string[]; // Citation IDs
  subsections?: ResearchSection[];
}

export interface ResearchReport {
  topic: string;
  generatedAt: string;
  sections: ResearchSection[];
  citations: Citation[];
  summary: string;
  visualizations?: Visualization[];
}

export interface Visualization {
  type: 'chart' | 'table';
  title: string;
  data: unknown;
  description: string;
}

export interface AgentState {
  topic: string;
  queries: string[];
  searchResults: SearchResult[];
  extractedContent: ExtractedContent[];
  analysis: string;
  report: ResearchReport | null;
  status: 'initializing' | 'searching' | 'extracting' | 'analyzing' | 'generating' | 'complete' | 'error';
  error?: string;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SearchToolInput {
  query: string;
  maxResults?: number;
}

export interface ContentExtractionInput {
  url: string;
  timeout?: number;
}

export interface AnalysisInput {
  contents: ExtractedContent[];
  topic: string;
}

export interface ReportGenerationInput {
  topic: string;
  analysis: string;
  citations: Citation[];
  includeVisualization?: boolean;
}
