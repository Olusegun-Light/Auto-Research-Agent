/**
 * Validation Agent — Phase 7 (Hard Fix Mode)
 *
 * Acts as a senior academic reviewer AND editor:
 *   1. Identifies ALL issues: invalid citations, weak lit review, repetitive findings,
 *      duplicate sections, NaN/Untitled references, placeholder text
 *   2. FIXES EVERY ISSUE — rewrites sections, does not just suggest
 *   3. Returns ONLY the corrected final document (fixedReport)
 *
 * Output rule: ONE clean document. No original + improved pairs.
 */

import { LlmAgent, AgentBuilder } from '@iqai/adk';
import { ValidationResult, ResearchMode, ResearchNote } from '../../types/index.js';
import { Logger } from '../../utils/index.js';

const logger = new Logger('ValidationAgent');

/** Simple promise delay */
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Retries an async LLM call on 429 rate-limit errors.
 * Parses the "try again in Xs" wait time from the error message.
 */
async function withRateLimit<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.toLowerCase().includes('rate limit');
      if (!is429 || attempt === maxRetries) throw err;
      const match = msg.match(/try again in (\d+(?:\.\d+)?)s/i);
      const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : (attempt + 1) * 15000;
      logger.warn(`Rate limit — waiting ${Math.round(waitMs / 1000)}s before retry (attempt ${attempt + 1}/${maxRetries})...`);
      await sleep(waitMs);
    }
  }
  throw new Error('withRateLimit: exhausted retries');
}

export function createValidationAgent(model: string): LlmAgent {
  const instruction = [
    'You are a senior academic editor. Your job is to produce the FINAL, CORRECTED version of a research paper.',
    '',
    '==== HARD FIX MODE + ACADEMIC DEPTH ENFORCEMENT ====',
    'You are NOT allowed to only suggest improvements.',
    'You MUST fix every issue you find. You MUST rewrite flawed sections.',
    'You MUST expand any section that is too short to meet minimum length requirements.',
    'The output is the SINGLE clean final paper — no original version, no intermediate draft.',
    '',
    '==== MINIMUM LENGTH ENFORCEMENT ====',
    'If any section is shorter than the minimum, EXPAND IT — do not leave it short:',
    '  Abstract          → 150–250 words',
    '  Introduction      → 500–800 words (4–6 paragraphs)',
    '  Literature Review → 800–1500 words (5+ thematic paragraphs)',
    '  Methodology       → 400–700 words (3–4 paragraphs)',
    '  Findings          → 600–1000 words (5+ paragraphs)',
    '  Discussion        → 800–1200 words (5–6 paragraphs)',
    '  Conclusion        → 300–500 words (2–3 paragraphs)',
    '  Recommendations   → 300–500 words (2–3 paragraphs)',
    'EVERY paragraph must have at least 4–6 sentences.',
    'Use WHAT / HOW / WHY for every concept.',
    '',
    '==== PAGE BREAK ENFORCEMENT ====',
    'Every section header in fixedReport must be preceded by ---PAGE BREAK--- on its own line.',
    'Example: ---PAGE BREAK---\\n## Abstract\\n\\n...',
    '',
    '==== WHAT TO FIX ====',
    '',
    '1. CITATION CORRECTION:',
    '   VALID: (Smith, 2020) | (World Health Organization, 2021)',
    '   INVALID - REWRITE:',
    '     (NIDA, --)          -> find the real year from context or remove',
    '     (PubMed, n.d.)      -> website names are NOT authors; use organisation name',
    '     (Frontiersin.org, n.d.) -> use article author or remove',
    '   If a citation cannot be fixed -> remove the claim it supports.',
    '',
    '2. ACADEMIC ASSERTIVENESS:',
    '   Replace ALL weak hedging language in the fixed report:',
    '     "This suggests" -> "This demonstrates" or "This establishes"',
    '     "This may indicate" -> "This indicates" or "This confirms"',
    '     "It is possible that" -> "It is evident that"',
    '     "seems to" -> "demonstrates" or "reveals"',
    '     "might be" -> "is" (when evidence supports it)',
    '     "could potentially" -> "has been shown to"',
    '   EXCEPTION: Keep cautious language ONLY where genuine uncertainty exists.',
    '',
    '3. PARAGRAPH FLOW:',
    '   Every paragraph must: start with a topic sentence, expand logically, end with a closing/linking sentence.',
    '   Add transitions between paragraphs: "Furthermore," | "In contrast," | "Consequently," | "Building on this,"',
    '   Remove any isolated or disconnected paragraph that lacks a clear topic sentence.',
    '',
    '4. FINDINGS vs DISCUSSION SEPARATION:',
    '   FINDINGS must only contain observations — patterns and relationships, with citations.',
    '   FINDINGS must NOT contain: explanations of WHY, implications, policy relevance.',
    '   If a sentence in Findings explains why something happens -> move it to Discussion.',
    '   If a sentence in Findings states what this means for society/policy -> move it to Discussion.',
    '   DISCUSSION must interpret every finding: WHY it happens, real-world meaning, long-term consequences.',
    '   If Discussion lacks causal analysis or real-world impact -> expand it.',
    '',
    '5. TABLE ENFORCEMENT:',
    '   Findings MUST contain at least 1 markdown table.',
    '   If no table exists in Findings -> create one summarising key patterns:',
    '     | Pattern | Supporting Sources | Impact Level |',
    '   Literature Review MAY contain a comparison table (Author | Year | Focus | Key Finding).',
    '   Every table must be referenced in the prose: "As shown in Table X..."',
    '',
    '6. FIGURE ENFORCEMENT:',
    '   Report must contain at least 1 figure placeholder.',
    '   Format: **Figure X: Title** then [IMAGE: description] then *Caption: explanation.*',
    '   If no figure exists -> insert one in Findings or Discussion, referenced in the text.',
    '',
    '7. LITERATURE REVIEW:',
    '   If any paragraph has fewer than 2 sources cited -> rewrite it with comparisons.',
    '   Replace any paragraph that summarises one source alone.',
    '   Use assertive language: "The evidence demonstrates" not "may suggest".',
    '',
    '8. DISCUSSION DEPTH:',
    '   For each key finding, Discussion MUST answer:',
    '     - WHY does this happen? (cause-effect)',
    '     - What does it mean in the real world?',
    '     - What are the long-term consequences?',
    '   If Discussion is purely descriptive without causal analysis -> rewrite it.',
    '   Minimum 7 paragraphs in Discussion after expansion.',
    '',
    '9. REDUNDANCY:',
    '   If the same idea appears in two sections -> keep the fuller version, delete the copy.',
    '   Never keep a section titled "Improved Report" or "Original Report".',
    '',
    '10. REFERENCES CLEANUP:',
    '   Remove references with: "NaN" | "Untitled" | "--" | missing title AND author.',
    '   Every reference must have: Author | Year (or n.d.) | Title | URL.',
    '   Every in-text citation must appear in References. Every Reference must be cited.',
    '',
    '11. STRUCTURAL VALIDATION:',
    '   Final order: Abstract | Introduction | Literature Review | Methodology |',
    '   Findings | Discussion | Conclusion | Recommendations | References',
    '   No section may appear twice.',
    '',
    '==== OUTPUT FORMAT ====',
    'Return ONLY a valid JSON object, no markdown fences:',
    '{',
    '  "overallScore": <integer 1-10, score of the ORIGINAL before fixing>,',
    '  "issues": [{ "section": "string", "type": "citation|structure|redundancy|argument|logical|depth|flow|assertiveness|table|figure", "description": "string" }],',
    '  "suggestions": ["string"],',
    '  "fixedReport": "string — the COMPLETE corrected report, all sections, markdown formatted",',
    '  "changeLog": ["string — each specific change made"]',
    '}',
    '',
    'IMPORTANT:',
    '  - fixedReport must contain ALL sections in correct order.',
    '  - fixedReport must use ## headers for sections with ---PAGE BREAK--- before each.',
    '  - fixedReport must contain at least 1 markdown table (in Findings) and 1 figure placeholder.',
    '  - fixedReport ends with ## References (cleaned).',
    '  - Do NOT include "Improved Report" or "Peer Review Notes" sections in fixedReport.',
  ].join('\n');

  return new LlmAgent({
    name: 'validation_reviewer',
    model,
    description: 'Hard-fix peer reviewer: identifies and corrects all issues, returns single clean output',
    instruction,
    outputKey: 'validation_result',
    generateContentConfig: {
      temperature: 0.2,
      maxOutputTokens: 16000,
    },
  });
}

/**
 * Run Phase 7: validate AND hard-fix the generated report.
 * Skipped automatically for 'fast' mode.
 */
export async function validateReport(
  reportText: string,
  mode: ResearchMode,
  model: string,
  notes: ResearchNote[] = []
): Promise<ValidationResult> {
  if (mode === 'fast') {
    logger.info('Fast mode — skipping validation phase');
    return { issues: [], overallScore: 0, suggestions: ['Validation skipped in fast mode'] };
  }

  try {
    logger.info(`Running hard-fix review (mode: ${mode})`);

    const agent = createValidationAgent(model);
    const { runner } = await AgentBuilder
      .create('validationReviewer')
      .withAgent(agent)
      .build();

    const modeNote = mode === 'critical'
      ? 'CRITICAL MODE: Be extremely strict. Fix every weakness, even minor ones.\n'
      : '';

    // Provide traceable notes so the fixer can insert real citations
    let notesRef = '';
    if (notes.length > 0) {
      notesRef = 'AVAILABLE NOTES (use for adding/correcting citations):\n';
      notes.slice(0, 40).forEach((n, i) => {
        notesRef += `[N${i + 1}] (${n.author}, ${n.year}) "${n.claim}" — ${n.source_title}\n`;
      });
      notesRef += '\n';
    }

    const prompt = [
      modeNote,
      notesRef,
      '--- REPORT TO FIX ---',
      reportText.substring(0, 7500),
      '--- END REPORT ---',
      '',
      'Apply hard-fix mode. Return the JSON with fixedReport containing the complete corrected paper.',
    ].join('\n');

    const response = await withRateLimit(() => {
      const t = new Promise<string>((_, rej) =>
        setTimeout(() => rej(new Error('Validation timeout')), 120000)
      );
      return Promise.race([runner.ask(prompt), t]);
    });
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as ValidationResult;

    if (typeof parsed.overallScore !== 'number' || !Array.isArray(parsed.issues)) {
      throw new Error('Malformed validation response');
    }

    logger.success(`Hard-fix complete — score: ${parsed.overallScore}/10, fixes: ${parsed.changeLog?.length ?? 0}`);
    return parsed;
  } catch (error) {
    logger.warn('ValidationAgent failed, returning empty result', error);
    return { issues: [], overallScore: 0, suggestions: ['Validation could not be completed'] };
  }
}
