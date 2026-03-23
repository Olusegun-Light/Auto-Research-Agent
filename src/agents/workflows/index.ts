/**
 * Workflow Agents for Research System
 * 
 * Following ADK-TS workflow patterns for orchestration:
 * - SequentialAgent: Execute agents in order
 * - ParallelAgent: Execute agents simultaneously
 * - LoopAgent: Repeat until conditions met
 */

export { createResearchPipelineAgent } from './ResearchPipelineAgent.js';
export type { ResearchPipelineConfig } from './ResearchPipelineAgent.js';
