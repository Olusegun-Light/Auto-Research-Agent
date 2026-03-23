/**
 * Type definitions for the AutoResearch Agent
 */

/**
 * Research mode controls depth of analysis, source count and validation behaviour.
 * - standard : default balanced research
 * - deep     : more sources, deeper analysis, full validation
 * - fast     : fewer sources, lighter analysis, no validation
 * - critical : standard sources + stronger peer-review critique pass
 * - data     : tables and structured-data references included in report
 */
export type ResearchMode = 'standard' | 'deep' | 'fast' | 'critical' | 'data';

export interface ResearchTopic {
  topic: string;
  depth?: 'basic' | 'intermediate' | 'comprehensive';
  maxSources?: number;
  includeVisualization?: boolean;
  outputFormats?: ('markdown' | 'pdf' | 'googledocs')[];
  mode?: ResearchMode;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  publishDate?: string;
  author?: string;
  relevanceScore?: number;
  credibilityScore?: number; // 1-10: injected after Phase-3 filtering
}

export interface SourceCredibility {
  url: string;
  title: string;
  author?: string;
  year?: string;
  credibilityScore: number; // 1–10
  rationale: string;
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
  outline?: ResearchOutline;
  notes?: ResearchNote[];
  validation?: ValidationResult;
  traceability?: TraceabilityEntry[];
}

// ─── Phase 1 & 2 ─────────────────────────────────────────────────────────────

export interface ResearchQuestion {
  question: string;
  subtopic: string;
}

export interface OutlineSection {
  title: string;
  intent: string;
}

export interface ResearchOutline {
  topicSummary: string;
  researchType: 'theoretical' | 'empirical' | 'review' | 'technical';
  researchQuestions: ResearchQuestion[];
  sections: OutlineSection[];
}

// ─── Phase 4 ─────────────────────────────────────────────────────────────────

export type NoteConfidence = 'high' | 'medium' | 'low';

export interface ResearchNote {
  claim: string;         // One clear, specific statement
  author: string;        // Author name (or 'Unknown')
  year: string;          // Year of publication (or 'n.d.')
  source_title: string;  // Title of the source document
  confidence: NoteConfidence;
}

// ─── Phase 7 ─────────────────────────────────────────────────────────────────

export type ValidationIssueType = 'logical' | 'citation' | 'structure' | 'argument' | 'redundancy';

export interface ValidationIssue {
  section: string;
  type: ValidationIssueType;
  description: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  overallScore: number; // 1–10
  suggestions: string[];
  fixedReport?: string;  // Auto-improved version of the full report (Phase 7 auto-fixer)
  changeLog?: string[];  // What was rewritten / removed / added
}

// ─── Phase 8 (Traceability) ───────────────────────────────────────────────────

export interface TraceabilityEntry {
  claim: string;        // Statement from the report
  source: string;       // "Author, Year"
  source_title: string; // Full source title
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
