import { SequentialAgent } from '@iqai/adk';
import { createQueryGeneratorAgent } from '../specialized/QueryGeneratorAgent.js';
import { createContentAnalyzerAgent } from '../specialized/ContentAnalyzerAgent.js';
import { createReportGeneratorAgent } from '../specialized/ReportGeneratorAgent.js';

export interface ResearchPipelineConfig {
  aiProvider?: 'gemini' | 'openai' | 'anthropic';
  model?: string;
}

/**
 * Creates the main research pipeline using SequentialAgent
 * 
 * Workflow:
 * 1. Query Generation -> state['search_queries']
 * 2. Search Execution -> state['search_results'] (handled externally)
 * 3. Content Extraction -> state['extracted_content'] (handled externally)
 * 4. Content Analysis -> state['content_analysis']
 * 5. Report Generation -> state['report_structure']
 * 
 * This follows ADK-TS Sequential Agent pattern for ordered execution
 * with automatic state management between agents.
 */
export function createResearchPipelineAgent(config: ResearchPipelineConfig = {}): SequentialAgent {
  const model = config.model || selectDefaultModel(config.aiProvider);

  // Create specialized agents
  const queryGenerator = createQueryGeneratorAgent(model);
  const contentAnalyzer = createContentAnalyzerAgent(model);
  const reportGenerator = createReportGeneratorAgent(model);

  // Create the sequential pipeline
  return new SequentialAgent({
    name: 'researchPipeline',
    description: 'End-to-end academic research workflow with query generation, analysis, and report creation',
    subAgents: [
      queryGenerator,
      // Note: Search execution and content extraction happen via services
      // between query generation and analysis (handled in AutoResearchAgent)
      contentAnalyzer,
      reportGenerator,
    ],
  });
}

/**
 * Select default model based on AI provider
 */
function selectDefaultModel(provider?: 'gemini' | 'openai' | 'anthropic'): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    case 'gemini':
    default:
      return 'gemini-2.0-flash-exp';
  }
}
