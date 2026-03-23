/**
 * AutoResearchAgent — Main Orchestrator
 *
 * Implements the full 9-phase academic research workflow:
 *   Phase 1+2 : Query Understanding & Research Planning
 *   Phase 3   : Source Retrieval & Credibility Ranking
 *   Phase 4   : Traceable Note Extraction (claim-source bound)
 *   Phase 5   : Comparative Synthesis
 *   Phase 6   : Section-specific Report Generation
 *   Phase 7   : Auto-Fix Peer Review (skipped in fast mode)
 *   Phase 8   : Traceability Map (deep/critical/data modes only)
 *   Phase 9   : Final Output
 *
 * Mode → depth mapping:
 *   fast     : 3-5 sources | no validation | no traceability
 *   standard : 6-10 sources | validation | no traceability
 *   critical : 6-10 sources | strict validation + auto-fix | traceability
 *   data     : 6-10 sources | validation | tables + traceability
 *   deep     : 10-20 sources | full validation + auto-fix | traceability
 */

import { AgentBuilder } from '@iqai/adk';
import { SearchService } from '../services/searchService.js';
import { ContentExtractionService } from '../services/contentExtractionService.js';
import { ReportGenerationService } from '../services/reportGenerationService.js';
import {
  ResearchTopic,
  ResearchMode,
  ResearchOutline,
  ResearchNote,
  ValidationResult,
  TraceabilityEntry,
  Citation,
  ExtractedContent,
  ResearchReport,
  SearchResult,
} from '../types/index.js';
import { Logger, formatDate } from '../utils/index.js';
import { config } from '../config/index.js';
import {
  createQueryGeneratorAgent,
  buildQueryGeneratorPrompt,
  createNoteExtractorAgent,
  createContentAnalyzerAgent,
  createReportGeneratorAgent,
  generateResearchOutline,
  validateReport,
  generateTraceability,
} from './specialized/index.js';

const logger = new Logger('AutoResearchAgent');

/** Real-time progress update callback */
export type ProgressCallback = (stage: string, details: string) => Promise<void> | void;

/** Resolved mode settings for the current run */
interface ModeConfig {
  maxSources: number;
  queryCount: number;
  skipValidation: boolean;
  includeDataTables: boolean;
  extraStrict: boolean;
  analysisTokens: number;
  reportTokens: number;
}

export class AutoResearchAgent {
  private searchService: SearchService;
  private extractionService: ContentExtractionService;
  private reportGenerator: ReportGenerationService;
  private progressCallback?: ProgressCallback;

  constructor(progressCallback?: ProgressCallback) {
    this.searchService = new SearchService();
    this.extractionService = new ContentExtractionService();
    this.reportGenerator = new ReportGenerationService();
    this.progressCallback = progressCallback;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async notifyProgress(stage: string, details: string): Promise<void> {
    if (this.progressCallback) await this.progressCallback(stage, details);
  }

  /** Simple promise-based delay */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wraps an async LLM call with automatic 429 rate-limit retry.
   * Parses the wait time from OpenAI/Gemini error messages and waits
   * the exact required duration before retrying (+ 1 s buffer).
   * Non-429 errors are re-thrown immediately.
   */
  private async withRateLimit<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit');
        if (!is429 || attempt === maxRetries) throw err;

        // Parse "Please try again in X.XXXs" from the error message
        const match = msg.match(/try again in (\d+(?:\.\d+)?)s/i);
        const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : (attempt + 1) * 15000;
        logger.warn(`Rate limit hit — waiting ${Math.round(waitMs / 1000)}s before retry (attempt ${attempt + 1}/${maxRetries})...`);
        await this.sleep(waitMs);
      }
    }
    // TypeScript requires a return; the loop above always returns or throws
    throw new Error('withRateLimit: exhausted retries');
  }

  private selectModel(): string {
    if (config.geminiApiKey) return 'gemini-1.5-flash';
    if (config.openaiApiKey) return 'gpt-4o';
    if (config.anthropicApiKey) return 'claude-3-5-sonnet-20241022';
    throw new Error('No AI provider configured');
  }

  private resolveModeConfig(topic: ResearchTopic): ModeConfig {
    const mode: ResearchMode = topic.mode ?? 'standard';
    const depth = topic.depth ?? 'intermediate';
    const baseMaxSources = depth === 'basic' ? 3 : depth === 'comprehensive' ? 12 : 6;
    const sourceMult: Record<ResearchMode, number> = { fast: 0.6, standard: 1, deep: 1.8, critical: 1, data: 1 };
    const maxSources = topic.maxSources ?? Math.round(baseMaxSources * sourceMult[mode]);
    const queryCount = Math.max(3, Math.min(10, mode === 'fast' ? 3 : mode === 'deep' ? 8 : 5));
    return {
      maxSources,
      queryCount,
      skipValidation: mode === 'fast',
      includeDataTables: mode === 'data',
      extraStrict: mode === 'critical',
      analysisTokens: mode === 'deep' ? 5000 : mode === 'fast' ? 2000 : 3500,
      reportTokens: mode === 'deep' ? 16000 : mode === 'fast' ? 8000 : 12000,
    };
  }

  // ─── Main entry point ─────────────────────────────────────────────────────

  async research(researchTopic: ResearchTopic): Promise<string[]> {
    const mode: ResearchMode = researchTopic.mode ?? 'standard';
    const modeConfig = this.resolveModeConfig(researchTopic);
    const model = this.selectModel();
    const hasTraceability = !modeConfig.skipValidation && (mode === 'deep' || mode === 'critical' || mode === 'data');
    const totalPhases = modeConfig.skipValidation ? 7 : hasTraceability ? 9 : 8;

    logger.info(`Starting research: "${researchTopic.topic}" [mode: ${mode}]`);
    await this.notifyProgress('🚀 Starting', `Initialising "${researchTopic.topic}" — mode: ${mode}`);

    try {
      // Phase 1+2
      await this.notifyProgress(`🧠 Phase 1–2/${totalPhases}`, 'Understanding query and planning research outline...');
      const outline: ResearchOutline = await generateResearchOutline(researchTopic.topic, mode, model);
      await this.notifyProgress(`✅ Phase 1–2/${totalPhases}`,
        `Type: ${outline.researchType} | ${outline.researchQuestions.length} questions | ${outline.sections.length} sections planned`);

      // Phase 3
      await this.notifyProgress(`🔍 Phase 3/${totalPhases}`, 'Generating queries and retrieving credible sources...');
      const queries = await this.generateSearchQueries(researchTopic, outline, modeConfig, model);
      const rawResults = await this.executeSearches(queries, modeConfig.maxSources);
      const rankedSources = this.rankSourcesByCredibility(rawResults);
      await this.notifyProgress(`✅ Phase 3/${totalPhases}`,
        `Retrieved ${rankedSources.length} sources — top credibility: ${rankedSources[0]?.credibilityScore ?? 'N/A'}/10`);

      // Phase 4
      await this.notifyProgress(`📥 Phase 4/${totalPhases}`, `Extracting content from ${rankedSources.length} sources...`);
      const extractedContent = await this.extractContent(rankedSources.map(r => r.url));
      const notes = await this.extractNotes(extractedContent, outline, model);
      await this.notifyProgress(`✅ Phase 4/${totalPhases}`,
        `${notes.length} notes from ${extractedContent.length} sources`);

      // Phase 5
      await this.notifyProgress(`🤖 Phase 5/${totalPhases}`, 'Synthesising findings...');
      const analysis = await this.synthesiseContent(researchTopic.topic, extractedContent, notes, outline, modeConfig, model);
      await this.notifyProgress(`✅ Phase 5/${totalPhases}`, 'Synthesis complete');

      // Phase 6
      await this.notifyProgress(`📝 Phase 6/${totalPhases}`, 'Generating academic report with APA citations...');
      const report = await this.generateReport(
        researchTopic.topic, analysis, extractedContent, outline,
        modeConfig, researchTopic.includeVisualization ?? false, model, notes
      );
      await this.notifyProgress(`✅ Phase 6/${totalPhases}`, 'Report generated');

      // Phase 7 (skipped in fast mode) — Auto-Fix Peer Review
      if (!modeConfig.skipValidation) {
        await this.notifyProgress(`🔎 Phase 7/${totalPhases}`, 'Running auto-fix peer review...');
        const reportText = this.reportToPlainText(report);
        const validation: ValidationResult = await validateReport(reportText, mode, model, notes);
        await this.notifyProgress(`✅ Phase 7/${totalPhases}`,
          `Score: ${validation.overallScore}/10 | ${validation.issues.length} issue(s) | ${validation.changeLog?.length ?? 0} fix(es) applied`);

        // REPLACE report sections with the auto-fixed version — no duplicate sections ever appear
        if (validation.fixedReport && validation.fixedReport.length > 200) {
          const replacedSections = this.parseSectionsFromText(validation.fixedReport, report.sections);
          if (replacedSections.length > 0) {
            report.sections = replacedSections;
            const abs = report.sections.find(s => s.title.toLowerCase().includes('abstract'));
            if (abs) report.summary = abs.content;
          }
        }
        // changeLog is logged only, not added as a visible report section
        if (validation.changeLog && validation.changeLog.length > 0) {
          logger.info('Auto-fix changelog:\n' + validation.changeLog.join('\n'));
        }
      }

      // Phase 8 — Traceability (deep / critical / data modes)
      if (hasTraceability) {
        await this.notifyProgress(`🔗 Phase 8/${totalPhases}`, 'Building source traceability map...');
        const traceEntries: TraceabilityEntry[] = await generateTraceability(
          this.reportToPlainText(report), notes, mode, model
        );
        if (traceEntries.length > 0) {
          // Append as an appendix AFTER the References section
          report.sections.push({
            title: 'Appendix A: Source Traceability',
            content: this.formatTraceabilityReport(traceEntries),
            citations: [],
          });
          await this.notifyProgress(`✅ Phase 8/${totalPhases}`, `${traceEntries.length} claims traced to sources`);
        }
      }

      // Final phase
      const outputPhase = hasTraceability ? 9 : modeConfig.skipValidation ? 7 : 8;
      await this.notifyProgress(`💾 Phase ${outputPhase}/${totalPhases}`, 'Writing final output files...');
      const outputPaths = await this.reportGenerator.generateReport(report);
      await this.notifyProgress('✅ Complete!', `${outputPaths.length} file(s) generated`);
      logger.success(`Research complete — ${outputPaths.length} file(s)`);
      return outputPaths;

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Research failed: ${msg}`);
      throw error;
    }
  }

  // ─── Phase 3 helpers ─────────────────────────────────────────────────────

  private async generateSearchQueries(
    researchTopic: ResearchTopic,
    outline: ResearchOutline,
    modeConfig: ModeConfig,
    model: string
  ): Promise<string[]> {
    try {
      const queryAgent = createQueryGeneratorAgent(model);
      const { runner } = await AgentBuilder.create('queryGenerator').withAgent(queryAgent).build();
      const prompt = buildQueryGeneratorPrompt(
        researchTopic.topic, modeConfig.queryCount,
        researchTopic.depth ?? 'intermediate', outline.researchQuestions
      );
      const timeout = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000));
      const response = await this.withRateLimit(() => Promise.race([runner.ask(prompt), timeout]));
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const queries = JSON.parse(cleaned) as string[];
      if (Array.isArray(queries) && queries.length > 0) return queries.slice(0, modeConfig.queryCount);
    } catch (error) {
      logger.warn('Query generation failed, using fallback', error);
    }
    return this.searchService.generateSearchQueries(researchTopic.topic, researchTopic.depth ?? 'intermediate');
  }

  private async executeSearches(queries: string[], maxSources: number): Promise<SearchResult[]> {
    const perQuery = Math.ceil((maxSources * 1.3) / queries.length);
    const settled = await Promise.allSettled(queries.map(q => this.searchService.search(q, perQuery)));
    const all: SearchResult[] = [];
    settled.forEach(r => { if (r.status === 'fulfilled' && r.value.success && r.value.data) all.push(...r.value.data); });
    return this.removeDuplicates(all, maxSources);
  }

  private rankSourcesByCredibility(results: SearchResult[]): SearchResult[] {
    return results
      .map(r => ({ ...r, credibilityScore: this.computeCredibilityScore(r) }))
      .sort((a, b) => (b.credibilityScore ?? 0) - (a.credibilityScore ?? 0));
  }

  private computeCredibilityScore(result: SearchResult): number {
    let score = 5;
    const url = result.url.toLowerCase();
    const snippet = (result.snippet ?? '').toLowerCase();
    if (url.includes('arxiv.org') || url.includes('semanticscholar.org')) score += 4;
    else if (url.includes('doi.org') || url.includes('pubmed') || url.includes('crossref.org')) score += 4;
    else if (url.includes('.edu')) score += 3;
    else if (url.includes('.gov')) score += 2;
    else if (url.includes('springer') || url.includes('elsevier') || url.includes('wiley')) score += 3;
    else if (url.includes('wikipedia.org')) score += 1;
    if (snippet.includes('peer-reviewed') || snippet.includes('journal')) score += 1;
    if (result.author) score += 1;
    if (result.publishDate) score += 0.5;
    return Math.min(10, Math.round(score));
  }

  // ─── Phase 4: Note Extraction ─────────────────────────────────────────────

  private async extractContent(urls: string[]): Promise<ExtractedContent[]> {
    const all = await this.extractionService.extractMultiple(urls, 10);
    return all.filter(c => c.metadata.wordCount >= 50);
  }

  private async extractNotes(content: ExtractedContent[], outline: ResearchOutline, model: string): Promise<ResearchNote[]> {
    try {
      const agent = createNoteExtractorAgent(model);
      const { runner } = await AgentBuilder.create('noteExtractor').withAgent(agent).build();
      const batchSize = 5;
      const allNotes: ResearchNote[] = [];
      const subtopics = outline.sections.map(s => s.title).join(', ');

      for (let i = 0; i < content.length; i += batchSize) {
        const batch = content.slice(i, i + batchSize);
        let sourcesText = '';
        batch.forEach((c, idx) => {
          const author = c.metadata.author ?? 'Unknown';
          const year = c.metadata.publishDate ? c.metadata.publishDate.substring(0, 4) : 'n.d.';
          sourcesText += [
            `--- SOURCE ${i + idx + 1} ---`,
            `AUTHOR: ${author}`,
            `YEAR: ${year}`,
            `TITLE: ${c.title}`,
            `URL: ${c.url}`,
            `CONTENT:`,
            c.content.substring(0, 1500),
            '',
          ].join('\n');
        });
        const prompt = `Extract research notes. Subtopics to focus on: ${subtopics}\n\n${sourcesText}\n\nReturn ONLY a JSON array.`;
        // Add a small delay between batches to avoid hitting TPM limits
        if (i > 0) await this.sleep(3000);
        try {
          const response = await this.withRateLimit(() => {
            const t = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 35000));
            return Promise.race([runner.ask(prompt), t]);
          });
          const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const batchNotes = JSON.parse(cleaned) as ResearchNote[];
          if (Array.isArray(batchNotes)) allNotes.push(...batchNotes);
        } catch (batchErr) {
          logger.warn(`Note extraction batch ${Math.floor(i / batchSize) + 1} failed`, batchErr);
        }
      }
      logger.success(`Extracted ${allNotes.length} notes`);
      return allNotes;
    } catch (error) {
      logger.warn('Note extraction failed entirely', error);
      return [];
    }
  }

  // ─── Phase 5: Synthesis ───────────────────────────────────────────────────

  private async synthesiseContent(
    topic: string, content: ExtractedContent[], notes: ResearchNote[],
    outline: ResearchOutline, _modeConfig: ModeConfig, model: string
  ): Promise<string> {
    try {
      const agent = createContentAnalyzerAgent(model);
      const { runner } = await AgentBuilder.create('contentAnalyzer').withAgent(agent).build();

      let notesText = '';
      if (notes.length > 0) {
        notesText = '\n## TRACEABLE RESEARCH NOTES (use Author, Year in-text citations)\n';
        notes.slice(0, 60).forEach((n, i) => {
          notesText += `[${i + 1}] (${n.author}, ${n.year}) "${n.claim}" — ${n.source_title} [${n.confidence}]\n`;
        });
      }
      let rawContent = '';
      content.slice(0, 8).forEach((c, i) => {
        rawContent += `Source ${i + 1}: ${c.title}\n${c.content.substring(0, 1500)}\n\n`;
      });
      const questions = outline.researchQuestions.map((rq, i) => `${i + 1}. [${rq.subtopic}] ${rq.question}`).join('\n');

      const prompt = `Synthesise research on: "${topic}"\n\n## RESEARCH QUESTIONS\n${questions}\n${notesText}\n## RAW CONTENT\n${rawContent}\n\nProduce a comprehensive thematic analysis.`;
      const analysis = await this.withRateLimit(() => {
        const t = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000));
        return Promise.race([runner.ask(prompt), t]);
      });
      if (analysis && analysis.length > 100) return analysis;
    } catch (error) {
      logger.warn('Synthesis failed, using fallback', error);
    }
    return `Analysis of ${content.length} sources on "${topic}". Sources: ${content.slice(0, 3).map(c => c.title).join('; ')}.`;
  }

  // ─── Phase 6: Report Generation ───────────────────────────────────────────

  private async generateReport(
    topic: string, analysis: string, extractedContent: ExtractedContent[],
    outline: ResearchOutline, modeConfig: ModeConfig,
    _includeVisualization: boolean, model: string,
    notes: ResearchNote[] = []
  ): Promise<ResearchReport> {
    const citations: Citation[] = extractedContent.map((c, idx) => ({
      id: `cit-${idx + 1}`, title: c.title, url: c.url,
      author: c.metadata.author, publishDate: c.metadata.publishDate, accessDate: formatDate(),
    }));
    try {
      let citationsText = '';
      citations.forEach((cit, idx) => {
        citationsText += `[${idx + 1}] ${cit.author ?? 'Unknown'}. "${cit.title}." ${cit.publishDate ?? 'n.d.'}. ${cit.url}\n`;
      });

      // Build traceable notes reference for in-text citation use
      let notesFragment = '';
      if (notes.length > 0) {
        notesFragment = '\nTRACEABLE NOTES (use these for (Author, Year) in-text citations):\n';
        notes.slice(0, 50).forEach((n, i) => {
          notesFragment += `[N${i + 1}] (${n.author}, ${n.year}): "${n.claim}" — ${n.source_title}\n`;
        });
      }

      // Transparent methodology context (actual process stats)
      const depthLabel = modeConfig.maxSources <= 5 ? 'shallow'
        : modeConfig.maxSources <= 10 ? 'medium' : 'deep';
      const methodologyContext = [
        `METHODOLOGY CONTEXT (for the methodology section — describe this accurately):`,
        `- ${extractedContent.length} sources were retrieved and analysed`,
        `- Sources were filtered based on relevance and credibility (domain authority, recency, author presence)`,
        `- A credibility scoring system (1–10) was applied: academic domains scored higher`,
        `- Key claims were extracted per source using AI-assisted note extraction with author-year binding`,
        `- Notes were categorised thematically using AI synthesis`,
        `- Research depth level: ${depthLabel} (${modeConfig.maxSources} max sources)`,
        `- DO NOT mention databases, tools, or methods not listed above`,
      ].join('\n');

      const sectionList = outline.sections.map(s => `  - ${s.title}: ${s.intent}`).join('\n');
      const dataNote = modeConfig.includeDataTables
        ? '\nDATA MODE: Include markdown tables wherever relevant in findings and discussion.' : '';

      const prompt = [
        `Generate a FULL, COMPREHENSIVE academic research report on: "${topic}"`,
        ``,
        `==== ACADEMIC EXPANSION MODE (MANDATORY) ====`,
        `This report must read like a final-year university academic project.`,
        `EVERY major concept must be explained using WHAT / HOW / WHY.`,
        `EVERY paragraph must: start with a topic sentence, expand logically, end with a linking sentence.`,
        `Use transitions between paragraphs: "Furthermore," | "In contrast," | "Consequently," | "Building on this,"`,
        ``,
        `==== ACADEMIC ASSERTIVENESS (MANDATORY) ====`,
        `Replace weak phrases: "This suggests" → "This demonstrates" | "may indicate" → "indicates"`,
        `"It is possible that" → "It is evident that" | "seems to" → "demonstrates"`,
        `Write with confidence where evidence supports the claim.`,
        ``,
        `==== STRICT FINDINGS vs DISCUSSION SEPARATION ====`,
        `FINDINGS: observations only (patterns + citations) — NO interpretation, NO implications, NO "why"`,
        `DISCUSSION: interpret every finding — WHY it happens, real-world meaning, long-term consequences,`,
        `  cause-effect chains, healthcare/policy/societal relevance. Answer: "So what in the real world?"`,
        ``,
        `==== TABLE REQUIREMENTS (MANDATORY) ====`,
        `Include AT LEAST 1 markdown table in Findings (e.g., patterns | sources | impact level).`,
        `Optionally include a comparison table in Literature Review (Author | Year | Focus | Key Finding).`,
        `Reference every table in prose: "As illustrated in Table 1..."`,
        ``,
        `==== FIGURE REQUIREMENTS (MANDATORY) ====`,
        `Include AT LEAST 1 figure placeholder in the report using this format:`,
        `**Figure X: Title**`,
        `[IMAGE: precise description of what the diagram/chart should show]`,
        `*Caption: one-sentence explanation.*`,
        `Reference the figure in prose before it appears: "As depicted in Figure 1..."`,
        ``,
        `==== MINIMUM SECTION LENGTHS (STRICTLY ENFORCED) ====`,
        `Abstract → 150-250 words | Introduction → 500-800 words | Literature Review → 800-1500 words`,
        `Methodology → 400-700 words | Findings → 600-1000 words | Discussion → 800-1200 words`,
        `Conclusion → 300-500 words | Recommendations → 300-500 words`,
        ``,
        `==== PAGE BREAK FORMAT (MANDATORY) ====`,
        `Every section string in the JSON MUST start with ---PAGE BREAK--- on its own line.`,
        ``,
        `OUTLINE:`,
        sectionList,
        dataNote,
        ``,
        methodologyContext,
        ``,
        `ANALYSIS:`,
        analysis,
        ``,
        `CITATIONS (APA format):`,
        citationsText,
        notesFragment,
        ``,
        `Return ONLY valid JSON (no markdown fences). All section values MUST start with ---PAGE BREAK---:`,
        `{`,
        `  "title": "string",`,
        `  "abstract": "string  <- ---PAGE BREAK--- then 150-250 words",`,
        `  "introduction": "string  <- ---PAGE BREAK--- then 500-800 words | include 1 Figure",`,
        `  "literature_review": "string  <- ---PAGE BREAK--- then 800-1500 words | optional Table",`,
        `  "methodology": "string  <- ---PAGE BREAK--- then 400-700 words",`,
        `  "findings": "string  <- ---PAGE BREAK--- then 600-1000 words | MUST have Table 1 + Figure",`,
        `  "discussion": "string  <- ---PAGE BREAK--- then 800-1200 words | deep causal analysis",`,
        `  "conclusion": "string  <- ---PAGE BREAK--- then 300-500 words",`,
        `  "recommendations": "string  <- ---PAGE BREAK--- then 300-500 words"`,
        `}`,
      ].join('\n');

      const agent = createReportGeneratorAgent(model);
      const { runner } = await AgentBuilder.create('reportGenerator').withAgent(agent).build();
      const response = await this.withRateLimit(() => {
        const t = new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 180000));
        return Promise.race([runner.ask(prompt), t]);
      });
      const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const reportData = JSON.parse(cleaned) as Record<string, string>;
      logger.success('Report generated');
      return this.buildReportFromStructure(reportData, topic, citations);
    } catch (error) {
      logger.warn('Report generation failed, using fallback', error);
      return this.generateFallbackReport(topic, analysis, extractedContent);
    }
  }

  // ─── Phase 7 helpers ─────────────────────────────────────────────────────

  private reportToPlainText(report: ResearchReport): string {
    let text = `${report.topic}\n\n${report.summary}\n\n`;
    report.sections.forEach(s => { text += `## ${s.title}\n${s.content}\n\n`; });
    return text;
  }

  private formatValidationResult(v: ValidationResult): string {
    let out = `Overall Quality Score: ${v.overallScore}/10\n\n`;
    if (v.issues.length > 0) {
      out += 'Issues Found:\n';
      v.issues.forEach((issue, i) => { out += `${i + 1}. [${issue.section}] (${issue.type}): ${issue.description}\n`; });
      out += '\n';
    }
    if (v.changeLog && v.changeLog.length > 0) {
      out += 'Auto-Fixes Applied:\n';
      v.changeLog.forEach((c, i) => { out += `${i + 1}. ${c}\n`; });
      out += '\n';
    }
    if (v.suggestions.length > 0) {
      out += 'Remaining Suggestions:\n';
      v.suggestions.forEach((s, i) => { out += `${i + 1}. ${s}\n`; });
    }
    return out;
  }

  private formatTraceabilityReport(entries: TraceabilityEntry[]): string {
    let out = `This table maps key claims in the report to their original sources.\n\n`;
    out += `| # | Claim | Source | Title |\n`;
    out += `|---|-------|--------|-------|\n`;
    entries.forEach((e, i) => {
      const claim = e.claim.length > 80 ? e.claim.substring(0, 77) + '...' : e.claim;
      out += `| ${i + 1} | ${claim} | ${e.source} | ${e.source_title} |\n`;
    });
    return out;
  }

  // ─── Fallback helpers ─────────────────────────────────────────────────────

  private buildReportFromStructure(data: Record<string, string>, topic: string, rawCitations: Citation[]): ResearchReport {
    // Clean citations: exclude any with missing/invalid metadata
    const citations = this.cleanCitations(rawCitations);
    const sections = [
      { title: 'Abstract', content: data.abstract ?? '', citations: [] as string[] },
      { title: 'Introduction', content: data.introduction ?? '', citations: this.extractCitations(data.introduction ?? '') },
      { title: 'Literature Review', content: data.literature_review ?? '', citations: this.extractCitations(data.literature_review ?? '') },
      { title: 'Methodology', content: data.methodology ?? '', citations: this.extractCitations(data.methodology ?? '') },
      { title: 'Findings and Results', content: data.findings ?? '', citations: this.extractCitations(data.findings ?? '') },
      { title: 'Discussion and Analysis', content: data.discussion ?? '', citations: this.extractCitations(data.discussion ?? '') },
      { title: 'Conclusion', content: data.conclusion ?? '', citations: this.extractCitations(data.conclusion ?? '') },
      { title: 'Recommendations', content: data.recommendations ?? '', citations: this.extractCitations(data.recommendations ?? '') },
      {
        title: 'References',
        // Prefer references produced by ReportGeneratorAgent (already formatted);
        // fall back to the local APA builder when that key is absent.
        content: data.references?.trim()
          ? data.references
          : this.buildReferencesSection(citations),
        citations: [] as string[],
      },
    ].filter(s => s.content.trim().length > 0);
    return { topic, generatedAt: new Date().toISOString(), summary: data.abstract ?? '', sections, citations };
  }

  /** Remove citations with invalid/incomplete metadata (NaN, Untitled, missing year, etc.) */
  private cleanCitations(citations: Citation[]): Citation[] {
    return citations.filter(c => {
      const title = (c.title ?? '').trim();
      const hasTitle = title.length > 0 && title.toLowerCase() !== 'untitled' && !title.includes('NaN');
      const hasUrl = (c.url ?? '').trim().length > 0;
      return hasTitle && hasUrl;
    });
  }

  /** Build a formatted References section from cleaned citations */
  private buildReferencesSection(citations: Citation[]): string {
    if (citations.length === 0) return '';
    let out = '';
    citations.forEach((c, i) => {
      const author = (c.author && c.author.trim() && c.author !== 'Unknown') ? c.author : this.domainAsOrg(c.url);
      const year = c.publishDate ? c.publishDate.substring(0, 4) : 'n.d.';
      const yearClean = /^\d{4}$/.test(year) ? year : 'n.d.';
      out += `${i + 1}. ${author} (${yearClean}). *${c.title}*. Retrieved from ${c.url}\n`;
    });
    return out;
  }

  /** Return an organization-style name from a URL when no author is available */
  private domainAsOrg(url: string): string {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      // Capitalize each segment
      return host.split('.').slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Parse the auto-fixer's free-text fixed report back into ResearchSection objects.
   * If parsing fails, falls back to the original sections.
   */
  private parseSectionsFromText(
    fixedText: string,
    fallbackSections: ResearchReport['sections']
  ): ResearchReport['sections'] {
    const knownTitles = [
      'Abstract', 'Introduction', 'Literature Review', 'Methodology',
      'Findings', 'Findings and Results', 'Discussion', 'Discussion and Analysis',
      'Conclusion', 'Recommendations', 'References',
    ];
    const headerRe = new RegExp(
      `^#{1,3}\\s*(${knownTitles.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'im'
    );
    if (!headerRe.test(fixedText)) {
      // Can't parse structure — return unchanged
      return fallbackSections;
    }
    const lines = fixedText.split('\n');
    const sections: ResearchReport['sections'] = [];
    let current: { title: string; content: string; citations: string[] } | null = null;
    for (const line of lines) {
      const hm = line.match(/^#{1,3}\s+(.+)/);
      if (hm) {
        if (current) sections.push(current);
        current = { title: hm[1].trim(), content: '', citations: [] };
      } else if (current) {
        current.content += line + '\n';
        current.citations = [...new Set([...current.citations, ...this.extractCitations(line)])];
      }
    }
    if (current) sections.push(current);
    return sections.length > 0 ? sections : fallbackSections;
  }

  private async generateFallbackReport(topic: string, analysis: string, extractedContent: ExtractedContent[]): Promise<ResearchReport> {
    const rawCitations: Citation[] = extractedContent.map((c, idx) => ({
      id: `cit-${idx + 1}`, title: c.title, url: c.url,
      author: c.metadata.author, publishDate: c.metadata.publishDate, accessDate: formatDate(),
    }));
    const citations = this.cleanCitations(rawCitations);
    let p = `Generate a comprehensive academic research report on: "${topic}"\n\nAnalysis:\n${analysis}\n\nCitations:\n`;
    citations.forEach((c, i) => {
      const author = (c.author && c.author !== 'Unknown') ? c.author : this.domainAsOrg(c.url);
      const year = c.publishDate ? c.publishDate.substring(0, 4) : 'n.d.';
      p += `[${i + 1}] ${author} (${year}). "${c.title}." ${c.url}.\n`;
    });
    p += '\n\nStructure: Abstract, Introduction, Literature Review, Methodology, Findings, Discussion, Conclusion, Recommendations, References.';
    const model = this.selectModel();
    const response = await AgentBuilder.create('reportGenerator').withModel(model)
      .withInstruction('Expert academic writer creating research reports.').ask(p);
    return this.parseReportResponse(response, topic, citations);
  }

  private parseReportResponse(response: string, topic: string, citations: Citation[]): ResearchReport {
    const lines = response.split('\n');
    const sections: { title: string; content: string; citations: string[] }[] = [];
    let current: { title: string; content: string; citations: string[] } | null = null;
    let abstract = '';
    let inAbstract = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.toLowerCase().includes('abstract') || t.toLowerCase().includes('executive summary')) { inAbstract = true; continue; }
      const m = t.match(/^#{2}\s*\d*\.?\s*(.+)/) || t.match(/^\d+\.\s+([A-Z\s]+)$/);
      if (m) {
        if (current) sections.push(current);
        current = { title: m[1].trim(), content: '', citations: [] };
        inAbstract = false; continue;
      }
      if (t) {
        if (inAbstract && sections.length === 0) abstract += line + '\n';
        else if (current) {
          current.content += line + '\n';
          current.citations = [...new Set([...current.citations, ...this.extractCitations(line)])];
        }
      }
    }
    if (current) sections.push(current);
    return {
      topic, generatedAt: new Date().toISOString(), summary: abstract.trim() || response.substring(0, 500),
      sections: sections.length > 0 ? sections : [{ title: 'Overview', content: response, citations: this.extractCitations(response) }],
      citations,
    };
  }

  private extractCitations(text: string): string[] {
    return (text.match(/\[(\d+)\]/g) ?? []).map(m => `cit-${parseInt(m.replace(/[\[\]]/g, ''))}`);
  }

  private removeDuplicates(results: SearchResult[], maxCount: number): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(r => { if (seen.has(r.url)) return false; seen.add(r.url); return true; }).slice(0, maxCount);
  }
}
