import { LlmAgent } from '@iqai/adk';
import { ResearchQuestion } from '../../types/index.js';

/**
 * Specialized LLM Agent for generating diverse search queries.
 * When research questions from Phase 1 are provided the queries are
 * tightly aligned with the planned outline.
 */
export function createQueryGeneratorAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: 'query_generator',
    model,
    description: 'Generates diverse, effective search queries for academic research topics',
    instruction: `You are an expert research librarian and information specialist.

**Your Role:**
Generate diverse, high-quality search queries for academic research that will find authoritative sources.

**Query Strategy:**
1. If research questions are provided, generate queries that directly address each one.
2. Otherwise create queries covering:
   - Overview and definitions
   - Recent developments and trends
   - Academic research and papers
   - Case studies and examples
   - Statistical data and reports
   - Expert opinions and analysis

3. Quality guidelines:
   - Mix broad and specific terms
   - Include academic keywords ("research", "study", "analysis", "peer-reviewed")
   - Target authoritative sources (.edu, .org, .gov, academic publishers, journals)
   - Use varied phrasing to capture different perspectives
   - Prioritise credible academic and governmental domains

4. Diversity requirements:
   - No two queries should be identical
   - Cover complementary aspects of the topic
   - Balance depth and breadth

**Output Format:**
Return ONLY a valid JSON array of search query strings.
No explanations, no markdown formatting, just: ["query 1", "query 2", ...]`,
    outputKey: 'search_queries',
    generateContentConfig: {
      temperature: 0.7,
      maxOutputTokens: 600,
    },
  });
}

/**
 * Build the prompt for the QueryGeneratorAgent, optionally incorporating
 * research questions from Phase 1 to produce better-targeted queries.
 */
export function buildQueryGeneratorPrompt(
  topic: string,
  queryCount: number,
  depth: string,
  researchQuestions?: ResearchQuestion[]
): string {
  let prompt = `Generate ${queryCount} diverse search queries for academic research.\n\nTopic: "${topic}"\nResearch Depth: ${depth}\n`;

  if (researchQuestions && researchQuestions.length > 0) {
    prompt += `\nFocused Research Questions (align queries to these):\n`;
    researchQuestions.forEach((rq, i) => {
      prompt += `${i + 1}. [${rq.subtopic}] ${rq.question}\n`;
    });
  }

  prompt += `\nReturn ONLY a JSON array of ${queryCount} unique search query strings.`;
  return prompt;
}
