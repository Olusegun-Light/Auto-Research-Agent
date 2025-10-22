/**
 * Specialized Agents for Research Workflow
 * 
 * These agents are designed to work with ADK-TS workflow patterns:
 * - Each agent has a specific, focused responsibility
 * - Uses outputKey to save results to session state
 * - Uses {key} syntax to read from session state
 * - Optimized temperature and token limits for each task
 */

export { createQueryGeneratorAgent } from './QueryGeneratorAgent';
export { createContentAnalyzerAgent } from './ContentAnalyzerAgent';
export { createReportGeneratorAgent } from './ReportGeneratorAgent';
export { createTopicExtractorAgent, extractCleanTopic } from './TopicExtractorAgent';
