/**
 * Content Extraction Service - Extracts and cleans web content
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { ExtractedContent, ToolResult } from '../types/index.js';
import { Logger, cleanText, retryWithBackoff } from '../utils/index.js';

const logger = new Logger('ContentExtractor');

export class ContentExtractionService {
  /**
   * Extract content from a URL
   */
  async extractContent(url: string, timeout: number = 8000): Promise<ToolResult<ExtractedContent>> {
    try {
      logger.info(`Extracting content from: ${url}`);

      const content = await retryWithBackoff(async () => {
        const response = await axios.get(url, {
          timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          maxRedirects: 3, // Reduced from 5 for speed
        });

        return response.data;
      }, 1); // Reduced to 1 retry for faster failure (was 2)

      const extracted = this.parseHtml(content, url);

      logger.success(`Extracted ${extracted.metadata.wordCount} words from ${url}`);

      return {
        success: true,
        data: extracted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to extract content from ${url}: ${errorMessage}`);
      
      // Return partial data instead of failing completely
      return {
        success: false,
        error: errorMessage,
        data: {
          url,
          title: url,
          content: '',
          metadata: {
            wordCount: 0,
          },
        },
      };
    }
  }

  /**
   * Extract content from multiple URLs in parallel
   */
  async extractMultiple(urls: string[], maxConcurrent: number = 8): Promise<ExtractedContent[]> {
    const results: ExtractedContent[] = [];
    
    // Process in batches to avoid overwhelming servers
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map(url => this.extractContent(url))
      );
      
      // Only include successful extractions
      results.push(
        ...batchResults
          .filter(r => r.success && r.data)
          .map(r => r.data!)
          .filter(c => c.content.length > 100) // Minimum content threshold
      );
    }

    logger.info(`Successfully extracted content from ${results.length}/${urls.length} URLs`);
    return results;
  }

  /**
   * Parse HTML and extract main content
   */
  private parseHtml(html: string, url: string): ExtractedContent {
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, footer, header, aside, iframe, ads').remove();

    // Try to find main content
    let title = $('h1').first().text() || $('title').text() || 'Untitled';
    title = cleanText(title);

    // Extract metadata
    const author = $('meta[name="author"]').attr('content') || 
                   $('.author').first().text() ||
                   undefined;

    const publishDate = $('meta[property="article:published_time"]').attr('content') ||
                        $('time').first().attr('datetime') ||
                        undefined;

    // Extract main content - try different selectors
    let content = '';
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.content',
      '.article-content',
      '.post-content',
      '#content',
      'body',
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        content = element.text();
        if (content.length > 500) break; // Found substantial content
      }
    }

    // Clean and normalize content
    content = cleanText(content);

    // Calculate word count
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

    return {
      url,
      title,
      content: content.substring(0, 50000), // Limit to ~50k chars
      metadata: {
        author: author ? cleanText(author) : undefined,
        publishDate,
        wordCount,
      },
    };
  }

  /**
   * Summarize extracted content (for preview)
   */
  summarizeContent(content: ExtractedContent, maxLength: number = 500): string {
    const sentences = content.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let summary = '';
    for (const sentence of sentences) {
      if ((summary + sentence).length > maxLength) break;
      summary += sentence.trim() + '. ';
    }

    return summary.trim();
  }
}
