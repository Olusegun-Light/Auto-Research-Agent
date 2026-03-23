/**
 * Query Understanding Agent — Phases 1 & 2
 *
 * Phase 1 – Query Understanding:
 *   • Identifies key concepts, scope and research type
 *   • Generates 3–5 focused research questions
 *
 * Phase 2 – Research Planning:
 *   • Breaks the topic into subtopics
 *   • Produces a section-by-section outline with intent
 */

import { LlmAgent, AgentBuilder } from '@iqai/adk';
import { ResearchOutline, ResearchMode } from '../../types/index.js';
import { Logger } from '../../utils/index.js';

const logger = new Logger('QueryUnderstandingAgent');

export function createQueryUnderstandingAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: 'query_understanding',
    model,
    description: 'Interprets research topics, generates focused research questions and a structured outline',
    instruction: `You are an expert academic research planner operating as two combined phases.

## PHASE 1 – QUERY UNDERSTANDING
- Clearly interpret the research topic
- Identify: key concepts, scope (broad vs narrow), research type (theoretical | empirical | review | technical)
- Generate 3–5 focused research questions that will guide the work

## PHASE 2 – RESEARCH PLANNING
- Break the topic into logical subtopics
- Define a section-by-section outline (Background, Literature Review, Methodology, Findings, Discussion, etc.)
- State the intent (what information is needed) for each section

## OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown fences, no extra text:
{
  "topicSummary": "string — concise interpretation of the topic and its scope",
  "researchType": "theoretical | empirical | review | technical",
  "researchQuestions": [
    { "question": "string", "subtopic": "string" }
  ],
  "sections": [
    { "title": "string", "intent": "string — what information this section must contain" }
  ]
}

RULES:
- researchQuestions must have 3–5 items
- sections must map 1:1 with a standard academic paper structure (Abstract, Introduction, Literature Review, Methodology, Findings, Discussion, Conclusion, Recommendations)
- Be precise and academic in tone
- Do NOT include any explanation outside the JSON`,
    outputKey: 'research_outline',
    generateContentConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000,
    },
  });
}

/**
 * Run Phase 1+2: understand query and produce a structured research outline.
 */
export async function generateResearchOutline(
  topic: string,
  mode: ResearchMode,
  model: string
): Promise<ResearchOutline> {
  try {
    logger.info(`Generating research outline for: "${topic}" (mode: ${mode})`);

    const agent = createQueryUnderstandingAgent(model);
    const { runner } = await AgentBuilder
      .create('queryUnderstanding')
      .withAgent(agent)
      .build();

    const prompt = `Research topic: "${topic}"
Research mode: ${mode}

Perform Phase 1 (query understanding) and Phase 2 (research planning) and return the JSON outline.`;

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('QueryUnderstanding timeout')), 20000)
    );

    const response = await Promise.race([runner.ask(prompt), timeoutPromise]);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as ResearchOutline;

    // Basic validation
    if (!parsed.topicSummary || !Array.isArray(parsed.researchQuestions) || !Array.isArray(parsed.sections)) {
      throw new Error('Malformed outline response');
    }

    logger.success(`Outline generated: ${parsed.researchQuestions.length} questions, ${parsed.sections.length} sections`);
    return parsed;
  } catch (error) {
    logger.warn('QueryUnderstandingAgent failed, using fallback outline', error);
    return buildFallbackOutline(topic);
  }
}

function buildFallbackOutline(topic: string): ResearchOutline {
  return {
    topicSummary: `A comprehensive review of "${topic}" covering key concepts, current research and practical implications.`,
    researchType: 'review',
    researchQuestions: [
      { question: `What are the key concepts and definitions related to ${topic}?`, subtopic: 'Background' },
      { question: `What does existing literature say about ${topic}?`, subtopic: 'Literature Review' },
      { question: `What are the main findings and evidence on ${topic}?`, subtopic: 'Findings' },
      { question: `What are the practical implications of ${topic}?`, subtopic: 'Discussion' },
      { question: `What future research directions exist for ${topic}?`, subtopic: 'Recommendations' },
    ],
    sections: [
      { title: 'Abstract', intent: 'Concise summary of objectives, methods and key findings' },
      { title: 'Introduction', intent: 'Background, problem statement and research objectives' },
      { title: 'Literature Review', intent: 'Synthesis of existing studies and theoretical frameworks' },
      { title: 'Methodology', intent: 'Research approach, data sources and analysis techniques' },
      { title: 'Findings and Results', intent: 'Key discoveries and evidence from sources' },
      { title: 'Discussion and Analysis', intent: 'Interpretation of findings and implications' },
      { title: 'Conclusion', intent: 'Summary of main findings and significance' },
      { title: 'Recommendations', intent: 'Actionable suggestions for practice or future research' },
    ],
  };
}
