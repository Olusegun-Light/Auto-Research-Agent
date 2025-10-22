/**
 * AI Service - Handles AI model interactions for analysis and synthesis
 */

import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { ExtractedContent, ResearchReport, ResearchSection, Citation } from '../types/index.js';
import { Logger } from '../utils/index.js';

const logger = new Logger('AIService');

export class AIService {
  private openaiApiKey?: string;
  private anthropicApiKey?: string;
  private geminiApiKey?: string;
  private geminiClient?: GoogleGenerativeAI;
  private availableProviders: ('openai' | 'anthropic' | 'gemini')[];

  constructor() {
    // Store all available API keys
    this.openaiApiKey = config.openaiApiKey;
    this.anthropicApiKey = config.anthropicApiKey;
    this.geminiApiKey = config.geminiApiKey;

    // Initialize Gemini client if key is available
    if (this.geminiApiKey) {
      this.geminiClient = new GoogleGenerativeAI(this.geminiApiKey);
    }

    // Determine available providers
    this.availableProviders = [];
    if (this.openaiApiKey) this.availableProviders.push('openai');
    if (this.anthropicApiKey) this.availableProviders.push('anthropic');
    if (this.geminiApiKey) this.availableProviders.push('gemini');

    if (this.availableProviders.length === 0) {
      throw new Error('No AI provider configured');
    }

    logger.info(`Available AI providers: ${this.availableProviders.join(', ')}`);
  }

  /**
   * Select the best provider based on estimated content size
   */
  private selectProvider(estimatedTokens: number): 'openai' | 'anthropic' | 'gemini' {
    // For small contexts (<10k tokens), use fastest/cheapest available
    if (estimatedTokens < 10000) {
      if (this.openaiApiKey) {
        logger.info(`Using OpenAI for small context (${estimatedTokens} tokens)`);
        return 'openai';
      }
      if (this.geminiApiKey) {
        logger.info(`Using Gemini for small context (${estimatedTokens} tokens)`);
        return 'gemini';
      }
      if (this.anthropicApiKey) {
        logger.info(`Using Anthropic for small context (${estimatedTokens} tokens)`);
        return 'anthropic';
      }
    }

    // For medium contexts (10k-50k tokens), prefer OpenAI or Anthropic
    if (estimatedTokens < 50000) {
      if (this.openaiApiKey) {
        logger.info(`Using OpenAI for medium context (${estimatedTokens} tokens)`);
        return 'openai';
      }
      if (this.anthropicApiKey) {
        logger.info(`Using Anthropic for medium context (${estimatedTokens} tokens)`);
        return 'anthropic';
      }
      if (this.geminiApiKey) {
        logger.info(`Using Gemini for medium context (${estimatedTokens} tokens)`);
        return 'gemini';
      }
    }

    // For large contexts (>50k tokens), prefer Gemini or Anthropic
    if (this.geminiApiKey) {
      logger.info(`Using Gemini for large context (${estimatedTokens} tokens)`);
      return 'gemini';
    }
    if (this.anthropicApiKey) {
      logger.info(`Using Anthropic for large context (${estimatedTokens} tokens)`);
      return 'anthropic';
    }
    if (this.openaiApiKey) {
      logger.info(`Using OpenAI for large context (${estimatedTokens} tokens)`);
      return 'openai';
    }

    throw new Error('No AI provider available');
  }

  /**
   * Estimate token count from text (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Analyze and synthesize research content (longer and more comprehensive)
   */
  async analyzeContent(contents: ExtractedContent[], topic: string): Promise<string> {
    logger.info(`Analyzing ${contents.length} sources for topic: "${topic}"`);

    const prompt = this.buildAnalysisPrompt(contents, topic);
    const analysis = await this.complete(prompt, 8000); // Increased from 4000

    logger.success('Content analysis complete');
    return analysis;
  }

  /**
   * Generate structured academic report from analysis
   */
  async generateReport(
    topic: string,
    analysis: string,
    citations: Citation[],
    includeVisualization: boolean = false
  ): Promise<ResearchReport> {
    logger.info('Generating comprehensive academic report...');

    const prompt = this.buildAcademicReportPrompt(topic, analysis, citations, includeVisualization);
    const response = await this.complete(prompt, 12000); // Increased from 4000 for longer reports

    // Parse the structured response
    const report = this.parseAcademicReportResponse(response, topic, citations);

    logger.success('Academic report generation complete');
    return report;
  }

  /**
   * Generate search queries from a topic
   */
  async generateSearchQueries(topic: string, count: number = 5): Promise<string[]> {
    const prompt = `Generate ${count} diverse search queries to thoroughly research the topic: "${topic}".

Requirements:
- Create queries that cover different aspects of the topic
- Include both general and specific queries
- Focus on recent, authoritative sources
- Consider different angles and perspectives

Return ONLY a JSON array of query strings, no other text.`;

    const response = await this.complete(prompt, 500);
    
    try {
      const queries = JSON.parse(response);
      return Array.isArray(queries) ? queries.slice(0, count) : [topic];
    } catch {
      // Fallback to basic queries
      return [
        topic,
        `${topic} overview`,
        `${topic} research`,
        `recent developments ${topic}`,
        `${topic} analysis`
      ].slice(0, count);
    }
  }

  /**
   * Complete text using the best AI model for the content size
   */
  private async complete(prompt: string, maxTokens: number): Promise<string> {
    const estimatedTokens = this.estimateTokens(prompt) + maxTokens;
    const provider = this.selectProvider(estimatedTokens);

    try {
      switch (provider) {
        case 'openai':
          return await this.completeOpenAI(prompt, maxTokens);
        case 'anthropic':
          return await this.completeAnthropic(prompt, maxTokens);
        case 'gemini':
          return await this.completeGemini(prompt, maxTokens);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Error with ${provider}, trying fallback provider`, error);
      // Try fallback to other providers
      return await this.completeWithFallback(prompt, maxTokens, provider);
    }
  }

  /**
   * Try alternative providers if the primary one fails
   */
  private async completeWithFallback(
    prompt: string, 
    maxTokens: number, 
    failedProvider: string
  ): Promise<string> {
    const remainingProviders = this.availableProviders.filter(p => p !== failedProvider);
    
    for (const provider of remainingProviders) {
      try {
        logger.info(`Attempting fallback to ${provider}`);
        switch (provider) {
          case 'openai':
            return await this.completeOpenAI(prompt, maxTokens);
          case 'anthropic':
            return await this.completeAnthropic(prompt, maxTokens);
          case 'gemini':
            return await this.completeGemini(prompt, maxTokens);
        }
      } catch (error) {
        logger.warn(`Fallback to ${provider} failed`, error);
        continue;
      }
    }
    
    throw new Error('All AI providers failed');
  }

  /**
   * Complete using OpenAI API
   */
  private async completeOpenAI(prompt: string, maxTokens: number): Promise<string> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',  // Updated to use more widely available model
          messages: [
            {
              role: 'system',
              content: 'You are a research assistant that helps analyze information and generate comprehensive reports.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      // Provide more detailed error information
      if (error.response?.status === 401) {
        throw new Error('OpenAI API key is invalid or expired');
      } else if (error.response?.status === 429) {
        throw new Error('OpenAI API rate limit exceeded or insufficient credits');
      } else if (error.response?.data?.error) {
        throw new Error(`OpenAI API error: ${error.response.data.error.message}`);
      }
      throw error;
    }
  }

  /**
   * Complete using Anthropic API
   */
  private async completeAnthropic(prompt: string, maxTokens: number): Promise<string> {
    if (!this.anthropicApiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
      },
      {
        headers: {
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.content[0].text;
  }

  /**
   * Complete using Google Gemini API
   */
  private async completeGemini(prompt: string, maxTokens: number): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('Gemini API key not configured');
    }

    // Try multiple model names in order of preference
    const modelNames = [
      'gemini-1.5-flash',      // Latest fast model
      'gemini-1.5-pro-latest', // Latest pro model
      'gemini-pro',            // Stable pro model
      'gemini-1.5-pro',        // Specific version
    ];

    let lastError: Error | null = null;

    for (const modelName of modelNames) {
      try {
        const model = this.geminiClient.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7,
          },
        });

        const result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'You are a research assistant that helps analyze information and generate comprehensive reports.\n\n' + prompt
                }
              ]
            }
          ],
        });

        const response = result.response;
        logger.info(`Successfully used Gemini model: ${modelName}`);
        return response.text();
      } catch (error: any) {
        lastError = error;
        // If it's a 404, try the next model
        if (error.status === 404) {
          logger.warn(`Gemini model ${modelName} not available, trying next...`);
          continue;
        }
        // For other errors, throw immediately
        if (error.message?.includes('fetch failed')) {
          throw new Error('Gemini API network error - check your internet connection or API key validity');
        }
        throw error;
      }
    }

    // If we got here, all models failed
    throw new Error(`Gemini API error: All model variants failed. Last error: ${lastError?.message}`);
  }

  /**
   * Build prompt for content analysis (enhanced for academic rigor)
   */
  private buildAnalysisPrompt(contents: ExtractedContent[], topic: string): string {
    let prompt = `You are analyzing research sources for the topic: "${topic}"\n\n`;
    prompt += `Synthesize the following sources into a comprehensive, academic-level analysis:\n\n`;

    contents.forEach((content, idx) => {
      prompt += `## Source ${idx + 1}: ${content.title}\n`;
      prompt += `URL: ${content.url}\n`;
      if (content.metadata.author) {
        prompt += `Author: ${content.metadata.author}\n`;
      }
      if (content.metadata.publishDate) {
        prompt += `Published: ${content.metadata.publishDate}\n`;
      }
      prompt += `\nContent:\n${content.content.substring(0, 5000)}\n\n`; // Increased from 3000
      prompt += `---\n\n`;
    });

    prompt += `\nProvide a comprehensive, academic-level analysis that:\n`;
    prompt += `1. Identifies and discusses key themes, concepts, and findings in detail\n`;
    prompt += `2. Highlights important data, statistics, and empirical evidence\n`;
    prompt += `3. Discusses different perspectives, debates, or controversies in the field\n`;
    prompt += `4. Synthesizes information across sources, showing connections and patterns\n`;
    prompt += `5. Identifies methodological approaches used in the research\n`;
    prompt += `6. Notes limitations, gaps, or areas needing further research\n`;
    prompt += `7. Evaluates the quality and credibility of sources\n`;
    prompt += `8. Provides historical context where relevant\n\n`;
    prompt += `Write in a formal, objective, third-person academic style. Be thorough and detailed.`;

    return prompt;
  }

  /**
   * Build prompt for academic report generation following standard structure
   */
  private buildAcademicReportPrompt(
    topic: string,
    analysis: string,
    citations: Citation[],
    includeVisualization: boolean
  ): string {
    let prompt = `Generate a comprehensive academic research report on: "${topic}"\n\n`;
    prompt += `Based on this detailed analysis:\n${analysis}\n\n`;
    prompt += `Available citations:\n`;
    citations.forEach((cit, idx) => {
      prompt += `[${idx + 1}] ${cit.author || 'Unknown'}. "${cit.title}." ${cit.url}. `;
      if (cit.publishDate) prompt += `Published: ${cit.publishDate}. `;
      prompt += `Accessed: ${cit.accessDate}.\n`;
    });

    prompt += `\n\nCreate a comprehensive academic report following this EXACT structure:\n\n`;
    
    prompt += `## 1. ABSTRACT\n`;
    prompt += `Write a concise abstract (200-250 words) that includes:\n`;
    prompt += `- Brief background and context\n`;
    prompt += `- Research objectives/purpose\n`;
    prompt += `- Methodology overview\n`;
    prompt += `- Key findings\n`;
    prompt += `- Main conclusions\n\n`;

    prompt += `## 2. INTRODUCTION\n`;
    prompt += `Write a comprehensive introduction (3-4 substantial paragraphs) covering:\n`;
    prompt += `- Background and context of the topic\n`;
    prompt += `- Significance and relevance of the research\n`;
    prompt += `- Clear statement of objectives and research questions\n`;
    prompt += `- Scope of the report (what is covered and what is not)\n`;
    prompt += `- Brief overview of the report structure\n`;
    prompt += `Reference citations using [1], [2] format.\n\n`;

    prompt += `## 3. LITERATURE REVIEW\n`;
    prompt += `Write an extensive literature review (4-5 substantial paragraphs) that:\n`;
    prompt += `- Summarizes and synthesizes previous research and studies\n`;
    prompt += `- Discusses key theories, concepts, and frameworks\n`;
    prompt += `- Identifies trends and patterns in existing research\n`;
    prompt += `- Highlights debates, controversies, or gaps in knowledge\n`;
    prompt += `- Shows how this research builds on or differs from previous work\n`;
    prompt += `- Demonstrates understanding of the scholarly context\n`;
    prompt += `Heavily cite sources using [1], [2], [3] format.\n\n`;

    prompt += `## 4. METHODOLOGY\n`;
    prompt += `Write a detailed methodology section (2-3 paragraphs) explaining:\n`;
    prompt += `- Research approach and design used\n`;
    prompt += `- Data sources and how they were selected\n`;
    prompt += `- Data collection methods and procedures\n`;
    prompt += `- Analysis techniques employed\n`;
    prompt += `- Limitations of the methodology\n`;
    prompt += `Be specific about search strategies, databases used, and selection criteria.\n\n`;

    prompt += `## 5. FINDINGS AND RESULTS\n`;
    prompt += `Present comprehensive findings (5-6 substantial paragraphs) organized thematically:\n`;
    prompt += `- Create 3-4 clear subsections for different themes or aspects\n`;
    prompt += `- Present factual findings without interpretation yet\n`;
    prompt += `- Include specific data, statistics, and examples\n`;
    prompt += `- Use evidence from multiple sources\n`;
    prompt += `- Organize logically and coherently\n`;
    if (includeVisualization) {
      prompt += `- Suggest tables or figures where appropriate\n`;
    }
    prompt += `Cite sources for all factual claims using [1], [2] format.\n\n`;

    prompt += `## 6. DISCUSSION AND ANALYSIS\n`;
    prompt += `Write an in-depth discussion (4-5 substantial paragraphs) that:\n`;
    prompt += `- Interprets and explains what the findings mean\n`;
    prompt += `- Relates findings back to research objectives\n`;
    prompt += `- Compares findings with previous research from literature review\n`;
    prompt += `- Discusses implications and significance\n`;
    prompt += `- Addresses limitations and alternative interpretations\n`;
    prompt += `- Identifies patterns, trends, or unexpected results\n`;
    prompt += `- Discusses practical or theoretical implications\n\n`;

    prompt += `## 7. CONCLUSION\n`;
    prompt += `Write a strong conclusion (2-3 paragraphs) that:\n`;
    prompt += `- Summarizes the main findings clearly\n`;
    prompt += `- Relates findings back to original objectives\n`;
    prompt += `- Discusses the broader significance and implications\n`;
    prompt += `- Acknowledges limitations of the study\n`;
    prompt += `- Does NOT introduce new information\n\n`;

    prompt += `## 8. RECOMMENDATIONS\n`;
    prompt += `Provide practical recommendations (2-3 paragraphs) including:\n`;
    prompt += `- Actionable suggestions based on findings\n`;
    prompt += `- Recommendations for policy, practice, or further research\n`;
    prompt += `- Priorities for future investigation\n`;
    prompt += `- Potential areas for improvement or intervention\n\n`;

    prompt += `IMPORTANT REQUIREMENTS:\n`;
    prompt += `- Use formal, objective, third-person language throughout\n`;
    prompt += `- Write in past tense for methodology and results sections\n`;
    prompt += `- Each section should be substantial and detailed (not superficial)\n`;
    prompt += `- Cite sources liberally using [number] format\n`;
    prompt += `- Maintain academic rigor and scholarly tone\n`;
    prompt += `- Be specific and avoid vague generalizations\n`;
    prompt += `- Ensure logical flow and coherence throughout\n`;
    prompt += `- Make the report comprehensive (aim for depth over breadth)\n\n`;

    prompt += `CRITICAL FORMATTING RULES:\n`;
    prompt += `- Use ## for MAIN section headings ONLY (e.g., "## 1. INTRODUCTION")\n`;
    prompt += `- Use ### for subsection headings ONLY if creating subsections within FINDINGS\n`;
    prompt += `- DO NOT use # or ## or ### within paragraph text\n`;
    prompt += `- DO NOT put markdown headers in the middle of content\n`;
    prompt += `- Section content should be plain paragraphs without markdown formatting\n`;
    prompt += `- Subsection titles should be descriptive (e.g., "### Environmental Impacts" NOT "### # Environmental Impacts")\n\n`;

    prompt += `Format your response with clear section headings as shown above.`;

    return prompt;
  }

  /**
   * Parse academic report response into structured format
   */
  private parseAcademicReportResponse(response: string, topic: string, citations: Citation[]): ResearchReport {
    const lines = response.split('\n');
    const sections: ResearchSection[] = [];
    let currentSection: ResearchSection | null = null;
    let currentSubsection: ResearchSection | null = null;
    let abstract = '';
    let inAbstract = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for abstract/summary
      if (trimmedLine.toLowerCase().includes('abstract') || 
          trimmedLine.toLowerCase().includes('executive summary')) {
        inAbstract = true;
        continue;
      }

      // Check for main section headers (## or numbered like "1. INTRODUCTION")
      const mainHeaderMatch = trimmedLine.match(/^#{2}\s*\d*\.?\s*(.+)/) || 
                              trimmedLine.match(/^\d+\.\s+([A-Z\s]+)$/);
      
      if (mainHeaderMatch) {
        // Save previous section
        if (currentSection) {
          if (currentSubsection) {
            if (!currentSection.subsections) currentSection.subsections = [];
            currentSection.subsections.push(currentSubsection);
            currentSubsection = null;
          }
          sections.push(currentSection);
        }
        
        const title = mainHeaderMatch[1].trim();
        currentSection = {
          title,
          content: '',
          citations: [],
        };
        inAbstract = false;
        continue;
      }

      // Check for subsection headers (### or lettered like "A. Subsection")
      const subHeaderMatch = trimmedLine.match(/^#{3,}\s*(.+)/) || 
                            trimmedLine.match(/^[A-Z]\.\s+(.+)/);
      
      if (subHeaderMatch && currentSection) {
        // Save previous subsection
        if (currentSubsection) {
          if (!currentSection.subsections) currentSection.subsections = [];
          currentSection.subsections.push(currentSubsection);
        }
        
        const title = subHeaderMatch[1].trim();
        currentSubsection = {
          title,
          content: '',
          citations: [],
        };
        continue;
      }

      // Add content to appropriate section
      if (trimmedLine) {
        if (inAbstract && sections.length === 0) {
          abstract += line + '\n';
        } else if (currentSubsection) {
          currentSubsection.content += line + '\n';
          const lineCitations = this.extractCitations(line);
          currentSubsection.citations = [...new Set([...currentSubsection.citations, ...lineCitations])];
        } else if (currentSection) {
          currentSection.content += line + '\n';
          const lineCitations = this.extractCitations(line);
          currentSection.citations = [...new Set([...currentSection.citations, ...lineCitations])];
        }
      }
    }

    // Save final section
    if (currentSection) {
      if (currentSubsection) {
        if (!currentSection.subsections) currentSection.subsections = [];
        currentSection.subsections.push(currentSubsection);
      }
      sections.push(currentSection);
    }

    // If no proper sections found, create basic structure
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
