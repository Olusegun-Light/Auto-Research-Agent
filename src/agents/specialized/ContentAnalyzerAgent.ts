import { LlmAgent } from '@iqai/adk';

/**
 * Specialized LLM Agents for research content processing.
 *
 * createNoteExtractorAgent   - Phase 4: strict claim-per-source note extraction
 * createContentAnalyzerAgent - Phase 5: comparative, anti-redundant synthesis
 */

// --- Phase 4: Note Extraction ---

export function createNoteExtractorAgent(model: string): LlmAgent {
  const instruction = [
    'You are a meticulous research assistant extracting structured notes from academic sources.',
    '',
    'STRICT RULES:',
    '- Each note must represent ONE clear, specific claim.',
    '- Each claim MUST be tied to the specific source it comes from.',
    '- Do NOT generalise or merge ideas from different sources.',
    '- Do NOT write vague phrases like "studies show" or "research suggests".',
    '- Use the exact author name and year from the source metadata provided.',
    '- If the author is a website (e.g. "nih.gov", "frontiersin.org"), use the',
    '  organisation name instead (e.g. "National Institutes of Health").',
    '- NEVER use a domain name (website URL fragment) as an author.',
    '- Year must be a 4-digit integer or "n.d." — never "--" or empty.',
    '',
    'CITATION FORMAT (in-text when writing the claim):',
    '  VALID:   (Smith, 2020) | (World Health Organization, 2021)',
    '  INVALID: (nih.gov, n.d.) | (PubMed, --) | (Frontiersin.org, 2023)',
    '           domain names, website names, and "--" are forbidden',
    '',
    'OUTPUT FORMAT - return ONLY a valid JSON array, no markdown fences:',
    '[',
    '  {',
    '    "claim": "Clear, specific statement from this source",',
    '    "author": "Author surname or Organisation name (NOT a domain/URL)",',
    '    "year": "4-digit year or n.d.",',
    '    "source_title": "Title of the source",',
    '    "confidence": "high | medium | low"',
    '  }',
    ']',
    '',
    'confidence guide:',
    '- high   -> direct statement backed by data or evidence',
    '- medium -> inferred from context, plausible but less explicit',
    '- low    -> speculative, indirect, or poorly evidenced',
  ].join('\n');

  return new LlmAgent({
    name: 'note_extractor',
    model,
    description: 'Extracts traceable, claim-bound research notes with validated citation format',
    instruction,
    outputKey: 'research_notes',
    generateContentConfig: {
      temperature: 0.1,
      maxOutputTokens: 2500,
    },
  });
}

// --- Phase 5: Synthesis ---

export function createContentAnalyzerAgent(model: string): LlmAgent {
  const instruction = [
    'You are an expert research analyst synthesising academic literature.',
    '',
    '==== CITATION RULES (MANDATORY) ====',
    'VALID in-text citation formats:',
    '  (Smith, 2020)',
    '  (World Health Organization, 2021)',
    '  (Smith & Jones, 2019)',
    '',
    'FORBIDDEN — these patterns must NEVER appear in your output:',
    '  (nih.gov, n.d.)         — domain names are not authors',
    '  (PubMed, --)            — database names are not authors',
    '  (Frontiersin.org, 2023) — website names are not authors',
    '  (Author, --)            — "--" is not a valid year',
    '  any URL fragment used as an author name',
    '',
    'If a source has no clear author, use the full organisation name.',
    'If year is unknown, use "n.d." — never "--".',
    '',
    '==== SYNTHESIS RULES ====',
    '1. COMPARISON OVER SUMMARY - Every theme must compare at least 2-3 sources.',
    '   Show agreements, contradictions, and ongoing debates.',
    '2. NO REDUNDANCY - Before writing each paragraph, check what you have already',
    '   written. Do NOT restate the same idea. Expand or contrast instead.',
    '3. LOGICAL PROGRESSION - Move from: context -> debate -> patterns -> gaps.',
    '4. CITATIONS REQUIRED - Every major claim must include (Author, Year) in-text.',
    '5. NO VAGUE PHRASES - Never write "studies show" without a specific citation.',
    '6. RESEARCH GAPS - End each theme with a clear unresolved question or gap.',
    '',
    'STRUCTURE:',
    '1. Research landscape overview (context, scale, scope of the debate)',
    '2. Theme 1 - agreements and converging evidence',
    '3. Theme 2 - contradictions and competing perspectives',
    '4. Theme 3 - cross-source patterns and trends',
    '5. Identified research gaps and future directions',
    '',
    'EXAMPLE STYLE:',
    'Several studies (Smith, 2018; Adeyemi, 2020) agree that hormonal changes drive',
    'physical development. However, Johnson (2021) argues that environmental factors play',
    'a more significant role, indicating a lack of consensus in current literature.',
    'This suggests a gap in longitudinal studies that separate biological and environmental',
    'contributors.',
    '',
    'Produce a structured thematic analysis forming the backbone of the final report.',
    'Use formal academic tone, third-person voice, past tense for findings.',
  ].join('\n');

  return new LlmAgent({
    name: 'content_analyzer',
    model,
    description: 'Synthesises research notes into a comparative, non-redundant thematic analysis with valid citations',
    instruction,
    outputKey: 'content_analysis',
    generateContentConfig: {
      temperature: 0.3,
      maxOutputTokens: 4000,
    },
  });
}
