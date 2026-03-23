/**
 * Traceability Agent — Phase 8 (Strict 100% Mapping Mode)
 *
 * Maps every major claim in the final report back to its source.
 * Claims that cannot be matched are flagged as UNSUPPORTED and
 * returned in a separate list so AutoResearchAgent can strip them.
 */

import { LlmAgent, AgentBuilder } from '@iqai/adk';
import { TraceabilityEntry, ResearchNote, ResearchMode } from '../../types/index.js';
import { Logger } from '../../utils/index.js';

const logger = new Logger('TraceabilityAgent');

export function createTraceabilityAgent(model: string): LlmAgent {
  const instruction = [
    'You are generating a strict traceability audit for an academic paper.',
    '',
    'TASK:',
    'For EVERY major claim or factual statement in the report, you must either:',
    '  a) Trace it to a specific source from the notes list, OR',
    '  b) Mark it as UNSUPPORTED.',
    '',
    'A "major claim" is any sentence that:',
    '- States a fact, statistic, or finding',
    '- Makes a comparison between groups or conditions',
    '- Describes a cause-effect relationship',
    '- Quotes or paraphrases a specific source',
    '',
    'STRICT RULES:',
    '- 100% coverage: do not skip claims even if you are unsure.',
    '- If the claim partially matches a note, mark confidence as "partial".',
    '- If no note supports the claim, it MUST appear in unsupportedClaims.',
    '- Source format MUST be "Author, Year" — not a URL, not a website name.',
    '- source_title is the full article/webpage title (not the domain).',
    '',
    'VALIDATION STEP (internal):',
    'Before returning, count the claims in the report and check every one',
    'appears in either the traced list or unsupportedClaims.',
    '',
    'OUTPUT FORMAT — return ONLY a valid JSON object, no markdown fences:',
    '{',
    '  "traced": [',
    '    {',
    '      "claim": "Statement from the report",',
    '      "source": "Author, Year",',
    '      "source_title": "Full title of source",',
    '      "confidence": "full | partial"',
    '    }',
    '  ],',
    '  "unsupportedClaims": [',
    '    "Verbatim claim that has NO source in the notes"',
    '  ]',
    '}',
  ].join('\n');

  return new LlmAgent({
    name: 'traceability_agent',
    model,
    description: 'Strict 100% claim-source mapping with unsupported claim flagging',
    instruction,
    outputKey: 'traceability_report',
    generateContentConfig: {
      temperature: 0.1,
      maxOutputTokens: 4000,
    },
  });
}

/**
 * Generate a traceability map for the report.
 * Returns `traced` entries (appended as Appendix A)
 * and logs `unsupportedClaims` for the pipeline to strip.
 */
export async function generateTraceability(
  reportText: string,
  notes: ResearchNote[],
  mode: ResearchMode,
  model: string
): Promise<TraceabilityEntry[]> {
  if (mode === 'fast' || mode === 'standard') {
    return [];
  }

  try {
    logger.info('Running strict traceability audit...');

    const agent = createTraceabilityAgent(model);
    const { runner } = await AgentBuilder
      .create('traceabilityAgent')
      .withAgent(agent)
      .build();

    let notesRef = 'AVAILABLE SOURCES (use these for matching claims):\n';
    notes.slice(0, 50).forEach((n, i) => {
      notesRef += `[${i + 1}] (${n.author}, ${n.year}) "${n.claim}" — ${n.source_title}\n`;
    });

    const prompt = [
      notesRef,
      '',
      '--- REPORT ---',
      reportText.substring(0, 5000),
      '--- END REPORT ---',
      '',
      'Run the strict traceability audit. Flag all unsupported claims.',
      'Return the JSON object with "traced" and "unsupportedClaims" keys.',
    ].join('\n');

    const timeout = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Traceability timeout')), 35000)
    );

    const response = await Promise.race([runner.ask(prompt), timeout]);
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned) as { traced: TraceabilityEntry[]; unsupportedClaims: string[] };

    if (!Array.isArray(result.traced)) throw new Error('Malformed traceability response');

    if (result.unsupportedClaims && result.unsupportedClaims.length > 0) {
      logger.warn(`Unsupported claims found: ${result.unsupportedClaims.length}`);
      result.unsupportedClaims.forEach((c, i) => logger.warn(`  [U${i + 1}] ${c.substring(0, 80)}`));
    }

    logger.success(`Traceability: ${result.traced.length} traced, ${result.unsupportedClaims?.length ?? 0} unsupported`);
    return result.traced;
  } catch (error) {
    logger.warn('Traceability generation failed', error);
    return [];
  }
}
