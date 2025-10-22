/**
 * AutoResearch Agent - Main agent orchestrator using ADK-TS Framework
 * 
 * 
 * This multi-agent system autonomously conducts research by:
 * 1. Generating diverse search queries (QueryGeneratorAgent)
 * 2. Searching and extracting web content in parallel
 * 3. Analyzing content with AI synthesis (ContentAnalyzerAgent)
 * 4. Generating structured academic reports (ReportGeneratorAgent)
 * 5. Delivering results in multiple formats (Markdown, PDF, Google Docs)
 * 
 * Architecture: Sequential workflow coordinating specialized LLM agents
 * - Uses AgentBuilder for agent creation
 * - All context passed through prompts (no session state needed)
 * - Implements proper ADK-TS agent hierarchy
 */

import { AgentBuilder } from '@iqai/adk';
import { SearchService } from '../services/searchService.js';
import { ContentExtractionService } from '../services/contentExtractionService.js';
import { ReportGenerationService } from '../services/reportGenerationService.js';
import { ResearchTopic, Citation, ExtractedContent, ResearchReport } from '../types/index.js';
import { Logger, formatDate } from '../utils/index.js';
import { config } from '../config/index.js';
import { 
  createQueryGeneratorAgent,
  createContentAnalyzerAgent,
  createReportGeneratorAgent 
} from './specialized/index.js';

const logger = new Logger('AutoResearchAgent');

/**
 * Progress callback type for real-time updates
 */
export type ProgressCallback = (stage: string, details: string) => Promise<void> | void;

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

  /**
   * Send progress update if callback is set
   */
  private async notifyProgress(stage: string, details: string): Promise<void> {
    if (this.progressCallback) {
      await this.progressCallback(stage, details);
    }
  }

  /**
   * Execute the research workflow using ADK-TS agent
   */
  async research(researchTopic: ResearchTopic): Promise<string[]> {
    try {
      logger.info(`Starting research on: "${researchTopic.topic}"`);
      await this.notifyProgress('🚀 Starting', `Initializing research on "${researchTopic.topic}"`);

      // Step 1: Generate search queries using AI
      await this.notifyProgress('🧠 Step 1/6', 'Generating intelligent search queries with AI...');
      const queries = await this.generateSearchQueries(researchTopic);
      await this.notifyProgress('✅ Step 1/6', `Generated ${queries.length} search queries`);

      // Step 2: Execute searches
      await this.notifyProgress('🔍 Step 2/6', `Searching ${queries.length} queries across multiple sources...`);
      const searchResults = await this.executeSearches(queries, researchTopic.maxSources || config.maxSearchResults);
      await this.notifyProgress('✅ Step 2/6', `Found ${searchResults.length} relevant sources`);

      // Step 3: Extract content
      await this.notifyProgress('📥 Step 3/6', `Extracting content from ${searchResults.length} sources...`);
      const extractedContent = await this.extractContent(searchResults.map(r => r.url));
      await this.notifyProgress('✅ Step 3/6', `Extracted content from ${extractedContent.length} sources`);

      // Step 4: Analyze content with ADK-TS agent
      await this.notifyProgress('🤖 Step 4/6', 'Analyzing content with AI (this may take a moment)...');
      const analysis = await this.analyzeContent(researchTopic.topic, extractedContent);
      await this.notifyProgress('✅ Step 4/6', 'Content analysis complete');

      // Step 5: Generate report with ADK-TS agent
      await this.notifyProgress('📝 Step 5/6', 'Generating comprehensive research report...');
      const report = await this.generateReport(
        researchTopic.topic,
        analysis,
        extractedContent,
        researchTopic.includeVisualization || false
      );
      await this.notifyProgress('✅ Step 5/6', 'Report generated successfully');

      // Step 6: Export report
      await this.notifyProgress('💾 Step 6/6', 'Creating PDF and Markdown files...');
      const outputPaths = await this.reportGenerator.generateReport(report);
      await this.notifyProgress('✅ Complete!', `Generated ${outputPaths.length} report files`);

      logger.success(`Research complete! Generated ${outputPaths.length} report(s)`);
      return outputPaths;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Research failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Generate search queries using specialized ADK-TS QueryGeneratorAgent
   * All context is passed through prompts for simplicity
   */
  private async generateSearchQueries(researchTopic: ResearchTopic): Promise<string[]> {
    logger.info('Generating search queries with ADK-TS QueryGeneratorAgent...');

    try {
      // Reduced query count for faster results
      const queryCount = researchTopic.depth === 'comprehensive' ? 7 : researchTopic.depth === 'basic' ? 3 : 5;
      const model = this.selectModel();

      // Build a prompt with all necessary context
      const prompt = `Generate ${queryCount} diverse search queries for academic research.

Topic: "${researchTopic.topic}"
Research Depth: ${researchTopic.depth || 'intermediate'}

Return ONLY a JSON array of ${queryCount} unique search query strings.
No explanations or additional text.`;

      // Use the specialized query generator agent with proper ADK-TS patterns
      const queryAgent = createQueryGeneratorAgent(model);
      
      // Build using AgentBuilder - simplified without session state
      // (Session state not needed since we pass all context in the prompt)
      const { runner } = await AgentBuilder
        .create('queryGenerator')
        .withAgent(queryAgent)
        .build();

      // Run the agent with the prompt - with timeout
      const responsePromise = runner.ask(prompt);
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Query generation timeout')), 15000); // 15 second timeout
      });
      
      const response = await Promise.race([responsePromise, timeoutPromise]);
      
      // Parse the JSON response
      const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const queries = JSON.parse(cleanedResponse);
      
      if (Array.isArray(queries) && queries.length > 0) {
        logger.success(`Generated ${queries.length} queries using ADK-TS multi-agent pattern`);
        return queries.slice(0, queryCount);
      }
    } catch (error) {
      logger.warn('ADK-TS query generation failed, using fallback', error);
    }

    // Fallback to search service
    return this.searchService.generateSearchQueries(
      researchTopic.topic,
      researchTopic.depth || 'intermediate'
    );
  }

  /**
   * Execute searches across multiple sources
   */
  private async executeSearches(queries: string[], maxSources: number): Promise<any[]> {
    logger.info(`Executing ${queries.length} searches...`);

    const allResults: any[] = [];
    const resultsPerQuery = Math.ceil((maxSources * 1.2) / queries.length); // Reduced multiplier from 1.5 to 1.2

    // Execute searches in parallel for speed
    const searchPromises = queries.map(query => 
      this.searchService.search(query, resultsPerQuery)
    );

    const searchResults = await Promise.allSettled(searchPromises);
    
    searchResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success && result.value.data) {
        allResults.push(...result.value.data);
      }
    });

    const unique = this.removeDuplicates(allResults, maxSources);
    logger.success(`Found ${unique.length} unique sources`);
    return unique;
  }

  /**
   * Extract content from URLs
   */
  private async extractContent(urls: string[]): Promise<ExtractedContent[]> {
    logger.info(`Extracting content from ${urls.length} URLs...`);

    // Use higher concurrency for faster extraction
    const content = await this.extractionService.extractMultiple(
      urls,
      10 // Increased from config.maxConcurrentRequests (8) for speed
    );

    const filtered = content.filter(c => c.metadata.wordCount >= 50);
    logger.success(`Extracted ${filtered.length} content items`);
    return filtered;
  }

  /**
   * Analyze content using specialized ADK-TS ContentAnalyzerAgent
   * Implements proper session state management for agent communication
   */
  private async analyzeContent(topic: string, content: ExtractedContent[]): Promise<string> {
    logger.info('Analyzing content with ADK-TS ContentAnalyzerAgent...');

    try {
      const model = this.selectModel();
      
      // Format content for analysis
      let formattedContent = '';
      content.slice(0, 10).forEach((c, idx) => {
        formattedContent += `Source ${idx + 1}: ${c.title}\n${c.content.substring(0, 2000)}\n\n`;
      });

      // Build comprehensive prompt with all context
      const prompt = `Analyze the following research content on "${topic}":

${formattedContent}

Provide a comprehensive analysis.`;

      // Use the specialized content analyzer agent
      const analyzerAgent = createContentAnalyzerAgent(model);
      
      // Build agent - simplified without session state
      // (All context is in the prompt)
      const { runner } = await AgentBuilder
        .create('contentAnalyzer')
        .withAgent(analyzerAgent)
        .build();

      // Run the agent with the prompt - with timeout
      const analysisPromise = runner.ask(prompt);
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Analysis timeout')), 30000); // 30 second timeout
      });
      
      const analysis = await Promise.race([analysisPromise, timeoutPromise]);
      
      if (analysis && typeof analysis === 'string' && analysis.length > 100) {
        logger.success('Content analysis complete using ADK-TS multi-agent architecture');
        return analysis;
      }
    } catch (error) {
      logger.warn('ADK-TS content analysis failed, using fallback', error);
    }

    // Fallback: return basic summary
    return `Analysis of ${content.length} sources on "${topic}". Key findings from top sources: ${
      content.slice(0, 3).map(c => c.title).join(', ')
    }.`;
  }

  private removeDuplicates(results: any[], maxCount: number): any[] {
    const seen = new Set();
    const unique = results.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
    return unique.slice(0, maxCount);
  }

  /**
   * Select the AI model based on configured providers
   */
  private selectModel(): string {
    if (config.geminiApiKey) {
      return 'gemini-1.5-flash';
    } else if (config.openaiApiKey) {
      return 'gpt-4o';
    } else if (config.anthropicApiKey) {
      return 'claude-3-5-sonnet-20241022';
    }
    throw new Error('No AI provider configured');
  }



  /**
   * Generate final research report using specialized ADK-TS ReportGeneratorAgent
   * Implements session state management and proper agent composition
   */
  private async generateReport(
    topic: string,
    analysis: string,
    extractedContent: ExtractedContent[],
    _includeVisualization: boolean
  ): Promise<ResearchReport> {
    logger.info('Generating structured report with ADK-TS ReportGeneratorAgent...');

    try {
      // Prepare citations
      const citations: Citation[] = extractedContent.map((content, idx) => ({
        id: `cit-${idx + 1}`,
        title: content.title,
        url: content.url,
        author: content.metadata.author,
        publishDate: content.metadata.publishDate,
        accessDate: formatDate(),
      }));

      const model = this.selectModel();
      
      // Build detailed prompt with all context
      let citationsText = '';
      citations.forEach((cit, idx) => {
        citationsText += `[${idx + 1}] ${cit.author || 'Unknown'}. "${cit.title}". ${cit.url}\n`;
      });

      const prompt = `Generate a comprehensive academic research report on: "${topic}"

CONTENT ANALYSIS:
${analysis}

AVAILABLE CITATIONS:
${citationsText}

Return ONLY a JSON object with this EXACT structure (no markdown code blocks, no extra text):
{
  "title": "Clear academic title for the research",
  "abstract": "150-250 word comprehensive summary of the research, key findings, and significance",
  "introduction": "3-4 paragraphs covering background, context, research significance, objectives, and scope. Include relevant citations.",
  "literature_review": "4-5 paragraphs synthesizing existing research, highlighting key studies, theoretical frameworks, and gaps in knowledge. Include citations [1], [2], etc.",
  "methodology": "2-3 paragraphs explaining the research approach, data collection methods, sources used, and analytical framework.",
  "findings": "5-7 paragraphs organized by themes, presenting key discoveries, data, statistics, and evidence from the sources. Include citations throughout.",
  "discussion": "4-5 paragraphs interpreting findings, comparing with existing research, addressing implications, limitations, and contradictions. Include citations.",
  "conclusion": "2-3 paragraphs summarizing key findings, their significance, and future research directions.",
  "recommendations": "2-3 paragraphs with specific, actionable recommendations for policy-makers, practitioners, or future research."
}

CRITICAL: Use formal academic language, cite sources using [number] format, be comprehensive and detailed in each section. Each section should have substantial content.`;

      // Use the specialized report generator agent
      const reportAgent = createReportGeneratorAgent(model);
      
      // Build agent - simplified without session state
      // (All context is in the prompt)
      const { runner } = await AgentBuilder
        .create('reportGenerator')
        .withAgent(reportAgent)
        .build();

      // Run the agent with timeout
      const reportPromise = runner.ask(prompt);
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Report generation timeout')), 45000); // 45 second timeout
      });
      
      const response = await Promise.race([reportPromise, timeoutPromise]);
      
      // Parse the JSON response
      const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const reportData = JSON.parse(cleanedResponse);
      
      // Build the full report from the structured data
      const report = this.buildReportFromStructure(reportData, topic, citations);
      
      logger.success('Report generated using ADK-TS multi-agent system');
      return report;
    } catch (error) {
      logger.warn('ADK-TS report generation failed, using fallback', error);
      
      // Fallback to basic report
      return this.generateFallbackReport(topic, analysis, extractedContent);
    }
  }

  /**
   * Build report from ADK-TS generated structure
   */
  private buildReportFromStructure(reportData: any, topic: string, citations: Citation[]): ResearchReport {
    const sections = [
      {
        title: 'Abstract',
        content: reportData.abstract || '',
        citations: [],
      },
      {
        title: 'Introduction',
        content: reportData.introduction || '',
        citations: this.extractCitations(reportData.introduction || ''),
      },
      {
        title: 'Literature Review',
        content: reportData.literature_review || '',
        citations: this.extractCitations(reportData.literature_review || ''),
      },
      {
        title: 'Methodology',
        content: reportData.methodology || '',
        citations: this.extractCitations(reportData.methodology || ''),
      },
      {
        title: 'Findings and Results',
        content: reportData.findings || '',
        citations: this.extractCitations(reportData.findings || ''),
      },
      {
        title: 'Discussion and Analysis',
        content: reportData.discussion || '',
        citations: this.extractCitations(reportData.discussion || ''),
      },
      {
        title: 'Conclusion',
        content: reportData.conclusion || '',
        citations: this.extractCitations(reportData.conclusion || ''),
      },
      {
        title: 'Recommendations',
        content: reportData.recommendations || '',
        citations: this.extractCitations(reportData.recommendations || ''),
      },
    ];

    return {
      topic,
      generatedAt: new Date().toISOString(),
      summary: reportData.abstract || sections.find(s => s.content)?.content.substring(0, 500) || '',
      sections,
      citations,
    };
  }

  /**
   * Generate fallback report when ADK-TS fails
   */
  private async generateFallbackReport(
    topic: string,
    analysis: string,
    extractedContent: ExtractedContent[]
  ): Promise<ResearchReport> {
    const citations: Citation[] = extractedContent.map((content, idx) => ({
      id: `cit-${idx + 1}`,
      title: content.title,
      url: content.url,
      author: content.metadata.author,
      publishDate: content.metadata.publishDate,
      accessDate: formatDate(),
    }));

    // Use the old implementation with AgentBuilder
    const reportPrompt = this.buildReportGenerationPrompt(topic, analysis, citations);

    const model = this.selectModel();
    
    // Simple agent builder without session complexity
    const reportResponse = await AgentBuilder
      .create('reportGenerator')
      .withModel(model)
      .withInstruction('You are an expert academic writer creating comprehensive research reports.')
      .ask(reportPrompt);

    const report = this.parseReportResponse(reportResponse, topic, citations);

    logger.success('Report generated using fallback');
    return report;
  }

  /**
   * Build report generation prompt
   */
  private buildReportGenerationPrompt(
    topic: string,
    analysis: string,
    citations: Citation[]
  ): string {
    let prompt = `Generate a comprehensive academic research report on: "${topic}"\n\n`;
    prompt += `Based on this detailed analysis:\n${analysis}\n\n`;
    prompt += `Available citations:\n`;
    citations.forEach((cit, idx) => {
      prompt += `[${idx + 1}] ${cit.author || 'Unknown'}. "${cit.title}." ${cit.url}.\n`;
    });

    prompt += `\n\nCreate a comprehensive academic report following this EXACT structure:\n\n`;
    prompt += `## 1. ABSTRACT\n(200-250 words summary)\n\n`;
    prompt += `## 2. INTRODUCTION\n(3-4 paragraphs with background, objectives, scope)\n\n`;
    prompt += `## 3. LITERATURE REVIEW\n(4-5 paragraphs synthesizing existing research)\n\n`;
    prompt += `## 4. METHODOLOGY\n(2-3 paragraphs explaining research approach)\n\n`;
    prompt += `## 5. FINDINGS AND RESULTS\n(5-6 paragraphs organized thematically)\n\n`;
    prompt += `## 6. DISCUSSION AND ANALYSIS\n(4-5 paragraphs interpreting findings)\n\n`;
    prompt += `## 7. CONCLUSION\n(2-3 paragraphs summarizing key points)\n\n`;
    prompt += `## 8. RECOMMENDATIONS\n(2-3 paragraphs with actionable suggestions)\n\n`;
    prompt += `Use formal academic language, cite sources using [number] format, and be comprehensive.`;

    return prompt;
  }

  /**
   * Parse report response into structured format
   */
  private parseReportResponse(response: string, topic: string, citations: Citation[]): ResearchReport {
    const lines = response.split('\n');
    const sections: any[] = [];
    let currentSection: any = null;
    let abstract = '';
    let inAbstract = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.toLowerCase().includes('abstract') || 
          trimmedLine.toLowerCase().includes('executive summary')) {
        inAbstract = true;
        continue;
      }

      const mainHeaderMatch = trimmedLine.match(/^#{2}\s*\d*\.?\s*(.+)/) || 
                              trimmedLine.match(/^\d+\.\s+([A-Z\s]+)$/);
      
      if (mainHeaderMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        
        currentSection = {
          title: mainHeaderMatch[1].trim(),
          content: '',
          citations: [],
        };
        inAbstract = false;
        continue;
      }

      if (trimmedLine) {
        if (inAbstract && sections.length === 0) {
          abstract += line + '\n';
        } else if (currentSection) {
          currentSection.content += line + '\n';
          const lineCitations = this.extractCitations(line);
          currentSection.citations = [...new Set([...currentSection.citations, ...lineCitations])];
        }
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    if (sections.length === 0) {
      sections.push({
        title: 'Overview',
        content: response,
        citations: this.extractCitations(response),
      });
    }

    return {
      topic,
      generatedAt: new Date().toISOString(),
      summary: abstract.trim() || response.substring(0, 500),
      sections,
      citations,
    };
  }

  /**
   * Extract citation references from text
   */
  private extractCitations(text: string): string[] {
    const matches = text.match(/\[(\d+)\]/g);
    if (!matches) return [];
    
    return matches.map(m => {
      const num = parseInt(m.replace(/[\[\]]/g, ''));
      return `cit-${num}`;
    });
  }


}
