/**
 * Search Service - Integrates multiple search APIs and data sources
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config/index.js';
import { SearchResult, ToolResult } from '../types/index.js';
import { Logger, retryWithBackoff, removeDuplicates } from '../utils/index.js';

const logger = new Logger('SearchService');

export class SearchService {
  /**
   * Perform comprehensive search across multiple data sources
   */
  async search(query: string, maxResults: number = 10): Promise<ToolResult<SearchResult[]>> {
    try {
      logger.info(`Searching for: "${query}"`);

      let results: SearchResult[] = [];

      // Search all available sources in parallel for better coverage
      const searchPromises: Promise<SearchResult[]>[] = [];

      // Web search engines (primary source)
      if (config.serperApiKey) {
        searchPromises.push(this.searchWithSerper(query, maxResults));
      } else if (config.braveApiKey) {
        searchPromises.push(this.searchWithBrave(query, maxResults));
      } else if (config.googleSearchApiKey && config.googleSearchCx) {
        searchPromises.push(this.searchWithGoogle(query, maxResults));
      }

      // Academic and specialized sources (reduced for speed)
      // Only search 2-3 academic sources instead of all 4
      searchPromises.push(this.searchWikipedia(query, 2)); // Reduced from 3
      searchPromises.push(this.searchSemanticScholar(query, 3)); // Reduced from 5
      // Skip arXiv and CrossRef for faster results in Telegram
      // searchPromises.push(this.searchArxiv(query, 5));
      // searchPromises.push(this.searchCrossRef(query, 5));

      // Execute all searches in parallel with timeout
      const allResults = await Promise.allSettled(searchPromises);
      
      // Combine successful results
      allResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          results.push(...result.value);
        }
      });

      if (results.length === 0) {
        throw new Error('No search results from any source');
      }

      // Remove duplicates, prioritize academic sources, and limit results
      results = this.prioritizeAndDeduplicate(results, maxResults);

      logger.success(`Found ${results.length} unique results from multiple sources`);

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Search failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Prioritize academic sources and remove duplicates
   */
  private prioritizeAndDeduplicate(results: SearchResult[], maxResults: number): SearchResult[] {
    // Assign priority scores
    const scoredResults = results.map(result => {
      let score = result.relevanceScore || 0;
      
      // Boost academic sources
      if (result.url.includes('arxiv.org')) score += 10;
      if (result.url.includes('semanticscholar.org')) score += 10;
      if (result.url.includes('doi.org') || result.url.includes('crossref.org')) score += 10;
      if (result.url.includes('wikipedia.org')) score += 5;
      if (result.url.includes('.edu')) score += 7;
      if (result.url.includes('.gov')) score += 6;
      
      // Boost peer-reviewed indicators
      if (result.snippet.toLowerCase().includes('peer-reviewed') || 
          result.snippet.toLowerCase().includes('journal')) score += 5;
      
      return { ...result, relevanceScore: score };
    });

    // Sort by score and remove duplicates
    const sorted = scoredResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    const unique = removeDuplicates(sorted);
    
    return unique.slice(0, maxResults);
  }

  /**
   * Search Wikipedia for encyclopedic content
   */
  private async searchWikipedia(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      return retryWithBackoff(async () => {
        const response = await axios.get('https://en.wikipedia.org/w/api.php', {
          params: {
            action: 'query',
            list: 'search',
            srsearch: query,
            format: 'json',
            srlimit: maxResults,
          },
        });

        const results = response.data.query?.search || [];
        return results.map((result: any) => ({
          title: result.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
          snippet: result.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
          publishDate: undefined,
          author: 'Wikipedia Contributors',
          relevanceScore: 5,
        }));
      });
    } catch (error) {
      logger.warn(`Wikipedia search failed: ${error}`);
      return [];
    }
  }

  /**
   * Search arXiv for academic papers
   * Currently disabled for speed optimization - uncomment to re-enable
   */
  // @ts-ignore - Unused for speed optimization
  private async searchArxiv(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      return retryWithBackoff(async () => {
        const response = await axios.get('http://export.arxiv.org/api/query', {
          params: {
            search_query: `all:${query}`,
            max_results: maxResults,
            sortBy: 'relevance',
          },
        });

        const $ = cheerio.load(response.data, { xmlMode: true });
        const results: SearchResult[] = [];

        $('entry').each((_, entry) => {
          const $entry = $(entry);
          results.push({
            title: $entry.find('title').text().trim(),
            url: $entry.find('id').text().trim(),
            snippet: $entry.find('summary').text().trim().substring(0, 300),
            publishDate: $entry.find('published').text().trim(),
            author: $entry.find('author name').first().text().trim() || 'arXiv',
            relevanceScore: 10,
          });
        });

        return results;
      });
    } catch (error) {
      logger.warn(`arXiv search failed: ${error}`);
      return [];
    }
  }

  /**
   * Search Semantic Scholar for research papers
   */
  private async searchSemanticScholar(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      return retryWithBackoff(async () => {
        const response = await axios.get('https://api.semanticscholar.org/graph/v1/paper/search', {
          params: {
            query,
            limit: maxResults,
            fields: 'title,authors,abstract,year,url,venue,publicationDate',
          },
        });

        const papers = response.data.data || [];
        return papers.map((paper: any) => ({
          title: paper.title || 'Untitled',
          url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
          snippet: paper.abstract || 'No abstract available',
          publishDate: paper.publicationDate || paper.year?.toString(),
          author: paper.authors?.[0]?.name || 'Unknown',
          relevanceScore: 10,
        }));
      });
    } catch (error) {
      logger.warn(`Semantic Scholar search failed: ${error}`);
      return [];
    }
  }

  /**
   * Search CrossRef for DOI-registered scholarly content
   * Currently disabled for speed optimization - uncomment to re-enable
   */
  // @ts-ignore - Unused for speed optimization
  private async searchCrossRef(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      return retryWithBackoff(async () => {
        const response = await axios.get('https://api.crossref.org/works', {
          params: {
            query: query,
            rows: maxResults,
            select: 'DOI,title,author,abstract,published,container-title',
          },
        });

        const items = response.data.message?.items || [];
        return items.map((item: any) => {
          const title = Array.isArray(item.title) ? item.title[0] : item.title || 'Untitled';
          const author = item.author?.[0] ? 
            `${item.author[0].given || ''} ${item.author[0].family || ''}`.trim() : 
            'Unknown';
          const publishedDate = item.published?.['date-parts']?.[0]?.join('-');
          
          return {
            title,
            url: item.DOI ? `https://doi.org/${item.DOI}` : '',
            snippet: item.abstract || `Published in ${item['container-title']?.[0] || 'academic journal'}`,
            publishDate: publishedDate,
            author,
            relevanceScore: 10,
          };
        }).filter((result: SearchResult) => result.url); // Only include results with DOI
      });
    } catch (error) {
      logger.warn(`CrossRef search failed: ${error}`);
      return [];
    }
  }

  /**
   * Search using Serper API
   */
  private async searchWithSerper(query: string, maxResults: number): Promise<SearchResult[]> {
    return retryWithBackoff(async () => {
      const response = await axios.post(
        'https://google.serper.dev/search',
        {
          q: query,
          num: maxResults,
        },
        {
          headers: {
            'X-API-KEY': config.serperApiKey!,
            'Content-Type': 'application/json',
          },
        }
      );

      const organic = response.data.organic || [];
      return organic.map((result: any) => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet || '',
        publishDate: result.date,
        relevanceScore: 3,
      }));
    });
  }

  /**
   * Search using Brave Search API
   */
  private async searchWithBrave(query: string, maxResults: number): Promise<SearchResult[]> {
    return retryWithBackoff(async () => {
      const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: {
          q: query,
          count: maxResults,
        },
        headers: {
          'X-Subscription-Token': config.braveApiKey!,
          'Accept': 'application/json',
        },
      });

      const results = response.data.web?.results || [];
      return results.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.description || '',
        publishDate: result.age,
        relevanceScore: 3,
      }));
    });
  }

  /**
   * Search using Google Custom Search API
   */
  private async searchWithGoogle(query: string, maxResults: number): Promise<SearchResult[]> {
    return retryWithBackoff(async () => {
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: config.googleSearchApiKey,
          cx: config.googleSearchCx,
          q: query,
          num: Math.min(maxResults, 10), // Google limits to 10 per request
        },
      });

      const items = response.data.items || [];
      return items.map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet || '',
        relevanceScore: 3,
      }));
    });
  }

  /**
   * Generate search queries from a research topic
   */
  generateSearchQueries(topic: string, depth: 'basic' | 'intermediate' | 'comprehensive' = 'intermediate'): string[] {
    const baseQuery = topic;
    
    const queries: string[] = [baseQuery];

    if (depth === 'basic') {
      queries.push(`${topic} overview`);
      queries.push(`${topic} introduction`);
      queries.push(`${topic} academic research`);
    } else if (depth === 'intermediate') {
      queries.push(`${topic} overview`);
      queries.push(`${topic} key concepts`);
      queries.push(`${topic} research papers`);
      queries.push(`${topic} recent developments`);
      queries.push(`${topic} scholarly articles`);
    } else if (depth === 'comprehensive') {
      queries.push(`${topic} comprehensive guide`);
      queries.push(`${topic} research papers`);
      queries.push(`${topic} peer-reviewed studies`);
      queries.push(`${topic} case studies`);
      queries.push(`${topic} latest trends`);
      queries.push(`${topic} expert analysis`);
      queries.push(`${topic} statistics and data`);
      queries.push(`${topic} literature review`);
      queries.push(`${topic} methodology`);
    }

    return queries;
  }
}
